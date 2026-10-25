"use client";

import "../../schools.css";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { FaTrash, FaPlus, FaChevronDown, FaTrophy } from "react-icons/fa6";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useSettings } from "@/context/SettingsContext";
import { MdFlagCircle, MdOutlineMessage } from "react-icons/md";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { CiLogin } from "react-icons/ci";
import { AdminInboxPanel } from "@/app/components/AdminInboxPanel";
import { FaClipboard } from "react-icons/fa";
import Cropper from "react-easy-crop";

//a school record including theming and rep information
interface School {
  id: string;
  name: string;
  code: string;
  logo_url: string | null;
  color: string;
  secondary_color: string;
  bg_image_url: string | null;
  gradient_mode: number;
  theme: string;
  website_url: string | null;
  rep_name: string;
  rep_email: string;
  status: string;
  rep_user_id: string | null;
}

//a found item posted on a school-specific board
interface SchoolItem {
  id: number;
  school_id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_urls: string[] | null;
  author_name: string;
  author_avatar: string | null;
  author_id: string;
  author_email: string;
  status: string;
  date_found: string;
  created_at: string;
  category?: string | null;
  location?: string | null;
  ai_keywords?: string | null;
  accepted_claimant_id?: string | null;
  accepted_claimant_name?: string | null;
  accepted_claimant_email?: string | null;
  handoff_confirmed_by_poster?: boolean;
  handoff_confirmed_by_claimant?: boolean;
  rejection_count?: number;
}

//a lost item report posted on a school-specific board
interface SchoolLostItem {
  id: number;
  school_id: string;
  name: string;
  description: string;
  image_url: string | null;
  image_urls: string[] | null;
  author_name: string;
  author_avatar: string | null;
  author_id: string;
  author_email: string;
  status: string;
  created_at: string;
  category?: string | null;
  location?: string | null;
}

//a claim submitted by a user on a school board item
interface SchoolClaimRequest {
  id: string;
  school_id: string;
  item_id: number;
  item_name: string;
  finder_id: string;
  claimant_id: string;
  claimant_name: string;
  claimant_email: string;
  description_proof: string;
  proof_image_url: string | null;
  status: string;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

//a dispute filed by a claimant on a school board item
interface SchoolDispute {
  id: string;
  school_id: string;
  item_id: number;
  item_name: string;
  claimant_id: string;
  claimant_email: string;
  reason: string;
  created_at: string;
}

//a report filed against a school board item
interface SchoolReport {
  id: number;
  school_id: string;
  item_id: number;
  item_name: string;
  item_image: string | null;
  item_type?: "found" | "lost";
  reporter_id: string;
  reporter_name: string;
  reporter_email: string | null;
  reason: string;
  created_at: string;
}

const SCHOOL_BOARD_CACHE_TTL_MS = 5 * 60 * 1000; //5-minute TTL for the school board item cache

//returns the localStorage key for a school's cached found and lost items
function getSchoolBoardCacheKey(schoolId: string) {
  return `finder_school_board_${schoolId}`;
}

//reads and validates the cached board data; returns null if missing or expired
function readSchoolBoardCache(schoolId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getSchoolBoardCacheKey(schoolId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      timestamp: number;
      found: SchoolItem[];
      lost: SchoolLostItem[];
    };
    if (!parsed?.timestamp || !Array.isArray(parsed.found) || !Array.isArray(parsed.lost)) return null;
    if (Date.now() - parsed.timestamp > SCHOOL_BOARD_CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

//writes the school's found and lost items to localStorage with a timestamp
function writeSchoolBoardCache(schoolId: string, found: SchoolItem[], lost: SchoolLostItem[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getSchoolBoardCacheKey(schoolId),
      JSON.stringify({ timestamp: Date.now(), found, lost }),
    );
  } catch {}
}

//converts a hex color to an rgba string with the given alpha
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

//returns the relative luminance of a hex color (0=black, 1=white)
function getLuminance(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const toLinear = (c: number) => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}
//returns a legible text color (dark or light) for the given background hex
function textOnColor(hex: string): string {
  return getLuminance(hex) > 0.35 ? "#1e293b" : "#ffffff";
}

//generates the 4 gradient preset strings used to overlay a school header background
function gradStyles(hex: string): string[] {
  return [
    `linear-gradient(to top, ${hexToRgba(hex, 0.97)} 0%, ${hexToRgba(hex, 0.72)} 40%, ${hexToRgba(hex, 0.2)} 75%, transparent 100%)`,
    `linear-gradient(to right, ${hexToRgba(hex, 0.95)} 0%, ${hexToRgba(hex, 0.65)} 50%, ${hexToRgba(hex, 0.1)} 100%)`,
    `linear-gradient(135deg, ${hexToRgba(hex, 0.92)} 0%, ${hexToRgba(hex, 0.5)} 55%, transparent 100%)`,
    `linear-gradient(to bottom, ${hexToRgba(hex, 0.85)} 0%, ${hexToRgba(hex, 0.55)} 100%)`,
  ];
}

//renders a cropped region of an image onto a canvas and returns it as a JPEG File
async function getCroppedImg(
  imageSrc: string,
  pixelCrop: { x: number; y: number; width: number; height: number },
  rotation = 0,
): Promise<File> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", reject);
    img.src = imageSrc;
  });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const maxSize = Math.max(image.width, image.height);
  const safeArea = 2 * ((maxSize / 2) * Math.sqrt(2));
  canvas.width = safeArea;
  canvas.height = safeArea;
  ctx.translate(safeArea / 2, safeArea / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.translate(-safeArea / 2, -safeArea / 2);
  ctx.drawImage(image, safeArea / 2 - image.width * 0.5, safeArea / 2 - image.height * 0.5);
  const data = ctx.getImageData(0, 0, safeArea, safeArea);
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  ctx.putImageData(
    data,
    Math.round(0 - safeArea / 2 + image.width * 0.5 - pixelCrop.x),
    Math.round(0 - safeArea / 2 + image.height * 0.5 - pixelCrop.y),
  );
  return new Promise((resolve) => {
    canvas.toBlob(
      (blob) => resolve(new File([blob!], "cropped.jpg", { type: "image/jpeg" })),
      "image/jpeg",
      0.92,
    );
  });
}

// ─── CropModal ────────────────────────────────────────────────────────────────
function CropModal({
  src, queueIndex, queueTotal, onConfirm, onSkip,
  cropPhotoLabel, cropOfLabel, cropZoomLabel, cropRotateLabel, skipCropLabel, applyCropLabel,
}: {
  src: string;
  queueIndex: number;
  queueTotal: number;
  onConfirm: (pixels: { x: number; y: number; width: number; height: number }, rotation: number) => void;
  onSkip: () => void;
  cropPhotoLabel: string;
  cropOfLabel: string;
  cropZoomLabel: string;
  cropRotateLabel: string;
  skipCropLabel: string;
  applyCropLabel: string;
}) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", zIndex: 2000, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px", gap: "14px" }}>
      <p style={{ color: "#fff", fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "15px", margin: 0 }}>
        {cropPhotoLabel}{queueTotal > 1 ? ` (${queueIndex + 1} ${cropOfLabel} ${queueTotal})` : ""}
      </p>
      <div style={{ position: "relative", width: "min(90vw, 600px)", aspectRatio: "4 / 3", borderRadius: "12px", overflow: "hidden", border: "2px solid rgba(255,255,255,0.12)" }}>
        <Cropper image={src} crop={crop} zoom={zoom} rotation={rotation} aspect={6 / 5} onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px", width: "min(90vw, 600px)", background: "rgba(255,255,255,0.06)", borderRadius: "10px", padding: "14px 16px" }}>
        {[[cropZoomLabel, zoom, 1, 3, 0.05, setZoom, `${zoom.toFixed(1)}×`], [cropRotateLabel, rotation, -180, 180, 1, setRotation, `${rotation}°`]].map(([label, val, min, max, step, setter, display]) => (
          <div key={label as string} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.55)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.6px", minWidth: 44 }}>{label as string}</span>
            <input type="range" min={min as number} max={max as number} step={step as number} value={val as number} onChange={(e) => (setter as any)(Number(e.target.value))} style={{ flex: 1, accentColor: "var(--accent)" }} />
            <span style={{ color: "rgba(255,255,255,0.4)", fontFamily: "var(--font-body)", fontSize: "11px", minWidth: 32, textAlign: "right" }}>{display as string}</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px", width: "min(90vw, 600px)" }}>
        <button onClick={onSkip} style={{ flex: 1, padding: "13px 0", borderRadius: "9px", border: "1.5px solid rgba(255,255,255,0.2)", background: "transparent", color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>{skipCropLabel}</button>
        <button onClick={() => croppedAreaPixels && onConfirm(croppedAreaPixels, rotation)} style={{ flex: 2, padding: "13px 0", borderRadius: "9px", border: "none", background: "var(--accent)", color: "#fff", fontFamily: "var(--font-body)", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>{applyCropLabel}</button>
      </div>
    </div>
  );
}

// ─── Email helper ─────────────────────────────────────────────────────────────
function sendEmail(route: string, body: Record<string, string>) {
  fetch(`/api/emails/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(console.error);
}

// ─── Translation helper ────────────────────────────────────────────────────────
async function fetchTranslation(key: string, target: string, cacheKey: string, setter: (val: string) => void) {
  const cached = localStorage.getItem(`${cacheKey}_${target}`);
  if (cached) { setter(cached); return; }
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: key, target }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated = (data.translatedText as string | undefined)?.trim() || key;
      setter(translated);
      localStorage.setItem(`${cacheKey}_${target}`, translated);
    } else { setter(key); }
  } catch { setter(key); }
}

// ─── BoardStrings ──────────────────────────────────────────────────────────────
interface BoardStrings {
  backBtn: string;
  adminBadge: string;
  exitAdmin: string;
  itemsTab: string;
  addItemTab: string;
  myDashTab: string;
  toggleFound: string;
  toggleLost: string;
  adminTab: string;
  reportsTab: string;
  searchPlaceholder: string;
  foundTabLabel: string;
  lostTabLabel: string;
  loadingText: string;
  foundBy: string;
  claimPending: string;
  confirmClaimed: string;
  markFound: string;
  noFoundItems: string;
  noLostItems: string;
  noImage: string;
  lostBy: string;
  reportFoundTitle: string;
  itemNameLabel: string;
  itemNamePlaceholder: string;
  descLabel: string;
  descFoundPlaceholder: string;
  photosLabel: string;
  photosSelected: string;
  uploadPhotos: string;
  cancelBtn: string;
  postItemBtn: string;
  postingBtn: string;
  itemPostedMsg: string;
  reportLostTitle: string;
  whatLostLabel: string;
  lostItemPlaceholder: string;
  descLostPlaceholder: string;
  photosOptionalLabel: string;
  postLostBtn: string;
  postingLostBtn: string;
  lostPostedMsg: string;
  adminLoginTitle: string;
  adminLoginHint: string;
  adminPasswordLabel: string;
  adminPasswordPlaceholder: string;
  unlockBtn: string;
  checkingBtn: string;
  adminUnlockedMsg: string;
  adminUnlockedSub: string;
  adminIncorrect: string;
  myFoundPosted: string;
  myLostReported: string;
  noMyItems: string;
  signInToView: string;
  filterCategory: string;
  filterDateFrom: string;
  filterDateTo: string;
  clearFilters: string;
  statPosted: string;
  statReturned: string;
  statLost: string;
  xpToNextLevel: string;
  maxLevelReached: string;
  xpBreakdown: string;
  xpReturn: string;
  xpPost: string;
  xpReportLost: string;
  monthlyActivity: string;
  chartFound: string;
  chartLost: string;
  chartReturned: string;
  actionBreakdown: string;
  noActivity: string;
  chartFoundPosted: string;
  chartLostReported: string;
  pendingClaimsTitle: string;
  myActiveClaims: string;
  noActiveClaims: string;
  confirmHandoff: string;
  acceptedCoordinate: string;
  pendingReview: string;
  goToItem: string;
  confirmReceipt: string;
  cancelClaim: string;
  review: string;
  leaderboardTab: string;
  inboxTab: string;
  leaderboardDesc: string;
  leaderboardEmpty: string;
  leaderboardReturned: string;
  leaderboardYou: string;
  reportedItemsTitle: string;
  reportedItemsDesc: string;
  disputesTitle: string;
  disputesDesc: string;
  inboxTitle: string;
  inboxDesc: string;
  noReports: string;
  noDisputes: string;
  reportedBy: string;
  dismiss: string;
  deleteBtn: string;
  dismissDispute: string;
  resolveForClaimant: string;
  messageParties: string;
  claimantLabel: string;
  finderLabel: string;
  sending: string;
  sendMessage: string;
  viewItem: string;
  disputedBy: string;
  schoolNotFound: string;
  backToSchools: string;
  cropPhoto: string;
  cropOf: string;
  cropZoom: string;
  cropRotate: string;
  skipCrop: string;
  applyCrop: string;
  statusActive: string;
  statusClaimPending: string;
  statusClaimInProgress: string;
  statusAwaiting: string;
  statusDisputed: string;
  confirmDeleteReport: string;
  confirmDismissDispute: string;
  confirmResolveDispute: string;
  cannotDeleteHandoff: string;
  confirmDeleteItem: string;
  confirmDeleteWithClaimsPre: string;
  confirmDeleteWithClaimsPost: string;
  confirmDeleteAcceptedPre: string;
  confirmDeleteAcceptedPost: string;
  confirmDeleteLostItem: string;
  claimCancelledMsg: string;
  categoryLabel: string;
  selectCategory: string;
  whereFound: string;
  dateFoundLabel: string;
  whereFoundPlaceholder: string;
  lastSeenWhere: string;
  dateLostLabel: string;
  lastSeenPlaceholder: string;
  schoolMember: string;
  pendingClaimSingular: string;
  pendingClaimPlural: string;
  finderHandedOff: string;
  failedToPost: string;
  failedToRecord: string;
}

const DEFAULT_BOARD: BoardStrings = {
  backBtn: "← Back",
  adminBadge: "School Admin",
  exitAdmin: "Exit",
  itemsTab: "Items",
  addItemTab: "Add Item",
  myDashTab: "My Dashboard",
  toggleFound: "Found an Item",
  toggleLost: "Lost an Item",
  adminTab: "Admin",
  reportsTab: "Reports",
  searchPlaceholder: "Search items",
  foundTabLabel: "Found Items",
  lostTabLabel: "Lost Items",
  loadingText: "Loading...",
  foundBy: "Found by",
  claimPending: "Claim Pending",
  confirmClaimed: "Confirm Claimed",
  markFound: "Mark Found",
  noFoundItems: "No found items yet.",
  noLostItems: "No lost item reports yet.",
  noImage: "No image",
  lostBy: "Lost by",
  reportFoundTitle: "Report Found Item",
  itemNameLabel: "Item Name",
  itemNamePlaceholder: "e.g. Blue water bottle",
  descLabel: "Description",
  descFoundPlaceholder: "Where did you find it? Any identifying features?",
  photosLabel: "Photos (up to 3)",
  photosSelected: "photo(s) selected",
  uploadPhotos: "Upload photos",
  cancelBtn: "Cancel",
  postItemBtn: "Post Item",
  postingBtn: "Posting...",
  itemPostedMsg: "Item posted!",
  reportLostTitle: "Report Lost Item",
  whatLostLabel: "What did you lose?",
  lostItemPlaceholder: "Item name",
  descLostPlaceholder: "When/where did you lose it? Any details?",
  photosOptionalLabel: "Photos (optional, up to 3)",
  postLostBtn: "Post Lost Item",
  postingLostBtn: "Posting...",
  lostPostedMsg: "Lost item reported!",
  adminLoginTitle: "School Admin Access",
  adminLoginHint: "Enter the password from your Findr approval email.",
  adminPasswordLabel: "Admin Password",
  adminPasswordPlaceholder: "e.g. FINDR-JANE-X4K2",
  unlockBtn: "Unlock Admin View",
  checkingBtn: "Checking...",
  adminUnlockedMsg: "Admin view unlocked!",
  adminUnlockedSub: "You can now delete items and manage this school's board.",
  adminIncorrect: "Incorrect password or not approved yet.",
  myFoundPosted: "Found Items I Posted",
  myLostReported: "Lost Items I Reported",
  noMyItems: "You haven't posted any items here yet.",
  signInToView: "Sign in to view your items.",
  filterCategory: "Category",
  filterDateFrom: "Date from",
  filterDateTo: "Date to",
  clearFilters: "Clear filters",
  statPosted: "Posted",
  statReturned: "Returned",
  statLost: "Lost",
  xpToNextLevel: "XP to next level",
  maxLevelReached: "Max level reached",
  xpBreakdown: "XP breakdown",
  xpReturn: "Return: +100 XP each",
  xpPost: "Post: +20 XP each",
  xpReportLost: "Report lost: +5 XP each",
  monthlyActivity: "Monthly activity",
  chartFound: "Found",
  chartLost: "Lost",
  chartReturned: "Returned",
  actionBreakdown: "Action breakdown",
  noActivity: "No activity yet.",
  chartFoundPosted: "Found posted",
  chartLostReported: "Lost reported",
  pendingClaimsTitle: "Pending Claims on My Items",
  myActiveClaims: "My Active Claims",
  noActiveClaims: "You have no active claims at this school.",
  confirmHandoff: "Confirm Handoff",
  acceptedCoordinate: "Accepted - Coordinate Now",
  pendingReview: "Pending Review",
  goToItem: "Go to Item",
  confirmReceipt: "Confirm Receipt",
  cancelClaim: "Cancel Claim",
  review: "Review",
  leaderboardTab: "Leaderboard",
  inboxTab: "Inbox",
  leaderboardDesc: "Top finders, ranked by items returned",
  leaderboardEmpty: "No items have been returned yet. Be the first!",
  leaderboardReturned: "returned",
  leaderboardYou: "You",
  reportedItemsTitle: "Reported Items",
  reportedItemsDesc: "Items flagged by students at this school. Only you can see these.",
  disputesTitle: "Disputes",
  disputesDesc: "Handoff disputes raised by claimants at this school.",
  inboxTitle: "Inbox",
  inboxDesc: "Messages from students at this school.",
  noReports: "No reports, all clear!",
  noDisputes: "No disputes, all clear!",
  reportedBy: "Reported by",
  dismiss: "Dismiss",
  deleteBtn: "Delete",
  dismissDispute: "Dismiss Dispute",
  resolveForClaimant: "Resolve for Claimant",
  messageParties: "Message Parties",
  claimantLabel: "Claimant",
  finderLabel: "Finder",
  sending: "Sending...",
  sendMessage: "Send Message",
  viewItem: "View Item",
  disputedBy: "Disputed by",
  schoolNotFound: "School not found.",
  backToSchools: "← Back to Schools",
  cropPhoto: "Crop Photo",
  cropOf: "of",
  cropZoom: "Zoom",
  cropRotate: "Rotate",
  skipCrop: "Skip crop",
  applyCrop: "Apply Crop",
  statusActive: "Active",
  statusClaimPending: "Claim pending",
  statusClaimInProgress: "Claim in progress",
  statusAwaiting: "Awaiting confirmation",
  statusDisputed: "Disputed",
  confirmDeleteReport: "permanently?",
  confirmDismissDispute: "Dismiss dispute? Item returns to claim_accepted status.",
  confirmResolveDispute: "Resolve for claimant? Item will be permanently deleted.",
  cannotDeleteHandoff: "Cannot delete while handoff or dispute is in progress.",
  confirmDeleteItem: "Delete this item permanently?",
  confirmDeleteWithClaimsPre: "student(s) have claimed this item. Deleting will notify them. Continue?",
  confirmDeleteWithClaimsPost: "student(s) have claimed this item. Deleting will notify them. Continue?",
  confirmDeleteAcceptedPre: "You accepted",
  confirmDeleteAcceptedPost: "'s claim. Deleting cancels it. Continue?",
  confirmDeleteLostItem: "Delete this lost item report?",
  claimCancelledMsg: "This claim can no longer be cancelled.",
  categoryLabel: "Category",
  selectCategory: "Select a category",
  whereFound: "Where was it found?",
  dateFoundLabel: "Date Found",
  whereFoundPlaceholder: "e.g. Room 204, near the gym, front office...",
  lastSeenWhere: "Last seen where?",
  dateLostLabel: "Date Lost",
  lastSeenPlaceholder: "e.g. Cafeteria, locker room, room 101...",
  schoolMember: "member",
  pendingClaimSingular: "pending claim",
  pendingClaimPlural: "pending claims",
  finderHandedOff: "Finder marked as handed off",
  failedToPost: "Failed to post lost item:",
  failedToRecord: "Failed to record return:",
};

//item categories shown in the school board post and filter dropdowns
const CATEGORIES = [
  "Electronics", "Clothing & Accessories", "Bags & Backpacks", "Books & Stationery",
  "Keys", "Wallet & Cards", "Jewelry", "Water Bottle", "Sports Equipment",
  "Musical Instrument", "Glasses & Eyewear", "Headphones & Earbuds", "Phone",
  "Charger & Cables", "ID & Documents", "Toys & Games", "Food & Containers",
  "Umbrella", "Other",
];

// ─── Status badge helper ───────────────────────────────────────────────────────
//renders a colored status pill for a school board item
function StatusBadge({ status, s }: { status: string; s: BoardStrings }) {
  const map: Record<string, { label: string; color: string }> = {
    waiting:        { label: s.statusActive,          color: "var(--success)" },
    pending:        { label: s.statusClaimPending,    color: "var(--accent)" },
    claim_accepted: { label: s.statusClaimInProgress, color: "var(--warning)" },
    handed_off:     { label: s.statusAwaiting,        color: "var(--text-muted)" },
    disputed:       { label: s.statusDisputed,        color: "var(--danger)" },
  };
  const info = map[status] ?? { label: status, color: "var(--text-muted)" };
  return (
    <p style={{ fontSize: "0.75rem", fontWeight: 600, marginTop: 4, color: info.color, fontFamily: "var(--font-body)" }}>
      {info.label}
    </p>
  );
}

// ─── SchoolReportsPanel ────────────────────────────────────────────────────────
//admin panel listing reported items for a school with dismiss/delete actions
function SchoolReportsPanel({ school, onDeleteItem, s }: { school: School; onDeleteItem: (itemId: number) => void; color: string; s: BoardStrings }) {
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("school_reports").select("*").eq("school_id", school.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setReports(data as SchoolReport[]); setLoading(false); });
  }, [school.id]);

  const handleDismiss = async (reportId: number) => {
    await supabase.from("school_reports").delete().eq("id", reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleDeleteItem = async (report: SchoolReport) => {
    if (!confirm(`Delete "${report.item_name}" ${s.confirmDeleteReport}`)) return;
    const table = report.item_type === "lost" ? "school_lost_items" : "school_items";
    await supabase.from(table).delete().eq("id", report.item_id);
    await supabase.from("school_reports").delete().eq("item_id", report.item_id);
    onDeleteItem(report.item_id);
    setReports((prev) => prev.filter((r) => r.item_id !== report.item_id));
  };

  if (loading) return <div className="sc-empty" style={{ padding: "32px 0" }}>{s.loadingText}</div>;
  if (reports.length === 0) return <div className="sc-empty" style={{ padding: "32px 0" }}>{s.noReports}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "4px 0" }}>
      {reports.map((report) => (
        <div key={report.id} style={{ background: "var(--bg-card)", border: "1.5px solid var(--border-default)", borderRadius: 12, padding: "14px 16px", display: "flex", gap: 14, alignItems: "flex-start" }}>
          {report.item_image && <img src={report.item_image} alt={report.item_name} style={{ width: 60, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 3 }}>
              <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{report.item_name}</p>
              <span style={{ fontFamily: "var(--font-body)", fontSize: "0.68rem", fontWeight: 700, padding: "1px 7px", borderRadius: 100, background: report.item_type === "lost" ? "rgba(239,68,68,0.12)" : "rgba(16,185,129,0.12)", color: report.item_type === "lost" ? "var(--danger)" : "var(--success)", flexShrink: 0 }}>
                {report.item_type === "lost" ? "Lost" : "Found"}
              </span>
            </div>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--danger)", margin: "0 0 4px", fontWeight: 600 }}>{report.reason}</p>
            <p style={{ fontFamily: "var(--font-body)", fontSize: "0.74rem", color: "var(--text-muted)", margin: 0 }}>
              {s.reportedBy} {report.reporter_name}{report.reporter_email ? ` · ${report.reporter_email}` : ""} · {new Date(report.created_at).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6, flexShrink: 0 }}>
            <button onClick={() => handleDismiss(report.id)} className="sc-btn sc-btn--ghost sc-btn--sm">{s.dismiss}</button>
            <button onClick={() => handleDeleteItem(report)} className="sc-btn sc-btn--danger sc-btn--sm">{s.deleteBtn}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── SchoolDisputesPanel ───────────────────────────────────────────────────────
//admin panel listing open disputes for a school with resolve/dismiss actions
function SchoolDisputesPanel({
  school, adminId, adminName, onRestoreItem, s,
}: {
  school: School;
  adminId: string;
  adminName: string;
  onRestoreItem: (itemId: number, status: string) => void;
  s: BoardStrings;
}) {
  const [disputes, setDisputes] = useState<SchoolDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [msgTarget, setMsgTarget] = useState<"claimant" | "finder">("claimant");
  const [msgText, setMsgText] = useState("");
  const [msgSending, setMsgSending] = useState(false);

  useEffect(() => {
    supabase.from("school_disputes").select("*").eq("school_id", school.id).order("created_at", { ascending: false })
      .then(({ data }) => { if (data) setDisputes(data as SchoolDispute[]); setLoading(false); });
  }, [school.id]);

  const handleDismiss = async (dispute: SchoolDispute) => {
    if (!confirm(s.confirmDismissDispute)) return;
    await supabase.from("school_items").update({
      status: "claim_accepted",
      handoff_confirmed_by_poster: false,
      handoff_confirmed_by_claimant: false,
    }).eq("id", dispute.item_id);
    await supabase.from("school_disputes").delete().eq("id", dispute.id);
    onRestoreItem(dispute.item_id, "claim_accepted");
    setDisputes((prev) => prev.filter((d) => d.id !== dispute.id));
  };

  const handleResolveForClaimant = async (dispute: SchoolDispute) => {
    if (!confirm(s.confirmResolveDispute)) return;
    await supabase.from("school_items").delete().eq("id", dispute.item_id);
    await supabase.from("school_disputes").delete().eq("id", dispute.id);
    onRestoreItem(dispute.item_id, "claimed");
    setDisputes((prev) => prev.filter((d) => d.id !== dispute.id));
  };

  const handleSendMsg = async (dispute: SchoolDispute) => {
    let targetId = dispute.claimant_id;
    let targetEmail = dispute.claimant_email;
    let targetName = dispute.claimant_email;

    if (msgTarget === "finder") {
      const { data: itemData } = await supabase.from("school_items").select("author_id, author_name, author_email").eq("id", dispute.item_id).maybeSingle();
      if (itemData) { targetId = itemData.author_id; targetEmail = itemData.author_email; targetName = itemData.author_name; }
    }
    if (!targetId || !adminId) return;
    setMsgSending(true);
    const convId = `conv_${[adminId, targetId].sort().join("_")}`;
    await supabase.from("chat_messages").insert({
      conversation_id: convId,
      sender_id: adminId,
      sender_name: adminName,
      sender_email: "",
      receiver_id: targetId,
      receiver_name: targetName,
      receiver_email: targetEmail,
      item_id: String(dispute.item_id),
      item_title: dispute.item_name,
      text: msgText.trim(),
      read: false,
    });
    setMsgSending(false);
    setMsgText("");
    setMessagingId(null);
  };

  if (loading) return <div className="sc-empty">{s.loadingText}</div>;
  if (disputes.length === 0) return <div className="sc-empty">{s.noDisputes}</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {disputes.map((dispute) => (
        <div key={dispute.id} style={{ background: "var(--bg-card)", border: "1.5px solid var(--border-default)", borderRadius: 12, padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text-primary)", margin: "0 0 4px" }}>{dispute.item_name}</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--text-secondary)", margin: "0 0 4px" }}>{dispute.reason}</p>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.74rem", color: "var(--text-muted)", margin: "0 0 6px" }}>
                {s.disputedBy} {dispute.claimant_email} · {new Date(dispute.created_at).toLocaleDateString()}
              </p>
              <a href={`/school-items/${dispute.item_id}`} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", padding: "3px 10px", borderRadius: 100, background: school.color, color: textOnColor(school.color), fontSize: 11, fontWeight: 700, fontFamily: "var(--font-body)", textDecoration: "none" }}>
                {s.viewItem} →
              </a>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0, width: 170 }}>
              <button className="sc-btn sc-btn--ghost sc-btn--sm" style={{ width: "100%" }} onClick={() => handleDismiss(dispute)}>{s.dismissDispute}</button>
              <button className="sc-btn sc-btn--danger sc-btn--sm" style={{ width: "100%" }} onClick={() => handleResolveForClaimant(dispute)}>{s.resolveForClaimant}</button>
              <button
                className="sc-btn sc-btn--sm"
                style={{ width: "100%", background: school.color, color: textOnColor(school.color), border: "none" }}
                onClick={() => setMessagingId(messagingId === dispute.id ? null : dispute.id)}
              >
                {messagingId === dispute.id ? s.cancelBtn : s.messageParties}
              </button>
            </div>
          </div>
          {messagingId === dispute.id && (
            <div style={{ borderTop: "1px solid var(--border-default)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", gap: 6 }}>
                {(["claimant", "finder"] as const).map((t) => (
                  <button key={t} onClick={() => setMsgTarget(t)} style={{ padding: "7px 16px", borderRadius: 100, border: "none", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, cursor: "pointer", background: msgTarget === t ? school.color : "var(--bg-input)", color: msgTarget === t ? textOnColor(school.color) : "var(--text-muted)" }}>
                    {t === "claimant" ? s.claimantLabel : s.finderLabel}
                  </button>
                ))}
              </div>
              <textarea className="sc-form__textarea" style={{ width: "100%", minHeight: 80, boxSizing: "border-box" }} placeholder={`${s.sendMessage}...`} value={msgText} onChange={(e) => setMsgText(e.target.value)} />
              <button className="sc-btn sc-btn--primary" style={{ width: "100%", background: school.color, borderColor: school.color }} disabled={msgSending || !msgText.trim()} onClick={() => handleSendMsg(dispute)}>
                {msgSending ? s.sending : s.sendMessage}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── SchoolCharts ──────────────────────────────────────────────────────────────
//bar chart panel showing monthly found, lost, and returned activity for the school
function SchoolCharts({ chartKey, monthLabels, foundByMonth, lostByMonth, returnedByMonth, totalFound, totalLost, totalReturned, clrFound, clrLost, clrReturned, labelFound, labelLost, labelReturned, labelFoundPosted, labelLostReported }: {
  chartKey: string; monthLabels: string[]; foundByMonth: number[]; lostByMonth: number[]; returnedByMonth: number[];
  totalFound: number; totalLost: number; totalReturned: number; clrFound: string; clrLost: string; clrReturned: string;
  labelFound: string; labelLost: string; labelReturned: string; labelFoundPosted: string; labelLostReported: string;
}) {
  useEffect(() => {
    const load = () => new Promise<void>((resolve) => {
      if ((window as any).Chart) { resolve(); return; }
      const sc = document.createElement("script");
      sc.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
      sc.onload = () => resolve();
      document.head.appendChild(sc);
    });
    load().then(() => {
      const C = (window as any).Chart;
      const style = getComputedStyle(document.documentElement);
      const gridColor = style.getPropertyValue("--border-default").trim() || "rgba(0,0,0,0.06)";
      const tickColor = style.getPropertyValue("--text-muted").trim() || "rgba(0,0,0,0.45)";
      const chartFont = style.getPropertyValue("--font-body").trim() || "system-ui, sans-serif";
      const barEl = document.getElementById(`schoolBarChart-${chartKey}`) as HTMLCanvasElement | null;
      if (barEl) {
        const ex = C.getChart(barEl); if (ex) ex.destroy();
        new C(barEl, { type: "bar", data: { labels: monthLabels, datasets: [
          { label: labelFound, data: foundByMonth, backgroundColor: clrFound, borderRadius: 5, borderSkipped: false },
          { label: labelLost, data: lostByMonth, backgroundColor: clrLost, borderRadius: 5, borderSkipped: false },
          { label: labelReturned, data: returnedByMonth, backgroundColor: clrReturned, borderRadius: 5, borderSkipped: false },
        ]}, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { mode: "index", intersect: false, padding: 10, cornerRadius: 8, bodyFont: { family: chartFont, size: 12 }, titleFont: { family: chartFont, size: 12 } } }, scales: { x: { stacked: true, grid: { color: gridColor }, ticks: { color: tickColor, font: { family: chartFont, size: 11 }, autoSkip: false } }, y: { stacked: true, beginAtZero: true, ticks: { stepSize: 1, color: tickColor, font: { family: chartFont, size: 11 } }, grid: { color: gridColor } } } } });
      }
      const pieEl = document.getElementById(`schoolPieChart-${chartKey}`) as HTMLCanvasElement | null;
      if (pieEl && totalFound + totalLost + totalReturned > 0) {
        const ex = C.getChart(pieEl); if (ex) ex.destroy();
        new C(pieEl, { type: "doughnut", data: { labels: [labelFoundPosted, labelLostReported, labelReturned], datasets: [{ data: [totalFound, totalLost, totalReturned], backgroundColor: [clrFound, clrLost, clrReturned], borderWidth: 0, hoverOffset: 8 }] }, options: { responsive: true, maintainAspectRatio: false, cutout: "62%", plugins: { legend: { display: false }, tooltip: { padding: 10, cornerRadius: 8, callbacks: { label: (ctx: any) => { const tot = totalFound + totalLost + totalReturned; return ` ${ctx.label}: ${ctx.parsed} (${Math.round((ctx.parsed / tot) * 100)}%)`; } }, bodyFont: { family: chartFont, size: 12 }, titleFont: { family: chartFont, size: 12 } } } } });
      }
    });
  }, [chartKey]);
  return null;
}

// ─── Page ──────────────────────────────────────────────────────────────────────
//school-specific board with found/lost items, post forms, leaderboard, admin tools, and inbox
export default function SchoolBoardPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { language, hydrated } = useSettings();

  const [school, setSchool] = useState<School | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [s, setS] = useState<BoardStrings>(DEFAULT_BOARD);
  const [stringsReady, setStringsReady] = useState(false);

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("schools").select("*").eq("id", schoolId).eq("status", "approved").maybeSingle()
      .then(({ data }) => { if (data) setSchool(data as School); setLoadingSchool(false); });
  }, [schoolId]);

  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setS(DEFAULT_BOARD); setStringsReady(true); return; }
    const pairs: [keyof BoardStrings, string, string][] = [
      ["backBtn", "← Back", "sc_board_backBtn"],
      ["adminBadge", "School Admin", "sc_board_adminBadge"],
      ["exitAdmin", "Exit", "sc_board_exitAdmin"],
      ["itemsTab", "Items", "sc_board_itemsTab"],
      ["addItemTab", "Add Item", "sc_board_addItemTab"],
      ["myDashTab", "My Dashboard", "sc_board_myDashTab"],
      ["toggleFound", "Found an Item", "sc_board_toggleFound"],
      ["toggleLost", "Lost an Item", "sc_board_toggleLost"],
      ["adminTab", "Admin", "sc_board_adminTab"],
      ["reportsTab", "Reports", "sc_board_reportsTab"],
      ["searchPlaceholder", "Search items", "sc_board_searchPlaceholder"],
      ["foundTabLabel", "Found Items", "sc_board_foundTabLabel"],
      ["lostTabLabel", "Lost Items", "sc_board_lostTabLabel"],
      ["loadingText", "Loading...", "sc_board_loadingText"],
      ["foundBy", "Found by", "sc_board_foundBy"],
      ["claimPending", "Claim Pending", "sc_board_claimPending"],
      ["confirmClaimed", "Confirm Claimed", "sc_board_confirmClaimed"],
      ["markFound", "Mark Found", "sc_board_markFound"],
      ["noFoundItems", "No found items yet.", "sc_board_noFoundItems"],
      ["noLostItems", "No lost item reports yet.", "sc_board_noLostItems"],
      ["noImage", "No image", "sc_board_noImage"],
      ["lostBy", "Lost by", "sc_board_lostBy"],
      ["reportFoundTitle", "Report Found Item", "sc_board_reportFoundTitle"],
      ["itemNameLabel", "Item Name", "sc_board_itemNameLabel"],
      ["itemNamePlaceholder", "e.g. Blue water bottle", "sc_board_itemNamePlaceholder"],
      ["descLabel", "Description", "sc_board_descLabel"],
      ["descFoundPlaceholder", DEFAULT_BOARD.descFoundPlaceholder, "sc_board_descFoundPlaceholder"],
      ["photosLabel", "Photos (up to 3)", "sc_board_photosLabel"],
      ["photosSelected", "photo(s) selected", "sc_board_photosSelected"],
      ["uploadPhotos", "Upload photos", "sc_board_uploadPhotos"],
      ["cancelBtn", "Cancel", "sc_board_cancelBtn"],
      ["postItemBtn", "Post Item", "sc_board_postItemBtn"],
      ["postingBtn", "Posting...", "sc_board_postingBtn"],
      ["itemPostedMsg", "Item posted!", "sc_board_itemPostedMsg"],
      ["reportLostTitle", "Report Lost Item", "sc_board_reportLostTitle"],
      ["whatLostLabel", "What did you lose?", "sc_board_whatLostLabel"],
      ["lostItemPlaceholder", "Item name", "sc_board_lostItemPlaceholder"],
      ["descLostPlaceholder", DEFAULT_BOARD.descLostPlaceholder, "sc_board_descLostPlaceholder"],
      ["photosOptionalLabel", "Photos (optional, up to 3)", "sc_board_photosOptionalLabel"],
      ["postLostBtn", "Post Lost Item", "sc_board_postLostBtn"],
      ["postingLostBtn", "Posting...", "sc_board_postingLostBtn"],
      ["lostPostedMsg", "Lost item reported!", "sc_board_lostPostedMsg"],
      ["adminLoginTitle", "School Admin Access", "sc_board_adminLoginTitle"],
      ["adminLoginHint", DEFAULT_BOARD.adminLoginHint, "sc_board_adminLoginHint"],
      ["adminPasswordLabel", "Admin Password", "sc_board_adminPasswordLabel"],
      ["adminPasswordPlaceholder", "e.g. FINDR-JANE-X4K2", "sc_board_adminPasswordPlaceholder"],
      ["unlockBtn", "Unlock Admin View", "sc_board_unlockBtn"],
      ["checkingBtn", "Checking...", "sc_board_checkingBtn"],
      ["adminUnlockedMsg", "Admin view unlocked!", "sc_board_adminUnlockedMsg"],
      ["adminUnlockedSub", DEFAULT_BOARD.adminUnlockedSub, "sc_board_adminUnlockedSub"],
      ["adminIncorrect", DEFAULT_BOARD.adminIncorrect, "sc_board_adminIncorrect"],
      ["myFoundPosted", "Found Items I Posted", "sc_board_myFoundPosted"],
      ["myLostReported", "Lost Items I Reported", "sc_board_myLostReported"],
      ["noMyItems", "You haven't posted any items here yet.", "sc_board_noMyItems"],
      ["signInToView", "Sign in to view your items.", "sc_board_signInToView"],
      ["filterCategory", "Category", "sc_board_filterCategory"],
      ["filterDateFrom", "Date from", "sc_board_filterDateFrom"],
      ["filterDateTo", "Date to", "sc_board_filterDateTo"],
      ["clearFilters", "Clear filters", "sc_board_clearFilters"],
      ["statPosted", "Posted", "sc_board_statPosted"],
      ["statReturned", "Returned", "sc_board_statReturned"],
      ["statLost", "Lost", "sc_board_statLost"],
      ["xpToNextLevel", "XP to next level", "sc_board_xpToNextLevel"],
      ["maxLevelReached", "Max level reached", "sc_board_maxLevelReached"],
      ["xpBreakdown", "XP breakdown", "sc_board_xpBreakdown"],
      ["xpReturn", "Return: +100 XP each", "sc_board_xpReturn"],
      ["xpPost", "Post: +20 XP each", "sc_board_xpPost"],
      ["xpReportLost", "Report lost: +5 XP each", "sc_board_xpReportLost"],
      ["monthlyActivity", "Monthly activity", "sc_board_monthlyActivity"],
      ["chartFound", "Found", "sc_board_chartFound"],
      ["chartLost", "Lost", "sc_board_chartLost"],
      ["chartReturned", "Returned", "sc_board_chartReturned"],
      ["actionBreakdown", "Action breakdown", "sc_board_actionBreakdown"],
      ["noActivity", "No activity yet.", "sc_board_noActivity"],
      ["chartFoundPosted", "Found posted", "sc_board_chartFoundPosted"],
      ["chartLostReported", "Lost reported", "sc_board_chartLostReported"],
      ["pendingClaimsTitle", "Pending Claims on My Items", "sc_board_pendingClaimsTitle"],
      ["myActiveClaims", "My Active Claims", "sc_board_myActiveClaims"],
      ["noActiveClaims", "You have no active claims at this school.", "sc_board_noActiveClaims"],
      ["confirmHandoff", "Confirm Handoff", "sc_board_confirmHandoff"],
      ["acceptedCoordinate", "Accepted - Coordinate Now", "sc_board_acceptedCoordinate"],
      ["pendingReview", "Pending Review", "sc_board_pendingReview"],
      ["goToItem", "Go to Item", "sc_board_goToItem"],
      ["confirmReceipt", "Confirm Receipt", "sc_board_confirmReceipt"],
      ["cancelClaim", "Cancel Claim", "sc_board_cancelClaim"],
      ["review", "Review", "sc_board_review"],
      ["leaderboardTab", "Leaderboard", "sc_board_leaderboardTab"],
      ["inboxTab", "Inbox", "sc_board_inboxTab"],
      ["leaderboardDesc", "Top finders, ranked by items returned", "sc_board_leaderboardDesc"],
      ["leaderboardEmpty", "No items have been returned yet. Be the first!", "sc_board_leaderboardEmpty"],
      ["leaderboardReturned", "returned", "sc_board_leaderboardReturned"],
      ["leaderboardYou", "You", "sc_board_leaderboardYou"],
      ["reportedItemsTitle", "Reported Items", "sc_board_reportedItemsTitle"],
      ["reportedItemsDesc", "Items flagged by students at this school. Only you can see these.", "sc_board_reportedItemsDesc"],
      ["disputesTitle", "Disputes", "sc_board_disputesTitle"],
      ["disputesDesc", "Handoff disputes raised by claimants at this school.", "sc_board_disputesDesc"],
      ["inboxTitle", "Inbox", "sc_board_inboxTitle"],
      ["inboxDesc", "Messages from students at this school.", "sc_board_inboxDesc"],
      ["noReports", "No reports, all clear!", "sc_board_noReports"],
      ["noDisputes", "No disputes, all clear!", "sc_board_noDisputes"],
      ["reportedBy", "Reported by", "sc_board_reportedBy"],
      ["dismiss", "Dismiss", "sc_board_dismiss"],
      ["deleteBtn", "Delete", "sc_board_deleteBtn"],
      ["dismissDispute", "Dismiss Dispute", "sc_board_dismissDispute"],
      ["resolveForClaimant", "Resolve for Claimant", "sc_board_resolveForClaimant"],
      ["messageParties", "Message Parties", "sc_board_messageParties"],
      ["claimantLabel", "Claimant", "sc_board_claimantLabel"],
      ["finderLabel", "Finder", "sc_board_finderLabel"],
      ["sending", "Sending...", "sc_board_sending"],
      ["sendMessage", "Send Message", "sc_board_sendMessage"],
      ["viewItem", "View Item", "sc_board_viewItem"],
      ["disputedBy", "Disputed by", "sc_board_disputedBy"],
      ["schoolNotFound", "School not found.", "sc_board_schoolNotFound"],
      ["backToSchools", "← Back to Schools", "sc_board_backToSchools"],
      ["cropPhoto", "Crop Photo", "sc_board_cropPhoto"],
      ["cropOf", "of", "sc_board_cropOf"],
      ["cropZoom", "Zoom", "sc_board_cropZoom"],
      ["cropRotate", "Rotate", "sc_board_cropRotate"],
      ["skipCrop", "Skip crop", "sc_board_skipCrop"],
      ["applyCrop", "Apply Crop", "sc_board_applyCrop"],
      ["statusActive", "Active", "sc_board_statusActive"],
      ["statusClaimPending", "Claim pending", "sc_board_statusClaimPending"],
      ["statusClaimInProgress", "Claim in progress", "sc_board_statusClaimInProgress"],
      ["statusAwaiting", "Awaiting confirmation", "sc_board_statusAwaiting"],
      ["statusDisputed", "Disputed", "sc_board_statusDisputed"],
      ["confirmDeleteReport", "permanently?", "sc_board_confirmDeleteReport"],
      ["confirmDismissDispute", "Dismiss dispute? Item returns to claim_accepted status.", "sc_board_confirmDismissDispute"],
      ["confirmResolveDispute", "Resolve for claimant? Item will be permanently deleted.", "sc_board_confirmResolveDispute"],
      ["cannotDeleteHandoff", "Cannot delete while handoff or dispute is in progress.", "sc_board_cannotDeleteHandoff"],
      ["confirmDeleteItem", "Delete this item permanently?", "sc_board_confirmDeleteItem"],
      ["confirmDeleteWithClaimsPre", "student(s) have claimed this item. Deleting will notify them. Continue?", "sc_board_confirmDeleteWithClaimsPre"],
      ["confirmDeleteWithClaimsPost", "student(s) have claimed this item. Deleting will notify them. Continue?", "sc_board_confirmDeleteWithClaimsPost"],
      ["confirmDeleteAcceptedPre", "You accepted", "sc_board_confirmDeleteAcceptedPre"],
      ["confirmDeleteAcceptedPost", "'s claim. Deleting cancels it. Continue?", "sc_board_confirmDeleteAcceptedPost"],
      ["confirmDeleteLostItem", "Delete this lost item report?", "sc_board_confirmDeleteLostItem"],
      ["claimCancelledMsg", "This claim can no longer be cancelled.", "sc_board_claimCancelledMsg"],
      ["categoryLabel", "Category", "sc_board_categoryLabel"],
      ["selectCategory", "Select a category", "sc_board_selectCategory"],
      ["whereFound", "Where was it found?", "sc_board_whereFound"],
      ["dateFoundLabel", "Date Found", "sc_board_dateFoundLabel"],
      ["whereFoundPlaceholder", "e.g. Room 204, near the gym, front office...", "sc_board_whereFoundPlaceholder"],
      ["lastSeenWhere", "Last seen where?", "sc_board_lastSeenWhere"],
      ["dateLostLabel", "Date Lost", "sc_board_dateLostLabel"],
      ["lastSeenPlaceholder", "e.g. Cafeteria, locker room, room 101...", "sc_board_lastSeenPlaceholder"],
      ["schoolMember", "member", "sc_board_schoolMember"],
      ["pendingClaimSingular", "pending claim", "sc_board_pendingClaimSingular"],
      ["pendingClaimPlural", "pending claims", "sc_board_pendingClaimPlural"],
      ["finderHandedOff", "Finder marked as handed off", "sc_board_finderHandedOff"],
      ["failedToPost", "Failed to post lost item:", "sc_board_failedToPost"],
      ["failedToRecord", "Failed to record return:", "sc_board_failedToRecord"],
    ];
    Promise.all(pairs.map(([field, key, cacheKey]) =>
      fetchTranslation(key, language, cacheKey, (val) => setS((prev) => ({ ...prev, [field]: val })))
    )).then(() => setStringsReady(true));
  }, [language, hydrated]);

  if (!isLoaded || loadingSchool || !stringsReady) return <LoadingSpinner />;
  if (!school) return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", gap: 16, fontFamily: "var(--font-body)" }}>
      <p style={{ color: "var(--text-secondary)" }}>{s.schoolNotFound}</p>
      <button onClick={() => router.push("/schools")} style={{ padding: "8px 18px", borderRadius: 8, border: "1.5px solid var(--border-input)", background: "var(--bg-card)", cursor: "pointer", fontFamily: "var(--font-body)", fontWeight: 600, color: "var(--text-secondary)" }}>{s.backToSchools}</button>
    </div>
  );

  return <SchoolBoard school={school} user={user} onBack={() => router.push("/schools")} s={s} />;
}

// ─── SchoolBoard ───────────────────────────────────────────────────────────────
//main board view for a specific school: items, post form, leaderboard, admin tabs, and inbox
function SchoolBoard({ school, user, onBack, s }: { school: School; user: any; onBack: () => void; s: BoardStrings }) {
  type BoardTab = "items" | "add-item" | "my-dash" | "leaderboard" | "admin-login" | "reports" | "inbox";

  const router = useRouter();
  const { language, hydrated } = useSettings();
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const color = school.color;
  const color2 = school.secondary_color ?? "#f5c842";
  const textOn = textOnColor(color);
  const gradOverlay = gradStyles(color)[school.gradient_mode ?? 0];
  const hasBg = !!school.bg_image_url;

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState<BoardTab>("items");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [addMode, setAddMode] = useState<"found" | "lost">("found");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const hasActiveFilters = !!filterCategory || !!filterDateFrom || !!filterDateTo;
  const clearFilters = () => { setFilterCategory(""); setFilterDateFrom(""); setFilterDateTo(""); };

  const [items, setItems] = useState<SchoolItem[]>([]);
  const [lostItems, setLostItems] = useState<SchoolLostItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  // My Dashboard state
  const [myActiveClaims, setMyActiveClaims] = useState<any[]>([]);
  const [activeClaimsLoading, setActiveClaimsLoading] = useState(false);
  const [myReturnedItems, setMyReturnedItems] = useState<any[]>([]);
  const [totalReturnedByMe, setTotalReturnedByMe] = useState(0);
  const [myItemClaims, setMyItemClaims] = useState<Record<number, number>>({});
  const [leaderboard, setLeaderboard] = useState<{ author_id: string; author_name: string; count: number }[]>([]);
  const [leaderboardLoading, setLeaderboardLoading] = useState(false);

  // Admin state
  const [adminId, setAdminId] = useState("");
  const [adminName, setAdminName] = useState("Admin");
  const [reportsSubTab, setReportsSubTab] = useState<"reports" | "disputes">("reports");

  useEffect(() => {
    const isAdmin = localStorage.getItem(`finder_school_admin_${school.id}`) === "true";
    setIsSchoolAdmin(isAdmin);
    if (isAdmin) {
      setAdminId(user?.id ?? "");
      setAdminName(user?.fullName || user?.username || "Admin");
    }
  }, [school.id, user]);

  // ── Lock page scroll while the board is open ─────────────────────────────────
  // The board is a full-viewport view: the sidebar stays fixed and only
  // .sc-board__main scrolls. Locking body overflow stops the whole page (and the
  // sidebar with it) from scrolling when the wheel is over the sidebar.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ── Fetch items ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const cached = readSchoolBoardCache(school.id);
    if (cached) { setItems(cached.found); setLostItems(cached.lost); setLoadingItems(false); }
    else setLoadingItems(true);

    const fetch = async () => {
      const [{ data: found }, { data: lost }] = await Promise.all([
        supabase.from("school_items").select("*").eq("school_id", school.id).order("created_at", { ascending: false }),
        supabase.from("school_lost_items").select("*").eq("school_id", school.id).order("created_at", { ascending: false }),
      ]);
      const nf = (found ?? []) as SchoolItem[];
      const nl = (lost ?? []) as SchoolLostItem[];
      setItems(nf); setLostItems(nl);
      writeSchoolBoardCache(school.id, nf, nl);
      setLoadingItems(false);
    };
    fetch();
  }, [school.id]);

  // ── Translate categories ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setCatMap({}); return; }
    const unique = [...new Set([...CATEGORIES, ...items.map((i) => i.category), ...lostItems.map((i) => i.category)].filter(Boolean))] as string[];
    // Apply cached translations immediately.
    const initial: Record<string, string> = {};
    for (const cat of unique) {
      const cached = localStorage.getItem(`t:${language}:${cat}`);
      if (cached) initial[cat] = cached;
    }
    setCatMap(initial);
    const missing = unique.filter((cat) => !initial[cat]);
    if (missing.length === 0) return;
    Promise.all(missing.map(async (cat) => {
      const lsKey = `t:${language}:${cat}`;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: cat, target: language }) });
        if (res.ok) {
          const data = await res.json();
          const t = (data.translatedText as string | undefined)?.trim() || cat;
          localStorage.setItem(lsKey, t);
          return [cat, t] as [string, string];
        }
      } catch {}
      return [cat, cat] as [string, string];
    })).then((pairs) => setCatMap((prev) => ({ ...prev, ...Object.fromEntries(pairs) })));
  }, [language, hydrated, items.length, lostItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Translate item content (name, description, location) ────────────────────
  const [contentMap, setContentMap] = useState<Record<string, { name: string; description: string; location: string }>>({});
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setContentMap({}); return; }
    const allItems = [
      ...items.map((i) => ({ k: `f_${i.id}`, id: i.id, t: "f", name: i.name || "", description: i.description || "", location: i.location || "" })),
      ...lostItems.map((i) => ({ k: `l_${i.id}`, id: i.id, t: "l", name: i.name || "", description: i.description || "", location: i.location || "" })),
    ];
    if (allItems.length === 0) return;
    const tx = async (text: string, cacheKey: string) => {
      if (!text) return text;
      const cached = localStorage.getItem(cacheKey);
      if (cached) return cached;
      try {
        const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, target: language }) });
        const data = await res.json();
        const t = (data.translatedText as string | undefined)?.trim() || text;
        localStorage.setItem(cacheKey, t);
        return t;
      } catch { return text; }
    };
    const newMap: Record<string, { name: string; description: string; location: string }> = {};
    Promise.all(allItems.map(async (item) => {
      const p = `sb_${item.t}_${item.id}`;
      const [name, description, location] = await Promise.all([
        tx(item.name, `${p}_name_${language}`),
        tx(item.description, `${p}_desc_${language}`),
        tx(item.location, `${p}_loc_${language}`),
      ]);
      newMap[item.k] = { name, description, location };
    })).then(() => setContentMap({ ...newMap }));
  }, [language, hydrated, items.length, lostItems.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── My active claims (as claimant) ──────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    setActiveClaimsLoading(true);
    (async () => {
      const { data: claims } = await supabase.from("school_claim_requests")
        .select("*").eq("claimant_id", user.id).eq("school_id", school.id).in("status", ["pending", "accepted"]);
      if (claims && claims.length > 0) {
        const itemIds = [...new Set(claims.map((c: any) => c.item_id))];
        const { data: claimItems } = await supabase.from("school_items").select("id, name, status").in("id", itemIds);
        const itemMap = new Map((claimItems || []).map((i: any) => [i.id, i]));
        setMyActiveClaims(claims
          .filter((c: any) => { const st = itemMap.get(c.item_id)?.status; return st && st !== "returned"; })
          .map((c: any) => ({ ...c, item_name: itemMap.get(c.item_id)?.name || "Unknown item", item_status: itemMap.get(c.item_id)?.status || "unknown" }))
        );
      } else { setMyActiveClaims([]); }
      setActiveClaimsLoading(false);
    })();
  }, [user?.id, school.id]);

  // ── Returned items count ─────────────────────────────────────────────────────
  // Also depends on items.length so it re-fetches when an item is removed (returned),
  // keeping totalReturnedByMe in sync with the DB even when the return is triggered
  // from the school-items detail page rather than directly from this board.
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const { data, count } = await supabase.from("school_returned_items")
        .select("*", { count: "exact" }).eq("author_id", user.id).eq("school_id", school.id);
      setTotalReturnedByMe(count ?? 0);
      setMyReturnedItems(data ?? []);
    })();
  }, [user?.id, school.id, items.length]);

  // ── Leaderboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (activeTab !== "leaderboard") return;
    setLeaderboardLoading(true);
    (async () => {
      const { data } = await supabase.from("school_returned_items")
        .select("author_id, author_name").eq("school_id", school.id);
      if (data) {
        const counts: Record<string, { author_id: string; author_name: string; count: number }> = {};
        for (const row of data) {
          if (!counts[row.author_id]) counts[row.author_id] = { author_id: row.author_id, author_name: row.author_name || "Anonymous", count: 0 };
          counts[row.author_id].count++;
        }
        setLeaderboard(Object.values(counts).sort((a, b) => b.count - a.count));
      }
      setLeaderboardLoading(false);
    })();
  }, [activeTab, school.id]);

  // ── Pending claim counts on my found items ───────────────────────────────────
  useEffect(() => {
    if (!user?.id) return;
    const myFoundIds = items.filter((i) => i.author_id === user.id).map((i) => i.id);
    if (myFoundIds.length === 0) { setMyItemClaims({}); return; }
    (async () => {
      const { data } = await supabase.from("school_claim_requests")
        .select("item_id").in("item_id", myFoundIds).eq("status", "pending");
      const counts: Record<number, number> = {};
      for (const row of data || []) counts[row.item_id] = (counts[row.item_id] || 0) + 1;
      setMyItemClaims(counts);
    })();
  }, [user?.id, items]);

  // ── Found form state ─────────────────────────────────────────────────────────
  const [foundName, setFoundName] = useState("");
  const [foundDesc, setFoundDesc] = useState("");
  const [foundCategory, setFoundCategory] = useState("");
  const [foundLocation, setFoundLocation] = useState("");
  const [foundDate, setFoundDate] = useState("");
  const [foundFiles, setFoundFiles] = useState<File[]>([]);
  const [foundUploading, setFoundUploading] = useState(false);
  const [foundSuccess, setFoundSuccess] = useState(false);
  const [foundCropQueue, setFoundCropQueue] = useState<File[]>([]);
  const [foundCropIndex, setFoundCropIndex] = useState(0);
  const [foundCropSrc, setFoundCropSrc] = useState<string | null>(null);
  const [foundCropResults, setFoundCropResults] = useState<File[]>([]);
  const [foundExistingFiles, setFoundExistingFiles] = useState<File[]>([]);

  // ── Lost form state ──────────────────────────────────────────────────────────
  const [lostName, setLostName] = useState("");
  const [lostDesc, setLostDesc] = useState("");
  const [lostCategory, setLostCategory] = useState("");
  const [lostLocation, setLostLocation] = useState("");
  const [lostDate, setLostDate] = useState("");
  const [lostFiles, setLostFiles] = useState<File[]>([]);
  const [lostUploading, setLostUploading] = useState(false);
  const [lostSuccess, setLostSuccess] = useState(false);
  const [lostCropQueue, setLostCropQueue] = useState<File[]>([]);
  const [lostCropIndex, setLostCropIndex] = useState(0);
  const [lostCropSrc, setLostCropSrc] = useState<string | null>(null);
  const [lostCropResults, setLostCropResults] = useState<File[]>([]);
  const [lostExistingFiles, setLostExistingFiles] = useState<File[]>([]);

  // ── Admin login ──────────────────────────────────────────────────────────────
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const BOARD_TABS: { id: BoardTab; label: string; icon?: React.ReactNode }[] = [
    { id: "items",      label: s.itemsTab,    icon: <HiOutlineMagnifyingGlass style={{ fontSize: 20 }} /> },
    { id: "add-item",   label: s.addItemTab,  icon: <FaPlus style={{ fontSize: 11 }} /> },
    { id: "my-dash",     label: s.myDashTab,    icon: <FaClipboard style={{ fontSize: 13 }} /> },
    { id: "leaderboard", label: s.leaderboardTab, icon: <FaTrophy style={{ fontSize: 14 }} /> },
    { id: "admin-login", label: s.adminTab,       icon: <CiLogin style={{ fontSize: 20 }} /> },
    ...(isSchoolAdmin ? [
      { id: "reports" as BoardTab, label: s.reportsTab,  icon: <MdFlagCircle style={{ fontSize: 20 }} /> },
      { id: "inbox" as BoardTab,   label: s.inboxTab,    icon: <MdOutlineMessage style={{ fontSize: 20 }} /> },
    ] : []),
  ];

  // ── Crop helpers ─────────────────────────────────────────────────────────────
  const startFoundCropQueue = (files: File[]) => {
    setFoundExistingFiles(foundFiles);
    setFoundCropResults([]); setFoundCropQueue(files); setFoundCropIndex(0);
    setFoundCropSrc(URL.createObjectURL(files[0]));
  };
  const advanceFoundCrop = (results: File[], queue: File[], idx: number) => {
    URL.revokeObjectURL(foundCropSrc!);
    if (idx + 1 < queue.length) { setFoundCropResults(results); setFoundCropIndex(idx + 1); setFoundCropSrc(URL.createObjectURL(queue[idx + 1])); }
    else { setFoundFiles([...foundExistingFiles, ...results]); setFoundCropSrc(null); setFoundCropQueue([]); setFoundCropResults([]); setFoundExistingFiles([]); }
  };
  const handleFoundCropConfirm = async (pixels: { x: number; y: number; width: number; height: number }, rotation: number) => {
    if (!foundCropSrc) return;
    const cropped = await getCroppedImg(foundCropSrc, pixels, rotation);
    advanceFoundCrop([...foundCropResults, cropped], foundCropQueue, foundCropIndex);
  };
  const handleFoundCropSkip = () => {
    if (!foundCropSrc) return;
    advanceFoundCrop([...foundCropResults, foundCropQueue[foundCropIndex]], foundCropQueue, foundCropIndex);
  };

  const startLostCropQueue = (files: File[]) => {
    setLostExistingFiles(lostFiles);
    setLostCropResults([]); setLostCropQueue(files); setLostCropIndex(0);
    setLostCropSrc(URL.createObjectURL(files[0]));
  };
  const advanceLostCrop = (results: File[], queue: File[], idx: number) => {
    URL.revokeObjectURL(lostCropSrc!);
    if (idx + 1 < queue.length) { setLostCropResults(results); setLostCropIndex(idx + 1); setLostCropSrc(URL.createObjectURL(queue[idx + 1])); }
    else { setLostFiles([...lostExistingFiles, ...results]); setLostCropSrc(null); setLostCropQueue([]); setLostCropResults([]); setLostExistingFiles([]); }
  };
  const handleLostCropConfirm = async (pixels: { x: number; y: number; width: number; height: number }, rotation: number) => {
    if (!lostCropSrc) return;
    const cropped = await getCroppedImg(lostCropSrc, pixels, rotation);
    advanceLostCrop([...lostCropResults, cropped], lostCropQueue, lostCropIndex);
  };
  const handleLostCropSkip = () => {
    if (!lostCropSrc) return;
    advanceLostCrop([...lostCropResults, lostCropQueue[lostCropIndex]], lostCropQueue, lostCropIndex);
  };

  // ── AI keyword extraction (reuses /api/image-search → GROQ_API_KEY) ──────────
  const extractKeywords = async (file: File): Promise<string> => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const res = await fetch("/api/image-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mimeType: file.type }),
      });
      if (!res.ok) return "";
      const { keywords } = await res.json();
      return keywords ?? "";
    } catch {
      return "";
    }
  };

  // ── Submit found ─────────────────────────────────────────────────────────────
  const handleAddFound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !foundName || !foundDesc) return;
    setFoundUploading(true);
    const imageUrls: string[] = [];
    const aiKeywordsArray: string[] = [];
    for (const file of foundFiles.slice(0, 3)) {
      const fn = `school_${school.id}_${Date.now()}_${file.name}`;
      await supabase.storage.from("item-images").upload(fn, file);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      imageUrls.push(data.publicUrl);
      const keywords = await extractKeywords(file);
      if (keywords) aiKeywordsArray.push(keywords);
    }
    const { data: inserted } = await supabase.from("school_items").insert({
      school_id: school.id, name: foundName, description: foundDesc,
      category: foundCategory || null, location: foundLocation || null,
      date_found: foundDate ? new Date(foundDate).toISOString() : new Date().toISOString(),
      image_url: imageUrls[0] || null, image_urls: imageUrls.length > 0 ? imageUrls : null,
      author_name: user.fullName || user.username || "Anonymous",
      author_avatar: user.imageUrl, author_id: user.id,
      author_email: user.primaryEmailAddress?.emailAddress, status: "waiting",
      ai_keywords: aiKeywordsArray.length > 0 ? aiKeywordsArray.join(", ") : null,
    }).select().single();
    if (inserted) setItems((prev) => [inserted as SchoolItem, ...prev]);
    setFoundName(""); setFoundDesc(""); setFoundCategory(""); setFoundLocation(""); setFoundDate(""); setFoundFiles([]); setFoundExistingFiles([]);
    setFoundSuccess(true);
    setTimeout(() => { setFoundSuccess(false); setActiveTab("items"); }, 1500);
    setFoundUploading(false);
  };

  // ── Submit lost ──────────────────────────────────────────────────────────────
  const handleAddLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !lostName || !lostDesc) return;
    setLostUploading(true);
    const imageUrls: string[] = [];
    for (const file of lostFiles.slice(0, 3)) {
      const fn = `school_lost_${school.id}_${Date.now()}_${file.name}`;
      await supabase.storage.from("item-images").upload(fn, file);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      imageUrls.push(data.publicUrl);
    }
    const { data: inserted, error: insertError } = await supabase.from("school_lost_items").insert({
      school_id: school.id, name: lostName, description: lostDesc,
      category: lostCategory || null, location: lostLocation || null,
      image_url: imageUrls[0] || null, image_urls: imageUrls.length > 0 ? imageUrls : null,
      author_name: user.fullName || user.username || "Anonymous",
      author_avatar: user.imageUrl, author_id: user.id,
      author_email: user.primaryEmailAddress?.emailAddress, status: "looking",
    }).select().single();
    if (insertError) {
      console.error("Lost item insert error:", insertError.message);
      alert(`${s.failedToPost} ${insertError.message}`);
      setLostUploading(false);
      return;
    }
    if (inserted) setLostItems((prev) => [inserted as SchoolLostItem, ...prev]);
    setLostName(""); setLostDesc(""); setLostCategory(""); setLostLocation(""); setLostDate(""); setLostFiles([]); setLostExistingFiles([]);
    setLostSuccess(true);
    setTimeout(() => { setLostSuccess(false); setActiveTab("items"); setBoardTab("lost"); }, 1500);
    setLostUploading(false);
  };

  // ── Admin login ──────────────────────────────────────────────────────────────
  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminChecking(true); setAdminError("");
    const { data: schoolRow } = await supabase.from("schools").select("password").eq("id", school.id).maybeSingle();
    if (!schoolRow?.password || schoolRow.password !== adminPassword) {
      setAdminError(s.adminIncorrect);
    } else {
      localStorage.setItem(`finder_school_admin_${school.id}`, "true");
      setIsSchoolAdmin(true); setAdminUnlocked(true);
      setAdminId(user?.id ?? "");
      setAdminName(user?.fullName || user?.username || "Admin");
      if (user) {
        const email = user.primaryEmailAddress?.emailAddress ?? "";
        const { data: existing } = await supabase.from("school_admins").select("id").eq("school_id", school.id).eq("user_email", email).maybeSingle();
        if (existing) {
          supabase.from("school_admins").update({ user_id: user.id, name: user.fullName ?? null }).eq("id", existing.id).then(() => {});
        } else {
          supabase.from("school_admins").insert({ school_id: school.id, user_email: email, user_id: user.id, user_name: user.fullName ?? user.username ?? email, name: user.fullName ?? null, password: adminPassword }).then(() => {});
        }
      }
    }
    setAdminChecking(false);
  };

  // ── Found item actions (finder perspective) ──────────────────────────────────
  const handleDeleteFound = async (e: React.MouseEvent, item: SchoolItem) => {
    e.stopPropagation();
    if (item.status === "handed_off" || item.status === "disputed") {
      alert(s.cannotDeleteHandoff); return;
    }
    const { data: allClaims } = await supabase.from("school_claim_requests").select("*").eq("item_id", item.id);
    const pendingClaims = (allClaims || []).filter((c: any) => c.status === "pending");
    const hasActive = (allClaims || []).some((c: any) => c.status === "pending" || c.status === "accepted");

    if (!hasActive) {
      if (!confirm(s.confirmDeleteItem)) return;
    } else if (item.status === "waiting" && pendingClaims.length > 0) {
      if (!confirm(`${pendingClaims.length} ${s.confirmDeleteWithClaimsPre}`)) return;
      for (const c of pendingClaims) {
        sendEmail("claim-rejected", { claimant_email: c.claimant_email, claimant_name: c.claimant_name, item_name: item.name, rejection_reason: "The item was removed by the finder." });
      }
    } else if (item.status === "claim_accepted") {
      if (!confirm(`${s.confirmDeleteAcceptedPre} ${item.accepted_claimant_name}${s.confirmDeleteAcceptedPost}`)) return;
      if (item.accepted_claimant_email) {
        sendEmail("claim-rejected", { claimant_email: item.accepted_claimant_email, claimant_name: item.accepted_claimant_name ?? "", item_name: item.name, rejection_reason: "The item listing was removed by the finder after your claim was accepted." });
      }
    }
    await supabase.from("school_items").delete().eq("id", item.id);
    setItems((prev) => prev.filter((i) => i.id !== item.id));
  };

  const handleConfirmHandoff = async (itemId: number) => {
    if (!user?.id) return;
    const { data: fresh } = await supabase.from("school_items").select("*").eq("id", itemId).maybeSingle();
    if (!fresh) return;
    const isFinderConfirming = fresh.author_id === user.id;
    const updatedPoster = isFinderConfirming ? true : fresh.handoff_confirmed_by_poster;
    const updatedClaimant = !isFinderConfirming ? true : fresh.handoff_confirmed_by_claimant;
    const bothConfirmed = updatedPoster && updatedClaimant;

    if (bothConfirmed) {
      // Record in school_returned_items
      const { error: insertError } = await supabase.from("school_returned_items").insert({
        school_id: school.id,
        original_item_id: itemId,
        author_id: fresh.author_id,
        author_name: fresh.author_name,
        item_name: fresh.name,
        returned_by_id: fresh.accepted_claimant_id,
        date_found: fresh.date_found,
        returned_at: new Date().toISOString(),
        snapshot: fresh,
      });
      if (insertError) {
        console.error("school_returned_items insert failed:", insertError);
        alert(`${s.failedToRecord} ${insertError.message}`);
        return;
      }
      await supabase.from("school_items").delete().eq("id", itemId);
      setItems((prev) => prev.filter((i) => i.id !== itemId));
      setTotalReturnedByMe((prev) => prev + 1);
      setMyReturnedItems((prev) => [...prev, { id: itemId, returned_at: new Date().toISOString(), date_found: fresh.date_found }]);
    } else {
      await supabase.from("school_items").update({
        handoff_confirmed_by_poster: updatedPoster,
        handoff_confirmed_by_claimant: updatedClaimant,
        status: "handed_off",
      }).eq("id", itemId);
      setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status: "handed_off", handoff_confirmed_by_poster: updatedPoster, handoff_confirmed_by_claimant: updatedClaimant } : i));
    }
  };

  const handleDeleteLost = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm(s.confirmDeleteLostItem)) return;
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleMarkLostFound = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCancelClaim = async (claimId: string, itemId: number) => {
    const { data: freshItem } = await supabase.from("school_items").select("status").eq("id", itemId).maybeSingle();
    if (!freshItem || freshItem.status !== "waiting") { alert(s.claimCancelledMsg); return; }
    await supabase.from("school_claim_requests").update({ status: "cancelled", updated_at: new Date().toISOString() }).eq("id", claimId);
    setMyActiveClaims((prev) => prev.filter((c) => c.id !== claimId));
  };

  const handleReportDeleteItem = (itemId: number) => setItems((prev) => prev.filter((i) => i.id !== itemId));
  const handleDisputeRestoreItem = (itemId: number, status: string) => {
    if (status === "claimed") setItems((prev) => prev.filter((i) => i.id !== itemId));
    else setItems((prev) => prev.map((i) => i.id === itemId ? { ...i, status } : i));
  };

  // ── Filtering ────────────────────────────────────────────────────────────────
  const applyFilters = <T extends { name: string; description: string; date_found?: string; created_at: string; category?: string | null }>(list: T[]): T[] =>
    list.filter((item) => {
      if (filterCategory && (item.category ?? "") !== filterCategory) return false;
      if (filterDateFrom) { const d = item.date_found || item.created_at; if (!d || new Date(d) < new Date(filterDateFrom)) return false; }
      if (filterDateTo) { const d = item.date_found || item.created_at; if (!d || new Date(d) > new Date(filterDateTo + "T23:59:59")) return false; }
      return true;
    });

  const baseFound = searchQuery.trim() ? items.filter((i) => `${i.name} ${i.description} ${i.ai_keywords ?? ""}`.toLowerCase().includes(searchQuery.toLowerCase())) : items;
  const baseLost = searchQuery.trim() ? lostItems.filter((i) => `${i.name} ${i.description}`.toLowerCase().includes(searchQuery.toLowerCase())) : lostItems;
  const filteredFound = applyFilters(baseFound as any) as SchoolItem[];
  const filteredLost = applyFilters(baseLost as any) as SchoolLostItem[];

  // ── My Dashboard data ────────────────────────────────────────────────────────
  const myFoundItems = items.filter((i) => i.author_id === user?.id && i.status !== "claimed");
  const myLostItemsList = lostItems.filter((i) => i.author_id === user?.id);
  const totalFound = myFoundItems.length + totalReturnedByMe;
  const totalLost = myLostItemsList.length;
  const totalActions = totalFound + totalLost + totalReturnedByMe;

  const xp = totalReturnedByMe * 100 + totalFound * 20 + totalLost * 5;
  const userLevel = xp >= 1000 ? "Legend" : xp >= 600 ? "Champion" : xp >= 300 ? "Finder" : xp >= 100 ? "Helper" : "Newcomer";
  const xpNext = xp >= 1000 ? null : xp >= 600 ? 1000 : xp >= 300 ? 600 : xp >= 100 ? 300 : 100;
  const xpPrev = xp >= 1000 ? 600 : xp >= 600 ? 600 : xp >= 300 ? 300 : xp >= 100 ? 100 : 0;
  const xpPct = xpNext !== null ? Math.min(100, Math.round(((xp - xpPrev) / (xpNext - xpPrev)) * 100)) : 100;

  const now = new Date();
  const months: string[] = [];
  const monthLabels: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    monthLabels.push(d.toLocaleString("default", { month: "short" }));
  }
  const foundByMonth = months.map((m) => {
    const active = items.filter((i) => i.author_id === user?.id && i.status !== "claimed" && (i.date_found || i.created_at || "").startsWith(m)).length;
    const returned = myReturnedItems.filter((i) => (i.date_found || "").startsWith(m)).length;
    return active + returned;
  });
  const lostByMonth = months.map((m) => lostItems.filter((i) => i.author_id === user?.id && (i.created_at || "").startsWith(m)).length);
  const returnedByMonth = months.map((m) => myReturnedItems.filter((i) => (i.returned_at || i.date_found || "").startsWith(m)).length);

  const clrFound = color || "#2f80ed";
  const clrLost = "#ef4444";
  const clrReturned = "#10b981";
  const chartKey = `school-${school.id}-${user?.id}-${totalActions}-${totalReturnedByMe}`;

  const AddItemToggle = () => (
    <div className="sc-mode-toggle">
      {(["found", "lost"] as const).map((mode) => (
        <button key={mode} type="button" className={`sc-mode-toggle__btn${addMode === mode ? " sc-mode-toggle__btn--active" : ""}`} onClick={() => setAddMode(mode)}>
          {mode === "found" ? s.toggleFound : s.toggleLost}
        </button>
      ))}
    </div>
  );

  return (
    <div className="sc-board" style={{ "--sc-color": color, "--sc-color-2": color2, "--sc-text-on-color": textOn, ...(hasBg ? { backgroundImage: `url("${school.bg_image_url}")` } : {}) } as React.CSSProperties}>

      {/* ── Header ── */}
      <div className="sc-board__header">
        <button className="sc-board__back" onClick={onBack}>{s.backBtn}</button>
        <div className="sc-board__identity">
          {school.logo_url
            ? <img src={school.logo_url} alt={school.name} className="sc-board__logo" />
            : <div className="sc-board__initial" style={{ background: color }}>{school.name[0]}</div>}
          <div className="sc-board__name-block">
            <p className="sc-board__name">{school.name}</p>
            <span className="sc-board__code">{school.code}</span>
          </div>
        </div>
        {isSchoolAdmin && (
          <div className="sc-admin-badge" style={{ background: hexToRgba(color2, 0.2), borderColor: color2 }}>
            {s.adminBadge}
            <button className="sc-admin-badge__exit" onClick={() => {
              localStorage.removeItem(`finder_school_admin_${school.id}`);
              setIsSchoolAdmin(false);
              if (activeTab === "reports" || activeTab === "inbox") setActiveTab("items");
            }}>{s.exitAdmin}</button>
          </div>
        )}
      </div>

      {/* ── Layout ── */}
      <div className="sc-board__layout">
        <aside className="sc-board__sidebar">
          {BOARD_TABS.map((tab) => (
            <button key={tab.id} className={`sc-board__tab${activeTab === tab.id ? " sc-board__tab--active" : ""}`} style={activeTab === tab.id ? { background: `${color}22`, color } : {}} onClick={() => setActiveTab(tab.id)}>
              {tab.icon && <span className="sc-board__tab-icon" aria-hidden="true">{tab.icon}</span>}
              <span className="sc-board__tab-label">{tab.label}</span>
              {activeTab === tab.id && <span className="sc-board__tab-pip" style={{ background: color2 }} />}
            </button>
          ))}
        </aside>

        <main className="sc-board__main" style={hasBg ? { backgroundImage: `${gradOverlay}, url("${school.bg_image_url}")`, backgroundSize: "cover", backgroundPosition: "center" } : {}}>

          {/* ══════════════════════════════════════════════════════════════════
              ITEMS TAB
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "items" && (
            <>
              {/* Search + Filter bar */}
              <div style={{ marginBottom: 16, background: `color-mix(in srgb, ${color}08, var(--bg-card))`, border: `1.5px solid color-mix(in srgb, ${color} 18%, var(--border-default))`, borderRadius: 16, padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10, backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" }}>
                <div className="sc-search-wrap" style={{ maxWidth: "100%" }}>
                  <input className="sc-search" placeholder={s.searchPlaceholder} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ maxWidth: "100%", fontStyle: "bold" }} />
                  {searchQuery && <button className="sc-search__clear" onClick={() => setSearchQuery("")}>×</button>}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: 8, alignItems: "center" }}>
                  <div style={{ position: "relative" }}>
                    <select className="sc-board-filter-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} style={{ width: "100%", padding: "8px 28px 8px 10px", borderRadius: 8, border: "1.5px solid var(--border-input)", background: filterCategory ? color : "var(--bg-input)", color: filterCategory ? textOn : "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, cursor: "pointer", appearance: "none", WebkitAppearance: "none", outline: "none", transition: "all 0.15s ease", boxSizing: "border-box" }}>
                      <option value="">{s.filterCategory}</option>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat} style={{ background: "var(--bg-input)", color: "var(--text-primary)" }}>{catMap[cat] || cat}</option>)}
                    </select>
                    <FaChevronDown style={{ position: "absolute", right: 9, top: "50%", transform: "translateY(-50%)", color: filterCategory ? "rgba(255,255,255,0.7)" : "var(--text-muted)", fontSize: 10, pointerEvents: "none" }} />
                  </div>
                  {[filterDateFrom, filterDateTo].map((val, i) => (
                    <input key={i} type="date" value={val} onChange={(e) => i === 0 ? setFilterDateFrom(e.target.value) : setFilterDateTo(e.target.value)} title={i === 0 ? s.filterDateFrom : s.filterDateTo} style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1.5px solid var(--border-input)", background: val ? color : "var(--bg-input)", color: val ? textOn : "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, outline: "none", transition: "all 0.15s ease", boxSizing: "border-box" }} />
                  ))}
                  <button onClick={clearFilters} disabled={!hasActiveFilters} style={{ padding: "8px 12px", borderRadius: 8, border: "1.5px solid var(--border-input)", background: hasActiveFilters ? "var(--danger)" : "var(--bg-input)", color: hasActiveFilters ? "#fff" : "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, cursor: hasActiveFilters ? "pointer" : "not-allowed", opacity: hasActiveFilters ? 1 : 0.45, transition: "all 0.15s ease", whiteSpace: "nowrap" }}>
                    {s.clearFilters}
                  </button>
                </div>
                {hasActiveFilters && (
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {filterCategory && <span onClick={() => setFilterCategory("")} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: `${color}22`, border: `1px solid ${color}`, color, fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{catMap[filterCategory] || filterCategory} <span style={{ opacity: 0.7 }}>×</span></span>}
                    {(filterDateFrom || filterDateTo) && <span onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }} style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 100, background: `${color}22`, border: `1px solid ${color}`, color, fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 600, cursor: "pointer" }}>{filterDateFrom || "..."} to {filterDateTo || "..."} <span style={{ opacity: 0.7 }}>×</span></span>}
                  </div>
                )}
              </div>

              {/* Found / Lost tabs */}
              <div className="sc-tabs-row">
                {(["found", "lost"] as const).map((t) => (
                  <button key={t} className={`sc-tab-btn${boardTab === t ? " sc-tab-btn--active" : ""}`} style={boardTab === t ? { color: textOnColor(color2) } : undefined} onClick={() => setBoardTab(t)}>
                    {t === "found" ? `${s.foundTabLabel} (${filteredFound.filter((i) => i.status !== "claimed").length})` : `${s.lostTabLabel} (${filteredLost.length})`}
                  </button>
                ))}
              </div>

              {loadingItems ? <div className="sc-empty">{s.loadingText}</div> : boardTab === "found" ? (
                <div className="sc-items-grid">
                  {filteredFound.filter((i) => i.status !== "claimed").map((item) => (
                    <div key={item.id} className="sc-item-card sc-item-card--clickable" onClick={() => router.push(`/school-items/${item.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/school-items/${item.id}`); }}>
                      <div className="sc-item-card__img-wrap">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="sc-item-card__img" /> : <div className="sc-item-card__no-img">{s.noImage}</div>}
                      </div>
                      <div className="sc-item-card__info">
                        <p className="sc-item-card__name">{contentMap[`f_${item.id}`]?.name || item.name}</p>
                        {item.category && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>🏷️ {catMap[item.category] || item.category}</span>}
                        <div className="sc-item-card__by">
                          {item.author_avatar && <img src={item.author_avatar} className="sc-item-card__by-avatar" alt="" />}
                          <span>{s.foundBy} {item.author_name}</span>
                        </div>
                        {item.status === "pending" && <span className="sc-item-card__status sc-item-card__status--pending">{s.claimPending}</span>}
                        {item.status === "claim_accepted" && <span className="sc-item-card__status" style={{ color: "var(--warning)", fontWeight: 700 }}>{s.statusClaimInProgress}</span>}
                        {item.status === "handed_off" && <span className="sc-item-card__status" style={{ color: "var(--text-muted)", fontWeight: 700 }}>{s.statusAwaiting}</span>}
                        {item.status === "disputed" && <span className="sc-item-card__status" style={{ color: "var(--danger)", fontWeight: 700 }}>{s.statusDisputed}</span>}
                      </div>
                    </div>
                  ))}
                  {filteredFound.filter((i) => i.status !== "claimed").length === 0 && <div className="sc-empty">{s.noFoundItems}</div>}
                </div>
              ) : (
                <div className="sc-items-grid">
                  {filteredLost.map((item) => (
                    <div key={item.id} className="sc-item-card sc-item-card--clickable" onClick={() => router.push(`/school-lost-items/${item.id}`)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") router.push(`/school-lost-items/${item.id}`); }}>
                      <div className="sc-item-card__img-wrap">
                        {item.image_url ? <img src={item.image_url} alt={item.name} className="sc-item-card__img" /> : <div className="sc-item-card__no-img">{s.noImage}</div>}
                      </div>
                      <div className="sc-item-card__info">
                        <p className="sc-item-card__name">{contentMap[`l_${item.id}`]?.name || item.name}</p>
                        {item.category && <span style={{ fontFamily: "var(--font-body)", fontSize: "0.72rem", color: "var(--text-muted)", fontWeight: 500 }}>🏷️ {catMap[item.category] || item.category}</span>}
                        <div className="sc-item-card__by">
                          {item.author_avatar && <img src={item.author_avatar} className="sc-item-card__by-avatar" alt="" />}
                          <span>{s.lostBy} {item.author_name}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {filteredLost.length === 0 && <div className="sc-empty">{s.noLostItems}</div>}
                </div>
              )}
            </>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ADD ITEM TAB
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "add-item" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{addMode === "found" ? s.reportFoundTitle : s.reportLostTitle}</div>
              <AddItemToggle />

              {addMode === "found" && (
                foundSuccess ? (
                  <div className="sc-success"><span className="sc-success__icon">✓</span><p>{s.itemPostedMsg}</p></div>
                ) : (
                  <form className="sc-form" onSubmit={handleAddFound}>
                    <label className="sc-form__label">{s.itemNameLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input className="sc-form__input" type="text" placeholder={s.itemNamePlaceholder} required value={foundName} onChange={(e) => setFoundName(e.target.value)} />
                    <label className="sc-form__label">{s.categoryLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <select className="sc-form__input" value={foundCategory} onChange={(e) => setFoundCategory(e.target.value)} style={{ color: foundCategory ? "var(--text-primary)" : "var(--text-muted)", fontSize: "13px", fontWeight: 400 }}>
                      <option value="">{s.selectCategory}</option>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <label className="sc-form__label">{s.descLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <textarea className="sc-form__textarea" placeholder={s.descFoundPlaceholder} required value={foundDesc} onChange={(e) => setFoundDesc(e.target.value)} />
                    <label className="sc-form__label">{s.dateFoundLabel}</label>
                    <input className="sc-form__input" type="date" value={foundDate} onChange={(e) => setFoundDate(e.target.value)} style={{ color: foundDate ? "var(--text-primary)" : "var(--text-muted)", fontSize: "13px", fontWeight: 400 }} />
                    <label className="sc-form__label">{s.photosLabel}</label>
                    <label className="sc-form__file-label" htmlFor="sc-found-upload" style={{ color: foundFiles.length > 0 ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 400 }}>
                      <span className="sc-form__file-icon" style={{ color: "var(--text-muted)" }}>+</span>
                      <span>{foundFiles.length > 0 ? `${foundFiles.length} ${s.photosSelected}` : s.uploadPhotos}</span>
                    </label>
                    <input id="sc-found-upload" className="sc-form__file" type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) { const remaining = 3 - foundFiles.length; if (remaining <= 0) return; const files = Array.from(e.target.files).slice(0, remaining); if (files.length > 0) startFoundCropQueue(files); e.target.value = ""; } }} />
                    {foundFiles.length > 0 && (
                      <div className="sc-form__previews">
                        {foundFiles.map((file, idx) => (
                          <div key={idx} className="sc-form__preview-wrap">
                            <img src={URL.createObjectURL(file)} alt={`preview ${idx + 1}`} className="sc-form__preview" />
                            <button type="button" className="sc-form__preview-remove" onClick={() => setFoundFiles(foundFiles.filter((_, i) => i !== idx))}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="sc-form__actions">
                      <button type="button" className="sc-btn sc-btn--ghost" onClick={() => setActiveTab("items")}>{s.cancelBtn}</button>
                      <button type="submit" className="sc-btn sc-btn--primary" style={{ background: color, borderColor: color }} disabled={foundUploading}>
                        {foundUploading ? s.postingBtn : s.postItemBtn}
                      </button>
                    </div>
                  </form>
                )
              )}

              {addMode === "lost" && (
                lostSuccess ? (
                  <div className="sc-success"><span className="sc-success__icon">✓</span><p>{s.lostPostedMsg}</p></div>
                ) : (
                  <form className="sc-form" onSubmit={handleAddLost}>
                    <label className="sc-form__label">{s.whatLostLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <input className="sc-form__input" type="text" placeholder={s.lostItemPlaceholder} required value={lostName} onChange={(e) => setLostName(e.target.value)} />
                    <label className="sc-form__label">{s.categoryLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <select className="sc-form__input" value={lostCategory} onChange={(e) => setLostCategory(e.target.value)} style={{ color: lostCategory ? "var(--text-primary)" : "var(--text-muted)", fontSize: "13px", fontWeight: 400 }}>
                      <option value="">{s.selectCategory}</option>
                      {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <label className="sc-form__label">{s.descLabel} <span style={{ color: "var(--danger)" }}>*</span></label>
                    <textarea className="sc-form__textarea" placeholder={s.descLostPlaceholder} required value={lostDesc} onChange={(e) => setLostDesc(e.target.value)} />
                    <label className="sc-form__label">{s.dateLostLabel}</label>
                    <input className="sc-form__input" type="date" value={lostDate} onChange={(e) => setLostDate(e.target.value)} style={{ color: lostDate ? "var(--text-primary)" : "var(--text-muted)", fontSize: "13px", fontWeight: 400 }} />
                    <label className="sc-form__label">{s.photosOptionalLabel}</label>
                    <label className="sc-form__file-label" htmlFor="sc-lost-upload" style={{ color: lostFiles.length > 0 ? "var(--text-primary)" : "var(--text-muted)", fontWeight: 400 }}>
                      <span className="sc-form__file-icon" style={{ color: "var(--text-muted)" }}>+</span>
                      <span>{lostFiles.length > 0 ? `${lostFiles.length} ${s.photosSelected}` : s.uploadPhotos}</span>
                    </label>
                    <input id="sc-lost-upload" className="sc-form__file" type="file" accept="image/*" multiple onChange={(e) => { if (e.target.files) { const remaining = 3 - lostFiles.length; if (remaining <= 0) return; const files = Array.from(e.target.files).slice(0, remaining); if (files.length > 0) startLostCropQueue(files); e.target.value = ""; } }} />
                    {lostFiles.length > 0 && (
                      <div className="sc-form__previews">
                        {lostFiles.map((file, idx) => (
                          <div key={idx} className="sc-form__preview-wrap">
                            <img src={URL.createObjectURL(file)} alt={`preview ${idx + 1}`} className="sc-form__preview" />
                            <button type="button" className="sc-form__preview-remove" onClick={() => setLostFiles(lostFiles.filter((_, i) => i !== idx))}>×</button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="sc-form__actions">
                      <button type="button" className="sc-btn sc-btn--ghost" onClick={() => setActiveTab("items")}>{s.cancelBtn}</button>
                      <button type="submit" className="sc-btn sc-btn--primary" style={{ background: color, borderColor: color }} disabled={lostUploading}>
                        {lostUploading ? s.postingLostBtn : s.postLostBtn}
                      </button>
                    </div>
                  </form>
                )
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              MY DASHBOARD TAB
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "my-dash" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 896, margin: "0 auto", width: "100%" }}>
              {!user ? (
                <div className="sc-empty">{s.signInToView}</div>
              ) : (
                <>
                  {/* Profile card */}
                  <div className="sc-my-dash-profile-card" style={{ display: "flex", alignItems: "center", gap: 16, padding: "18px 20px", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 16, boxShadow: "var(--card-shadow)" }}>
                    <div className="sc-my-dash-profile-top">
                      {user.imageUrl
                        ? <img src={user.imageUrl} alt="Profile" style={{ width: 56, height: 56, borderRadius: "50%", objectFit: "cover", border: `2.5px solid ${color}`, flexShrink: 0 }} />
                        : <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${color}22`, color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 700, fontFamily: "var(--font-body)", flexShrink: 0 }}>{(user.fullName || user.username || "?")[0]?.toUpperCase()}</div>}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: "0 0 2px", fontFamily: "var(--font-body)", fontSize: 17, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.fullName || user.username || "Anonymous"}</p>
                        <p style={{ margin: "0 0 8px", fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.primaryEmailAddress?.emailAddress || ""}</p>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 600, padding: "3px 10px", borderRadius: 20, background: `${color}22`, color, fontFamily: "var(--font-body)" }}>{school.name} {s.schoolMember}</span>
                      </div>
                    </div>
                    <div className="sc-my-dash-stats" style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                      {([[s.statPosted, totalFound, clrFound], [s.statReturned, totalReturnedByMe, clrReturned], [s.statLost, totalLost, "var(--danger)"]] as [string, number, string][]).map(([label, val, clr]) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 20, fontWeight: 700, color: clr }}>{val}</p>
                          <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* XP / Level card */}
                  <div className="sc-my-dash-xp-card" style={{ padding: "16px 20px", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 16, boxShadow: "var(--card-shadow)", display: "flex", alignItems: "center", gap: 20 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: 26, fontWeight: 700, color }}>{xp} XP</span>
                        <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", padding: "2px 10px", borderRadius: 20, background: `${color}22` }}>{userLevel}</span>
                      </div>
                      <div style={{ height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                        <div style={{ height: "100%", width: `${xpPct}%`, background: color, borderRadius: 3, transition: "width 0.5s ease" }} />
                      </div>
                      {xpNext !== null
                        ? <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)" }}>{xp} / {xpNext} {s.xpToNextLevel}</p>
                        : <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 10, color }}>{s.maxLevelReached}</p>}
                    </div>
                    <div className="sc-my-dash-xp-breakdown" style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, textAlign: "right" }}>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.xpBreakdown}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpReturn}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpPost}</span>
                      <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpReportLost}</span>
                    </div>
                  </div>

                  {/* Charts */}
                  <div className="sc-my-dash-charts-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--card-shadow)", overflow: "hidden", minWidth: 0 }}>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{s.monthlyActivity}</p>
                      <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                        {([[s.chartFound, clrFound], [s.chartLost, clrLost], [s.chartReturned, clrReturned]] as [string, string][]).map(([l, c]) => (
                          <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>
                            <span style={{ width: 9, height: 9, borderRadius: 2, background: c, flexShrink: 0 }} />{l}
                          </span>
                        ))}
                      </div>
                      <div style={{ position: "relative", height: 160, width: "100%" }}><canvas id={`schoolBarChart-${chartKey}`} role="img" aria-label="Monthly activity chart" /></div>
                    </div>
                    <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 14, padding: "16px 18px", boxShadow: "var(--card-shadow)", overflow: "hidden", minWidth: 0 }}>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--text-primary)" }}>{s.actionBreakdown}</p>
                      {totalActions === 0 ? (
                        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)", padding: "20px 0" }}>{s.noActivity}</p>
                      ) : (
                        <>
                          <div style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}>
                            {([[s.chartFoundPosted, clrFound, totalFound], [s.chartLostReported, clrLost, totalLost], [s.chartReturned, clrReturned, totalReturnedByMe]] as [string, string, number][]).map(([l, c, v]) => (
                              <span key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>
                                <span style={{ width: 9, height: 9, borderRadius: 2, background: c, flexShrink: 0 }} />{l} {totalActions > 0 ? Math.round((v / totalActions) * 100) : 0}%
                              </span>
                            ))}
                          </div>
                          <div style={{ position: "relative", height: 160, width: "100%" }}><canvas id={`schoolPieChart-${chartKey}`} role="img" aria-label="Action breakdown chart" /></div>
                        </>
                      )}
                    </div>
                  </div>
                  <SchoolCharts chartKey={chartKey} monthLabels={monthLabels} foundByMonth={foundByMonth} lostByMonth={lostByMonth} returnedByMonth={returnedByMonth} totalFound={totalFound} totalLost={totalLost} totalReturned={totalReturnedByMe} clrFound={clrFound} clrLost={clrLost} clrReturned={clrReturned} labelFound={s.chartFound} labelLost={s.chartLost} labelReturned={s.chartReturned} labelFoundPosted={s.chartFoundPosted} labelLostReported={s.chartLostReported} />

                  {/* Pending claims on my items */}
                  {Object.values(myItemClaims).some((n) => n > 0) && (
                    <div>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.pendingClaimsTitle}</p>
                      {myFoundItems.filter((item) => (myItemClaims[item.id] ?? 0) > 0).map((item) => (
                        <div key={item.id} style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                          {item.image_url && <img src={item.image_url} alt={item.name} style={{ width: 40, height: 40, borderRadius: 6, objectFit: "cover", flexShrink: 0 }} />}
                          <p style={{ fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.name}</p>
                          <span style={{ background: "var(--warning)", color: "#fff", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 100, fontFamily: "var(--font-body)", whiteSpace: "nowrap", flexShrink: 0 }}>
                            {myItemClaims[item.id]} {myItemClaims[item.id] !== 1 ? s.pendingClaimPlural : s.pendingClaimSingular}
                          </span>
                          <button style={{ background: color, color: textOn, fontSize: 12, fontWeight: 600, padding: "6px 14px", borderRadius: 8, border: "none", cursor: "pointer", fontFamily: "var(--font-body)", flexShrink: 0 }} onClick={() => router.push(`/school-items/${item.id}`)}>
                            {s.review}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* My found items */}
                  {myFoundItems.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        {s.myFoundPosted} ({myFoundItems.length})
                      </p>
                      <div className="sc-items-grid" style={{ margin: 0 }}>
                        {myFoundItems.map((item) => (
                          <div key={item.id} className="sc-item-card">
                            <div className="sc-item-card__img-wrap">
                              {item.image_url ? <img src={item.image_url} alt={item.name} className="sc-item-card__img" /> : <div className="sc-item-card__no-img">{s.noImage}</div>}
                            </div>
                            <div className="sc-item-card__info">
                              <p className="sc-item-card__name">{contentMap[`f_${item.id}`]?.name || item.name}</p>
                              {item.category && <span style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: color, color: textOn, fontFamily: "var(--font-body)", marginTop: 4, marginBottom: 2 }}>🏷️ {catMap[item.category] || item.category}</span>}
                              <StatusBadge status={item.status} s={s} />
                            </div>
                            <div className="sc-item-card__actions">
                              {/* Finder confirm handoff */}
                              {(item.status === "claim_accepted" || item.status === "handed_off") && item.author_id === user.id && !item.handoff_confirmed_by_poster && (
                                <button className="sc-btn sc-btn--success sc-btn--sm" style={{ width: "100%" }} onClick={() => handleConfirmHandoff(item.id)}>
                                  {s.confirmHandoff}
                                </button>
                              )}
                              <div className="sc-item-card__actions-row">
                                {item.status !== "handed_off" && item.status !== "disputed" && (
                                  <button className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon" style={{ flex: 1 }} onClick={(e) => handleDeleteFound(e, item)}>
                                    <FaTrash />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* My lost items */}
                  {myLostItemsList.length > 0 && (
                    <div>
                      <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>
                        {s.myLostReported} ({myLostItemsList.length})
                      </p>
                      <div className="sc-items-grid" style={{ margin: 0 }}>
                        {myLostItemsList.map((item) => (
                          <div key={item.id} className="sc-item-card">
                            <div className="sc-item-card__img-wrap">
                              {item.image_url ? <img src={item.image_url} alt={item.name} className="sc-item-card__img" /> : <div className="sc-item-card__no-img">{s.noImage}</div>}
                            </div>
                            <div className="sc-item-card__info">
                              <p className="sc-item-card__name">{contentMap[`l_${item.id}`]?.name || item.name}</p>
                              {item.category && <span style={{ display: "inline-block", fontSize: "0.68rem", fontWeight: 600, padding: "2px 8px", borderRadius: 100, background: color, color: textOn, fontFamily: "var(--font-body)", marginTop: 4, marginBottom: 2 }}>🏷️ {catMap[item.category] || item.category}</span>}
                            </div>
                            <div className="sc-item-card__actions">
                              <button className="sc-btn sc-btn--success sc-btn--sm" style={{ width: "100%" }} onClick={(e) => handleMarkLostFound(e, item.id)}>{s.markFound}</button>
                              <div className="sc-item-card__actions-row">
                                <button className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon" style={{ flex: 1 }} onClick={(e) => handleDeleteLost(e, item.id)}><FaTrash /></button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* My Active Claims (as claimant) */}
                  <div>
                    <p style={{ margin: "0 0 10px", fontFamily: "var(--font-body)", fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.8px" }}>{s.myActiveClaims}</p>
                    {activeClaimsLoading ? (
                      <div className="sc-empty">{s.loadingText}</div>
                    ) : myActiveClaims.length === 0 ? (
                      <div className="sc-empty">{s.noActiveClaims}</div>
                    ) : (
                      <div className="sc-items-grid" style={{ margin: 0 }}>
                        {myActiveClaims.map((claim: any) => (
                          <div key={claim.id} className="sc-item-card">
                            <div className="sc-item-card__info">
                              <p className="sc-item-card__name">{claim.item_name}</p>
                              <p className="sc-item-card__desc">{claim.description_proof?.slice(0, 100)}{(claim.description_proof?.length || 0) > 100 ? "…" : ""}</p>
                              <span style={{ display: "inline-block", marginTop: 6, padding: "2px 10px", borderRadius: 100, fontSize: "0.7rem", fontWeight: 700, fontFamily: "var(--font-body)", background: claim.status === "accepted" ? "var(--success)" : "var(--warning)", color: "#fff" }}>
                                {claim.status === "accepted" ? s.acceptedCoordinate : s.pendingReview}
                              </span>
                              {/* Claimant confirm handoff */}
                              {claim.item_status === "handed_off" && (
                                <span style={{ display: "block", marginTop: 4, fontSize: "0.72rem", fontFamily: "var(--font-body)", color: "var(--text-muted)", fontWeight: 600 }}>{s.finderHandedOff}</span>
                              )}
                            </div>
                            <div className="sc-item-card__actions">
                              {claim.status === "accepted" && (
                                <button className="sc-btn sc-btn--success sc-btn--sm" style={{ width: "100%", background: color, borderColor: color, color: textOn }} onClick={() => router.push(`/school-items/${claim.item_id}`)}>
                                  {s.goToItem}
                                </button>
                              )}
                              {claim.item_status === "handed_off" && (
                                <button className="sc-btn sc-btn--primary sc-btn--sm" style={{ width: "100%", background: color, borderColor: color, color: textOn }} onClick={() => handleConfirmHandoff(claim.item_id)}>
                                  {s.confirmReceipt}
                                </button>
                              )}
                              {claim.status === "pending" && (
                                <button className="sc-btn sc-btn--ghost sc-btn--sm" style={{ width: "100%", border: "1.5px solid var(--danger)", color: "var(--danger)" }} onClick={() => handleCancelClaim(claim.id, claim.item_id)}>
                                  {s.cancelClaim}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {myFoundItems.length === 0 && myLostItemsList.length === 0 && myActiveClaims.length === 0 && totalReturnedByMe === 0 && (
                    <div className="sc-empty">{s.noMyItems}</div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              ADMIN LOGIN TAB
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "admin-login" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{s.adminLoginTitle}</div>
              {adminUnlocked ? (
                <div className="sc-success">
                  <span className="sc-success__icon">✓</span>
                  <p>{s.adminUnlockedMsg}</p>
                  <p className="sc-success__sub">{s.adminUnlockedSub}</p>
                </div>
              ) : (
                <form className="sc-form" onSubmit={handleAdminLogin}>
                  <p className="sc-hint">{s.adminLoginHint}</p>
                  <label className="sc-form__label">{s.adminPasswordLabel}</label>
                  <input className="sc-form__input" type="password" placeholder={s.adminPasswordPlaceholder} value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} required />
                  {adminError && <p className="sc-form__error">{adminError}</p>}
                  <button type="submit" className="sc-btn sc-btn--primary" style={{ background: color, borderColor: color }} disabled={adminChecking}>
                    {adminChecking ? s.checkingBtn : s.unlockBtn}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              LEADERBOARD TAB
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "leaderboard" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 600, margin: "0 auto", width: "100%" }}>
              <div style={{ padding: "18px 20px", background: "var(--bg-card)", border: "1px solid var(--border-default)", borderRadius: 16, boxShadow: "var(--card-shadow)" }}>
                <p style={{ margin: "0 0 4px", fontFamily: "var(--font-body)", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{s.leaderboardTab}</p>
                <p style={{ margin: "0 0 20px", fontFamily: "var(--font-body)", fontSize: 12, color: "var(--text-muted)" }}>{s.leaderboardDesc}</p>
                {leaderboardLoading ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}><LoadingSpinner /></div>
                ) : leaderboard.length === 0 ? (
                  <p style={{ fontFamily: "var(--font-body)", fontSize: 13, color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>{s.leaderboardEmpty}</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {leaderboard.map((entry, idx) => {
                      const isMe = entry.author_id === user?.id;
                      const medal = idx === 0 ? { bg: "#FFD700", text: "#7a5c00" } : idx === 1 ? { bg: "#C0C0C0", text: "#4a4a4a" } : idx === 2 ? { bg: "#CD7F32", text: "#5c3410" } : null;
                      return (
                        <div key={entry.author_id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "12px 16px", borderRadius: 12, background: isMe ? `${color}14` : "var(--bg-input)", border: isMe ? `1.5px solid ${color}44` : "1.5px solid var(--border-default)", transition: "all 0.15s" }}>
                          <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: medal ? medal.bg : "var(--border-default)", fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 700, color: medal ? medal.text : "var(--text-muted)" }}>
                            {idx + 1}
                          </div>
                          <p style={{ flex: 1, margin: 0, fontFamily: "var(--font-body)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {entry.author_name}{isMe && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 700, color, background: `${color}22`, padding: "2px 8px", borderRadius: 20 }}>{s.leaderboardYou}</span>}
                          </p>
                          <div style={{ textAlign: "right", flexShrink: 0 }}>
                            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 16, fontWeight: 700, color }}>{entry.count}</p>
                            <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>{s.leaderboardReturned}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              REPORTS TAB (admin only)
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "reports" && isSchoolAdmin && (
            <div className="sc-panel-content">
              {/* Sub-tabs */}
              <div style={{ display: "flex", gap: 8, marginBottom: 20, justifyContent: "flex-start" }}>
                {(["reports", "disputes"] as const).map((t) => (
                  <button key={t} onClick={() => setReportsSubTab(t)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", fontFamily: "var(--font-body)", background: reportsSubTab === t ? "var(--danger)" : "var(--bg-input)", color: reportsSubTab === t ? "#fff" : "var(--text-muted)", transition: "all 0.15s ease" }}>
                    {t === "reports" ? s.reportedItemsTitle : s.disputesTitle}
                  </button>
                ))}
              </div>

              {reportsSubTab === "reports" && (
                <>
                  <div className="sc-section-title">{s.reportedItemsTitle}</div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>{s.reportedItemsDesc}</p>
                  <SchoolReportsPanel school={school} onDeleteItem={handleReportDeleteItem} color={color} s={s} />
                </>
              )}
              {reportsSubTab === "disputes" && (
                <>
                  <div className="sc-section-title">{s.disputesTitle}</div>
                  <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>{s.disputesDesc}</p>
                  <SchoolDisputesPanel school={school} adminId={adminId} adminName={adminName} onRestoreItem={handleDisputeRestoreItem} s={s} />
                </>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════
              INBOX TAB (admin only)
          ══════════════════════════════════════════════════════════════════ */}
          {activeTab === "inbox" && isSchoolAdmin && user && (
            <div className="sc-panel-content">
              <div className="sc-section-title">{s.inboxTitle}</div>
              <p style={{ fontFamily: "var(--font-body)", fontSize: "0.82rem", color: "var(--text-muted)", margin: "0 0 16px" }}>{s.inboxDesc}</p>
              <AdminInboxPanel adminId={user.id} adminName={user.fullName || user.username || "Admin"} adminEmail={user.primaryEmailAddress?.emailAddress || ""} />
            </div>
          )}

        </main>
      </div>

      {/* Crop modals */}
      {foundCropSrc && <CropModal src={foundCropSrc} queueIndex={foundCropIndex} queueTotal={foundCropQueue.length} onConfirm={handleFoundCropConfirm} onSkip={handleFoundCropSkip} cropPhotoLabel={s.cropPhoto} cropOfLabel={s.cropOf} cropZoomLabel={s.cropZoom} cropRotateLabel={s.cropRotate} skipCropLabel={s.skipCrop} applyCropLabel={s.applyCrop} />}
      {lostCropSrc && <CropModal src={lostCropSrc} queueIndex={lostCropIndex} queueTotal={lostCropQueue.length} onConfirm={handleLostCropConfirm} onSkip={handleLostCropSkip} cropPhotoLabel={s.cropPhoto} cropOfLabel={s.cropOf} cropZoomLabel={s.cropZoom} cropRotateLabel={s.cropRotate} skipCropLabel={s.skipCrop} applyCropLabel={s.applyCrop} />}
    </div>
  );
}