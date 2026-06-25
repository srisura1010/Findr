"use client";

import "./dashboard.css";
import { useItems } from "@/context/ItemsContext";
import type { LostItem } from "@/context/ItemsContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";
import { useEffect, useState } from "react";
import {
  FaTrash,
  FaClipboard,
  FaFlag,
  FaTriangleExclamation,
  FaPlus,
  FaChevronDown,
} from "react-icons/fa6";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { CiLogin } from "react-icons/ci";
import { MdFlagCircle } from "react-icons/md";
import { ImHammer2 } from "react-icons/im";
import { IoMdMailOpen } from "react-icons/io";
import { useRouter } from "next/navigation";
import { AdminInboxPanel } from "@/app/components/AdminInboxPanel";
import Cropper from "react-easy-crop";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LocationPicker, { LocationData } from "@/app/components/LocationPicker";

function sendEmail(route: string, body: Record<string, string>) {
  fetch(`/api/emails/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).catch(console.error);
}

// ── Categories ────────────────────────────────────────────────────────────────
const CATEGORIES = [
  "Electronics",
  "Clothing & Accessories",
  "Bags & Backpacks",
  "Books & Stationery",
  "Keys",
  "Wallet & Cards",
  "Jewelry",
  "Water Bottle",
  "Sports Equipment",
  "Musical Instrument",
  "Glasses & Eyewear",
  "Headphones & Earbuds",
  "Phone",
  "Charger & Cables",
  "ID & Documents",
  "Toys & Games",
  "Food & Containers",
  "Umbrella",
  "Other",
];

interface Report {
  id: number;
  item_id: number;
  item_name: string;
  item_image: string;
  reporter_name: string;
  reporter_email: string;
  reason: string;
  created_at: string;
  items: {
    author_name: string;
    author_email: string;
    author_id: string;
  } | null;
}
interface UserReport {
  id: number;
  reporter_name: string;
  reporter_email: string;
  reported_user_id: string;
  reported_user_name: string;
  reported_user_email: string;
  reason: string;
  created_at: string;
}
interface BannedUser {
  email: string;
  reason: string;
  suspended_until: string | null;
  banned_at: string;
  banned_by: string;
}

type TabId =
  | "items"
  | "my-items"
  | "report-item"
  | "become-admin"
  | "admin-login"
  | "reports"
  | "ban-management"
  | "inbox";

// ── Translation helper ────────────────────────────────────────────────────────
// Translates a batch of [field, englishKey, cacheKey] tuples in one request.
async function batchTranslate(
  entries: Array<[keyof DashStrings, string, string]>,
  target: string,
  apply: (updates: Partial<DashStrings>) => void,
) {
  // Apply cache hits synchronously first (zero flicker).
  const updates: Partial<DashStrings> = {};
  const uncached: typeof entries = [];

  for (const [field, key, cacheKey] of entries) {
    const hit = localStorage.getItem(`${cacheKey}_${target}`);
    if (hit) {
      updates[field] = hit;
    } else {
      uncached.push([field, key, cacheKey]);
    }
  }

  if (Object.keys(updates).length > 0) apply(updates);

  if (uncached.length === 0) return;

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts: uncached.map(([, k]) => k), target }),
    });
    if (!res.ok) return;

    const data = await res.json();
    const results: string[] = data.translatedTexts ?? [];
    const newUpdates: Partial<DashStrings> = {};

    for (let i = 0; i < uncached.length; i++) {
      const [field, , cacheKey] = uncached[i];
      const translated = results[i]?.trim();
      if (translated) {
        newUpdates[field] = translated;
        localStorage.setItem(`${cacheKey}_${target}`, translated);
      }
    }

    apply(newUpdates);
  } catch {
    // Uncached strings stay at their DEFAULT_STRINGS (English) values.
  }
}

// ── Crop helper ───────────────────────────────────────────────────────────────
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
  ctx.drawImage(
    image,
    safeArea / 2 - image.width * 0.5,
    safeArea / 2 - image.height * 0.5,
  );

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
      (blob) => {
        resolve(new File([blob!], "cropped.jpg", { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.92,
    );
  });
}

// ── String bundle types ───────────────────────────────────────────────────────
interface DashStrings {
  tabItems: string;
  tabMyItems: string;
  tabReportItem: string;
  tabBecomeAdmin: string;
  tabAdmin: string;
  tabReports: string;
  tabBanManagement: string;
  tabInbox: string;
  adminBannerMsg: string;
  adminBannerExit: string;
  searchPlaceholder: string;
  foundItemsTab: string;
  lostItemsTab: string;
  foundBy: string;
  lostBy: string;
  claimPending: string;
  noFoundItems: string;
  noFoundItemsSearch: string;
  tryKeywords: string;
  noLostItems: string;
  noLostItemsSearch: string;
  clickReportLost: string;
  toggleFound: string;
  toggleLost: string;
  reportFoundTitle: string;
  itemPosted: string;
  itemNameLabel: string;
  itemNamePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  locationLabel: string;
  locationLostLabel: string;
  photosLabel: string;
  photosSelected: string;
  uploadPhotos: string;
  photoHint: string;
  cancelBtn: string;
  postItemBtn: string;
  uploadingBtn: string;
  reportLostTitle: string;
  lostItemPosted: string;
  whatLostLabel: string;
  itemNameDefault: string;
  descLostPlaceholder: string;
  postingBtn: string;
  postLostBtn: string;
  myItemsTitle: string;
  signInToView: string;
  noItemsYet: string;
  foundItemsPosted: string;
  lostItemsReported: string;
  claimPendingStatus: string;
  activeStatus: string;
  confirmClaimed: string;
  markAsFound: string;
  becomeAdminTitle: string;
  requestSubmitted: string;
  reviewMsg: string;
  fullNameLabel: string;
  emailLabel: string;
  schoolLabel: string;
  schoolPlaceholder: string;
  teacherIdLabel: string;
  teacherIdPlaceholder: string;
  uploadIdLabel: string;
  uploadIdPlaceholder: string;
  photoHintShort: string;
  anythingElseLabel: string;
  anythingElsePlaceholder: string;
  submitRequestBtn: string;
  submittingBtn: string;
  adminAccessTitle: string;
  adminLoginHint: string;
  adminPasswordLabel: string;
  adminPasswordPlaceholder: string;
  checkingBtn: string;
  unlockAdminBtn: string;
  adminUnlocked: string;
  adminUnlockedSub: string;
  adminIncorrect: string;
  reportedItemsTab: string;
  reportedUsersTab: string;
  reportedItemsTitle: string;
  reportedUsersTitle: string;
  loadingText: string;
  noItemReports: string;
  noUserReports: string;
  reportedBy: string;
  postedBy: string;
  unknown: string;
  dismissBtn: string;
  deleteItemBtn: string;
  banUserBtn: string;
  userEmailLabel: string;
  banMgmtTitle: string;
  banMgmtHint: string;
  userEmailInputLabel: string;
  reasonLabel: string;
  reasonPlaceholder: string;
  permanentBtn: string;
  suspendBtn: string;
  suspendDaysLabel: string;
  processingBtn: string;
  banUserBtn2: string;
  suspendUserBtn: string;
  activeBansTitle: string;
  noBannedUsers: string;
  suspendedUntil: string;
  suspensionExpired: string;
  permanentBan: string;
  byLabel: string;
  unbanBtn: string;
  categoryLabel: string;
  categoryPlaceholder: string;
  filterCategory: string;
  filterLocation: string;
  filterDate: string;
  filterAll: string;
  clearFilters: string;
  myDashboardTab: string;
  activeMember: string;
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
  chartFoundPosted: string;
  chartLostReported: string;
  noActivity: string;
  pendingClaimsTitle: string;
  levelLegend: string;
  levelChampion: string;
  levelFinder: string;
  levelHelper: string;
  levelNewcomer: string;
  brandTitle: string;
  brandSub: string;
  noDisputes: string;
  disputesTab: string;
  disputedBy: string;
  viewItemArrow: string;
  dismissDispute: string;
  resolveForClaimant: string;
  messageParties: string;
  claimantLabel: string;
  finderLabel: string;
  msgToClaimantPre: string;
  msgToClaimantPost: string;
  msgToFinder: string;
  sendingBtn: string;
  sendMessageBtn: string;
  resolveForClaimantConfirm: string;
  dismissDisputeConfirm: string;
  deleteItemConfirmPre: string;
  deleteItemConfirmPost: string;
  banConfirmPre: string;
  unbanConfirmPre: string;
  failedPrefix: string;
  bannedSuccessPost: string;
  suspendedSuccessMid: string;
  suspendedSuccessDays: string;
  unbannedSuccessPost: string;
  deleteBlockedAlert: string;
  deleteSimpleConfirm: string;
  deletePendingConfirmPre: string;
  deletePendingConfirmPost: string;
  deleteAcceptedConfirmPre: string;
  deleteAcceptedConfirmPost: string;
  claimCancelAlert: string;
  deleteLostConfirm: string;
  myActiveClaimsTitle: string;
  noActiveClaims: string;
  claimAcceptedStatus: string;
  pendingReviewStatus: string;
  goToItemBtn: string;
  cancelClaimBtn: string;
  pendingClaimSingular: string;
  pendingClaimsPlural: string;
  reviewItemBtn: string;
  claimInProgressStatus: string;
  awaitingConfirmStatus: string;
  disputedStatus: string;
}

const DEFAULT_STRINGS: DashStrings = {
  tabItems: "Items",
  tabMyItems: "My Items",
  tabReportItem: "Lost/Found Item",
  tabBecomeAdmin: "Become an Admin",
  tabAdmin: "Admin",
  tabReports: "Reports",
  tabBanManagement: "Ban Management",
  tabInbox: "Inbox",
  adminBannerMsg: "Admin mode active. You can delete items and ban users",
  adminBannerExit: "Exit Admin",
  searchPlaceholder: "Search items...",
  foundItemsTab: "Found Items",
  lostItemsTab: "Lost Items",
  foundBy: "Found by:",
  lostBy: "Lost by:",
  claimPending: "Claim pending",
  noFoundItems: "No found items posted yet.",
  noFoundItemsSearch: "No items found for",
  tryKeywords: "Try different keywords like color, type, or brand",
  noLostItems: "No lost item reports yet.",
  noLostItemsSearch: "No lost items found for",
  clickReportLost:
    'Click "Report Lost Item" in the sidebar to post what you lost.',
  toggleFound: "Found an Item",
  toggleLost: "Lost an Item",
  reportFoundTitle: "Report Found Item",
  itemPosted: "Item posted!",
  itemNameLabel: "Item Name",
  itemNamePlaceholder: "Item Name",
  descriptionLabel: "Description",
  descriptionPlaceholder: "Description (location, time, etc)",
  locationLabel: "Where was it found?",
  locationLostLabel: "Last seen where?",
  photosLabel: "Photos (optional, up to 3)",
  photosSelected: "photo(s) selected",
  uploadPhotos: "Upload photos",
  photoHint: "PNG, JPG up to 10MB each. Upload up to 3 photos.",
  cancelBtn: "Cancel",
  postItemBtn: "Post Item",
  uploadingBtn: "Uploading...",
  reportLostTitle: "Report Lost Item",
  lostItemPosted: "Lost item reported!",
  whatLostLabel: "What did you lose?",
  itemNameDefault: "Item Name",
  descLostPlaceholder: "Description (location, time, etc)",
  postingBtn: "Posting...",
  postLostBtn: "Post Lost Item",
  myItemsTitle: "My Items",
  signInToView: "Please sign in to view your items.",
  noItemsYet: "You haven't posted any items yet.",
  foundItemsPosted: "Found Items I Posted",
  lostItemsReported: "Lost Items I Reported",
  claimPendingStatus: "Claim pending",
  activeStatus: "✓ Active",
  confirmClaimed: "Confirm Claimed",
  markAsFound: "Mark as Found",
  becomeAdminTitle: "Become an Admin",
  requestSubmitted: "Request submitted!",
  reviewMsg: "We will review and get back to you.",
  fullNameLabel: "Full Name",
  emailLabel: "Email",
  schoolLabel: "School / Institution",
  schoolPlaceholder: "Lincoln High School",
  teacherIdLabel: "Teacher ID / Staff Number",
  teacherIdPlaceholder: "T-00123",
  uploadIdLabel: "Upload ID or Badge Photo",
  uploadIdPlaceholder: "Upload ID or badge photo",
  photoHintShort: "PNG, JPG up to 10MB",
  anythingElseLabel: "Anything else we should know?",
  anythingElsePlaceholder: "e.g. I run the lost and found office...",
  submitRequestBtn: "Submit Request",
  submittingBtn: "Submitting...",
  adminAccessTitle: "Admin Access",
  adminLoginHint: "Enter the password from your approval email.",
  adminPasswordLabel: "Admin Password",
  adminPasswordPlaceholder: "e.g. FINDR-JANE-X4K2",
  checkingBtn: "Checking...",
  unlockAdminBtn: "Unlock Admin View",
  adminUnlocked: "Admin view unlocked!",
  adminUnlockedSub: "Delete buttons and ban tools are now visible.",
  adminIncorrect: "Incorrect password or not approved yet.",
  reportedItemsTab: "Reported Items",
  reportedUsersTab: "Reported Users",
  reportedItemsTitle: "Reported Items",
  reportedUsersTitle: "Reported Users",
  loadingText: "Loading...",
  noItemReports: "No item reports. All clear!",
  noUserReports: "No user reports. All clear!",
  reportedBy: "Reported by",
  postedBy: "Posted by",
  unknown: "Unknown",
  dismissBtn: "Dismiss",
  deleteItemBtn: "Delete Item",
  banUserBtn: "Ban User",
  userEmailLabel: "User email:",
  banMgmtTitle: "Ban Management",
  banMgmtHint: "Ban or suspend users by their account email.",
  userEmailInputLabel: "User Email",
  reasonLabel: "Reason",
  reasonPlaceholder: "e.g. Spam, abusive messages, false claims...",
  permanentBtn: "Permanent",
  suspendBtn: "Suspend",
  suspendDaysLabel: "Suspend for how many days?",
  processingBtn: "Processing...",
  banUserBtn2: "Ban User",
  suspendUserBtn: "Suspend User",
  activeBansTitle: "Active Bans & Suspensions",
  noBannedUsers: "No banned users.",
  suspendedUntil: "Suspended until",
  suspensionExpired: "Suspension expired",
  permanentBan: "Permanent ban",
  byLabel: "by",
  unbanBtn: "Unban",
  categoryLabel: "Category",
  categoryPlaceholder: "Select a category",
  filterCategory: "Category",
  filterLocation: "Location",
  filterDate: "Date",
  filterAll: "All",
  clearFilters: "Clear filters",
  myDashboardTab: "My Dashboard",
  activeMember: "Active member",
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
  chartFoundPosted: "Found posted",
  chartLostReported: "Lost reported",
  noActivity: "No activity yet.",
  pendingClaimsTitle: "Pending Claims on My Items",
  levelLegend: "Legend",
  levelChampion: "Champion",
  levelFinder: "Finder",
  levelHelper: "Helper",
  levelNewcomer: "Newcomer",
  brandTitle: "Findr Dashboard",
  brandSub: "Your Lost & Found",
  noDisputes: "No disputes. All clear!",
  disputesTab: "Disputes",
  disputedBy: "Disputed by",
  viewItemArrow: "View Item →",
  dismissDispute: "Dismiss Dispute",
  resolveForClaimant: "Resolve for Claimant",
  messageParties: "Message Parties",
  claimantLabel: "Claimant",
  finderLabel: "Finder",
  msgToClaimantPre: "Message to claimant (",
  msgToClaimantPost: ")...",
  msgToFinder: "Message to finder...",
  sendingBtn: "Sending...",
  sendMessageBtn: "Send Message",
  resolveForClaimantConfirm: "Resolve in claimant's favor? This will permanently delete the item listing.",
  dismissDisputeConfirm: "Dismiss this dispute? The item will return to claim_accepted status so the finder can re-confirm handoff.",
  deleteItemConfirmPre: "Delete \"",
  deleteItemConfirmPost: "\" permanently?",
  banConfirmPre: "Permanently ban",
  unbanConfirmPre: "Unban",
  failedPrefix: "Failed:",
  bannedSuccessPost: "has been permanently banned.",
  suspendedSuccessMid: "has been suspended for",
  suspendedSuccessDays: "days.",
  unbannedSuccessPost: "has been unbanned.",
  deleteBlockedAlert: "This item cannot be deleted while a handoff or dispute is in progress. Please wait for the claimant to confirm receipt or for admin to resolve the dispute.",
  deleteSimpleConfirm: "Delete this item permanently?",
  deletePendingConfirmPre: "There are",
  deletePendingConfirmPost: "students who submitted claims for this item. Deleting will notify them it's been removed. Continue?",
  deleteAcceptedConfirmPre: "You accepted",
  deleteAcceptedConfirmPost: "'s claim. Deleting now will cancel their accepted claim and notify them. Continue?",
  claimCancelAlert: "This claim can no longer be cancelled.",
  deleteLostConfirm: "Delete this lost item report permanently?",
  myActiveClaimsTitle: "My Active Claims",
  noActiveClaims: "You have no active claims.",
  claimAcceptedStatus: "Accepted: Coordinate Now",
  pendingReviewStatus: "Pending Review",
  goToItemBtn: "Go to Item",
  cancelClaimBtn: "Cancel Claim",
  pendingClaimSingular: "pending claim",
  pendingClaimsPlural: "pending claims",
  reviewItemBtn: "Review",
  claimInProgressStatus: "Claim in progress",
  awaitingConfirmStatus: "Awaiting confirmation",
  disputedStatus: "Disputed",
};

// ── Sub-panels ────────────────────────────────────────────────────────────────

function AdminPanel({ s }: { s: DashStrings }) {
  const { user } = useUser();
  const [adminForm, setAdminForm] = useState({
    name: "",
    email: "",
    school: "",
    teacherId: "",
    extraInfo: "",
  });
  const [adminFile, setAdminFile] = useState<File | null>(null);
  const [adminUploading, setAdminUploading] = useState(false);
  const [adminSuccess, setAdminSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      setAdminForm((p) => ({
        ...p,
        name: user.fullName || user.username || "",
        email: user.primaryEmailAddress?.emailAddress || "",
      }));
    }
  }, [user]);

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminUploading(true);
    try {
      let idImageUrl = "";
      if (adminFile) {
        const fileName = `admin_${Date.now()}_${adminFile.name}`;
        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(fileName, adminFile);
        if (uploadError) {
          console.error(uploadError.message);
          return;
        }
        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);
        idImageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("admin_requests").insert([
        {
          name: adminForm.name,
          email: adminForm.email,
          school: adminForm.school,
          teacher_id: adminForm.teacherId,
          extra_info: adminForm.extraInfo,
          id_image_url: idImageUrl,
          status: "pending",
        },
      ]);
      if (error) {
        console.error(error.message);
        return;
      }
      setAdminSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setAdminUploading(false);
    }
  };

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">{s.becomeAdminTitle}</div>
      {adminSuccess ? (
        <div className="panel-success">
          <span className="panel-success__icon">✓</span>
          <p>{s.requestSubmitted}</p>
          <p className="panel-success__sub">{s.reviewMsg}</p>
        </div>
      ) : (
        <form className="panel-form" onSubmit={handleAdminSubmit}>
          <label className="panel-form__label">{s.fullNameLabel}</label>
          <input
            className="panel-form__input"
            type="text"
            required
            value={adminForm.name}
            readOnly
          />
          <label className="panel-form__label">{s.emailLabel}</label>
          <input
            className="panel-form__input"
            type="email"
            required
            value={adminForm.email}
            readOnly
          />
          <label className="panel-form__label">{s.schoolLabel}</label>
          <input
            className="panel-form__input"
            type="text"
            placeholder={s.schoolPlaceholder}
            required
            value={adminForm.school}
            onChange={(e) =>
              setAdminForm((p) => ({ ...p, school: e.target.value }))
            }
          />
          <label className="panel-form__label">{s.teacherIdLabel}</label>
          <input
            className="panel-form__input"
            type="text"
            placeholder={s.teacherIdPlaceholder}
            required
            value={adminForm.teacherId}
            onChange={(e) =>
              setAdminForm((p) => ({ ...p, teacherId: e.target.value }))
            }
          />
          <label className="panel-form__label">{s.uploadIdLabel}</label>
          <label className="panel-form__file-label" htmlFor="admin-file-upload">
            <span className="panel-form__file-icon">+</span>
            <span className="panel-form__file-text">
              {adminFile ? adminFile.name : s.uploadIdPlaceholder}
            </span>
          </label>
          <input
            id="admin-file-upload"
            className="panel-form__file"
            type="file"
            accept="image/*"
            onChange={(e) => {
              if (e.target.files?.[0]) setAdminFile(e.target.files[0]);
            }}
          />
          <p className="panel-form__file-hint">{s.photoHintShort}</p>
          {adminFile && (
            <div className="panel-form__preview-wrap">
              <img
                src={URL.createObjectURL(adminFile)}
                alt="preview"
                className="panel-form__preview"
              />
              <button
                type="button"
                className="panel-form__preview-remove"
                onClick={() => setAdminFile(null)}
              >
                ×
              </button>
            </div>
          )}
          <label className="panel-form__label">{s.anythingElseLabel}</label>
          <textarea
            className="panel-form__textarea"
            placeholder={s.anythingElsePlaceholder}
            value={adminForm.extraInfo}
            onChange={(e) =>
              setAdminForm((p) => ({ ...p, extraInfo: e.target.value }))
            }
          />
          <button
            type="submit"
            className="panel-form__submit"
            disabled={adminUploading}
          >
            {adminUploading ? s.submittingBtn : s.submitRequestBtn}
          </button>
        </form>
      )}
    </div>
  );
}

function AdminLoginPanel({
  onUnlock,
  s,
}: {
  onUnlock: () => void;
  s: DashStrings;
}) {
  const { user } = useUser();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    setError("");
    const { data, error: dbError } = await supabase
      .from("admins")
      .select("id, name")
      .eq("email", user?.primaryEmailAddress?.emailAddress)
      .eq("password", password)
      .single();
    if (dbError || !data) {
      setError(s.adminIncorrect);
    } else {
      localStorage.setItem("findr_is_admin", "true");
      localStorage.setItem("findr_admin_id", data.id);
      localStorage.setItem("findr_admin_name", data.name || "Admin");
      setUnlocked(true);
      onUnlock();
    }
    setChecking(false);
  };

  if (unlocked) {
    return (
      <div className="main-panel-content">
        <div className="panel-success">
          <span className="panel-success__icon">✓</span>
          <p>{s.adminUnlocked}</p>
          <p className="panel-success__sub">{s.adminUnlockedSub}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">{s.adminAccessTitle}</div>
      <p className="admin-login__hint">{s.adminLoginHint}</p>
      <form className="panel-form" onSubmit={handleCheck}>
        <label className="panel-form__label">{s.adminPasswordLabel}</label>
        <input
          className="panel-form__input"
          type="password"
          placeholder={s.adminPasswordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {error && <p className="admin-login__error">{error}</p>}
        <button
          type="submit"
          className="panel-form__submit"
          disabled={checking}
        >
          {checking ? s.checkingBtn : s.unlockAdminBtn}
        </button>
      </form>
    </div>
  );
}

function ReportedItemsPanel({
  updateItemStatus,
  s,
}: {
  updateItemStatus: (id: number, status: string) => void;
  s: DashStrings;
}) {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("reports")
      .select("*, items(author_name, author_email, author_id)")
      .order("created_at", { ascending: false });
    if (data) setReports(data as Report[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDismiss = async (reportId: number) => {
    await supabase.from("reports").delete().eq("id", reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleDeleteItem = async (report: Report) => {
    if (!confirm(`${s.deleteItemConfirmPre}${report.item_name}${s.deleteItemConfirmPost}`)) return;
    await supabase.from("items").delete().eq("id", report.item_id);
    await supabase.from("reports").delete().eq("item_id", report.item_id);
    updateItemStatus(report.item_id, "claimed");
    setReports((prev) => prev.filter((r) => r.item_id !== report.item_id));
  };

  if (loading) return <p className="panel-empty">{s.loadingText}</p>;
  if (reports.length === 0)
    return <p className="panel-empty">{s.noItemReports}</p>;

  return (
    <div className="panel-item-list">
      {reports.map((report) => (
        <div key={report.id} className="reported-card">
          {report.item_image && (
            <img
              src={report.item_image}
              alt={report.item_name}
              className="reported-card__img"
            />
          )}
          <div className="reported-card__body">
            <p className="reported-card__name">{report.item_name}</p>
            <p className="reported-card__reason">{report.reason}</p>
            <p className="reported-card__meta">
              {s.reportedBy} {report.reporter_name} ·{" "}
              {new Date(report.created_at).toLocaleDateString()}
            </p>
            <p
              className="reported-card__meta"
              style={{ color: "var(--danger)", marginTop: "2px" }}
            >
              {s.postedBy} {report.items?.author_name ?? s.unknown} ·{" "}
              {report.items?.author_email ?? ""}
            </p>
          </div>
          <div className="reported-card__actions">
            <button
              className="reported-card__dismiss"
              onClick={() => handleDismiss(report.id)}
            >
              {s.dismissBtn}
            </button>
            <button
              className="reported-card__delete"
              onClick={() => handleDeleteItem(report)}
            >
              {s.deleteItemBtn}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportedUsersPanel({
  adminEmail,
  s,
}: {
  adminEmail: string;
  s: DashStrings;
}) {
  const [reports, setReports] = useState<UserReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("user_reports")
      .select("*")
      .order("created_at", { ascending: false });
    if (data) setReports(data as UserReport[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleDismiss = async (reportId: number) => {
    await supabase.from("user_reports").delete().eq("id", reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleBanUser = async (report: UserReport) => {
    if (!confirm(`${s.banConfirmPre} ${report.reported_user_name}?`)) return;
    await supabase.from("banned_users").upsert({
      email: report.reported_user_email,
      reason: report.reason,
      suspended_until: null,
      banned_by: adminEmail,
      banned_at: new Date().toISOString(),
    });
    await supabase
      .from("user_reports")
      .delete()
      .eq("reported_user_id", report.reported_user_id);
    setReports((prev) =>
      prev.filter((r) => r.reported_user_id !== report.reported_user_id),
    );
  };

  if (loading) return <p className="panel-empty">{s.loadingText}</p>;
  if (reports.length === 0)
    return <p className="panel-empty">{s.noUserReports}</p>;

  return (
    <div className="panel-item-list">
      {reports.map((report) => (
        <div key={report.id} className="reported-card">
          <div className="reported-card__body">
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  background: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  flexShrink: 0,
                }}
              >
                {report.reported_user_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <p className="reported-card__name" style={{ margin: 0 }}>
                {report.reported_user_name}
              </p>
            </div>
            <p className="reported-card__reason">{report.reason}</p>
            <p className="reported-card__meta">
              {s.reportedBy} {report.reporter_name} ({report.reporter_email}) ·{" "}
              {new Date(report.created_at).toLocaleDateString()}
            </p>
            {report.reported_user_email && (
              <p
                className="reported-card__meta"
                style={{ color: "var(--danger)", marginTop: 2 }}
              >
                {s.userEmailLabel} {report.reported_user_email}
              </p>
            )}
          </div>
          <div className="reported-card__actions">
            <button
              className="reported-card__dismiss"
              onClick={() => handleDismiss(report.id)}
            >
              {s.dismissBtn}
            </button>
            <button
              className="reported-card__delete"
              onClick={() => handleBanUser(report)}
            >
              {s.banUserBtn}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BanManagementPanel({
  adminEmail,
  s,
}: {
  adminEmail: string;
  s: DashStrings;
}) {
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState("");
  const [banType, setBanType] = useState<"permanent" | "suspend">("permanent");
  const [suspendDays, setSuspendDays] = useState("7");
  const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingList, setFetchingList] = useState(true);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchBannedUsers = async () => {
    setFetchingList(true);
    const { data } = await supabase
      .from("banned_users")
      .select("*")
      .order("banned_at", { ascending: false });
    if (data) setBannedUsers(data);
    setFetchingList(false);
  };

  useEffect(() => {
    fetchBannedUsers();
  }, []);

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !reason.trim()) return;
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    const suspendedUntil =
      banType === "suspend"
        ? new Date(Date.now() + Number(suspendDays) * 86400000).toISOString()
        : null;
    await supabase
      .from("banned_users")
      .delete()
      .eq("email", email.trim().toLowerCase());
    const { error } = await supabase.from("banned_users").insert({
      email: email.trim().toLowerCase(),
      reason: reason.trim(),
      suspended_until: suspendedUntil,
      banned_by: adminEmail,
      banned_at: new Date().toISOString(),
    });
    if (error) {
      setErrorMsg(`${s.failedPrefix} ${error.message}`);
    } else {
      setSuccessMsg(
        banType === "permanent"
          ? `${email} ${s.bannedSuccessPost}`
          : `${email} ${s.suspendedSuccessMid} ${suspendDays} ${s.suspendedSuccessDays}`,
      );
      setEmail("");
      setReason("");
      fetchBannedUsers();
    }
    setLoading(false);
  };

  const handleUnban = async (emailToUnban: string) => {
    if (!confirm(`${s.unbanConfirmPre} ${emailToUnban}?`)) return;
    const { error } = await supabase
      .from("banned_users")
      .delete()
      .eq("email", emailToUnban);
    if (!error) {
      setSuccessMsg(`${emailToUnban} ${s.unbannedSuccessPost}`);
      fetchBannedUsers();
    }
  };

  const isActive = (u: BannedUser) => {
    if (!u.suspended_until) return true;
    return new Date(u.suspended_until) > new Date();
  };

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">{s.banMgmtTitle}</div>
      <p className="admin-login__hint">{s.banMgmtHint}</p>
      <form className="panel-form" onSubmit={handleBan}>
        <label className="panel-form__label">{s.userEmailInputLabel}</label>
        <input
          className="panel-form__input"
          type="email"
          placeholder="user@school.edu"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <label className="panel-form__label">{s.reasonLabel}</label>
        <textarea
          className="panel-form__textarea"
          placeholder={s.reasonPlaceholder}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          required
        />
        <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          {(["permanent", "suspend"] as const).map((type) => (
            <button
              key={type}
              type="button"
              style={{
                flex: 1,
                padding: "10px",
                borderRadius: "8px",
                border: "1.5px solid var(--border-input)",
                background:
                  banType === type ? "var(--accent)" : "var(--bg-input)",
                color: banType === type ? "#fff" : "var(--text-primary)",
                fontSize: "13px",
                fontWeight: "600",
                fontFamily: "var(--font-body)",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onClick={() => setBanType(type)}
            >
              {type === "permanent" ? s.permanentBtn : s.suspendBtn}
            </button>
          ))}
        </div>
        {banType === "suspend" && (
          <>
            <label className="panel-form__label">{s.suspendDaysLabel}</label>
            <input
              className="panel-form__input"
              type="number"
              min="1"
              max="365"
              value={suspendDays}
              onChange={(e) => setSuspendDays(e.target.value)}
            />
          </>
        )}
        {successMsg && (
          <p
            style={{
              color: "var(--success)",
              fontSize: "0.85rem",
              margin: "4px 0",
              fontFamily: "var(--font-body)",
            }}
          >
            {successMsg}
          </p>
        )}
        {errorMsg && <p className="admin-login__error">{errorMsg}</p>}
        <button type="submit" className="panel-form__submit" disabled={loading}>
          {loading
            ? s.processingBtn
            : banType === "permanent"
              ? s.banUserBtn2
              : s.suspendUserBtn}
        </button>
      </form>

      <div className="main-panel-section-title" style={{ marginTop: "1.5rem" }}>
        {s.activeBansTitle}
      </div>
      {fetchingList ? (
        <p className="panel-empty">{s.loadingText}</p>
      ) : bannedUsers.length === 0 ? (
        <p className="panel-empty">{s.noBannedUsers}</p>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "10px",
            marginTop: "8px",
          }}
        >
          {bannedUsers.map((u) => (
            <div
              key={u.email}
              style={{
                padding: "12px 14px",
                borderRadius: "10px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                opacity: isActive(u) ? 1 : 0.5,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  minWidth: 0,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    color: "var(--text-primary)",
                    fontFamily: "var(--font-body)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {u.email}
                </span>
                <span
                  style={{
                    fontSize: "0.78rem",
                    color: "var(--text-secondary)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {u.reason}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {u.suspended_until
                    ? isActive(u)
                      ? `${s.suspendedUntil} ${new Date(u.suspended_until).toLocaleDateString()}`
                      : s.suspensionExpired
                    : s.permanentBan}{" "}
                  · {s.byLabel} {u.banned_by}
                </span>
              </div>
              <button
                onClick={() => handleUnban(u.email)}
                style={{
                  padding: "5px 12px",
                  borderRadius: "6px",
                  background: "var(--danger)",
                  color: "white",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.78rem",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  flexShrink: 0,
                  transition: "background 0.15s ease",
                }}
              >
                {s.unbanBtn}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Category Select ───────────────────────────────────────────────────────────
function CategorySelect({
  value,
  onChange,
  placeholder,
  required,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  required?: boolean;
}) {
  return (
    <div style={{ position: "relative" }}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        style={{
          width: "100%",
          padding: "10px 36px 10px 12px",
          borderRadius: "8px",
          border: "1.5px solid var(--border-input)",
          background: "var(--bg-input)",
          color: value ? "var(--text-primary)" : "var(--text-muted)",
          fontFamily: "var(--font-body)",
          fontSize: "13px",
          fontWeight: 500,
          cursor: "pointer",
          appearance: "none",
          WebkitAppearance: "none",
          outline: "none",
          transition: "border-color 0.15s ease",
          boxSizing: "border-box",
        }}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {CATEGORIES.map((cat) => (
          <option key={cat} value={cat}>
            {cat}
          </option>
        ))}
      </select>
      <FaChevronDown
        style={{
          position: "absolute",
          right: 12,
          top: "50%",
          transform: "translateY(-50%)",
          color: "var(--text-muted)",
          fontSize: 11,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// ── Disputes panel ───────────────────────────────────────────────────────────

interface Dispute {
  id: number | string;
  item_id: number;
  item_name: string;
  claimant_id: string;
  claimant_email: string;
  reason: string;
  created_at: string;
}

function DisputesPanel({ s, adminId, adminName }: { s: DashStrings; adminId: string; adminName: string }) {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [messagingDispute, setMessagingDispute] = useState<string | null>(null);
  const [adminMsgText, setAdminMsgText] = useState("");
  const [adminMsgSending, setAdminMsgSending] = useState(false);
  const [adminMsgTarget, setAdminMsgTarget] = useState<"finder" | "claimant">("claimant");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("disputes")
        .select("*")
        .order("created_at", { ascending: false });
      if (data) setDisputes(data as Dispute[]);
      setLoading(false);
    })();
  }, []);

  const handleResolveForClaimant = async (dispute: Dispute) => {
    if (!confirm(s.resolveForClaimantConfirm)) return;
    await supabase.from("items").delete().eq("id", dispute.item_id);
    await supabase.from("disputes").delete().eq("id", dispute.id);
    setDisputes((prev) => prev.filter((d) => d.id !== dispute.id));
  };

  const handleDismiss = async (dispute: Dispute) => {
    if (!confirm(s.dismissDisputeConfirm)) return;
    await supabase
      .from("items")
      .update({ status: "claim_accepted" })
      .eq("id", dispute.item_id);
    await supabase.from("disputes").delete().eq("id", dispute.id);
    setDisputes((prev) => prev.filter((d) => d.id !== dispute.id));
  };

  const handleSendAdminMsg = async (dispute: Dispute) => {
    let finderInfo = { author_id: "", author_name: "Finder", author_email: "" };
    if (adminMsgTarget === "finder") {
      const { data: itemData } = await supabase
        .from("items")
        .select("author_id, author_name, author_email")
        .eq("id", dispute.item_id)
        .maybeSingle();
      if (itemData) finderInfo = itemData;
    }

    const targetId = adminMsgTarget === "claimant"
      ? dispute.claimant_id
      : finderInfo.author_id;
    const targetEmail = adminMsgTarget === "claimant"
      ? dispute.claimant_email
      : finderInfo.author_email;
    const targetName = adminMsgTarget === "claimant"
      ? dispute.claimant_email
      : finderInfo.author_name;
    if (!targetEmail || !targetId || !adminId) return;
    setAdminMsgSending(true);
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
      text: adminMsgText.trim(),
      read: false,
    });
    setAdminMsgSending(false);
    setAdminMsgText("");
    setMessagingDispute(null);
  };

  if (loading) return <p className="panel-empty">{s.loadingText}</p>;
  if (disputes.length === 0)
    return <p className="panel-empty">{s.noDisputes}</p>;

  return (
    <div className="panel-item-list">
      {disputes.map((dispute) => (
        <div
          key={dispute.id}
          className="reported-card"
          style={{ alignItems: "flex-start", gap: 16, padding: "16px", flexDirection: "column" }}
        >
          <div style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
            <div className="reported-card__body">
              <p className="reported-card__name">{dispute.item_name}</p>
              <p
                className="reported-card__reason"
                style={{
                  color: "var(--text-secondary)",
                  textTransform: "none",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.85rem",
                  fontWeight: 400,
                  lineHeight: 1.5,
                  margin: "4px 0",
                  letterSpacing: "normal",
                }}
              >
                {dispute.reason}
              </p>
              <p className="reported-card__meta">
                {s.disputedBy} {dispute.claimant_email} ·{" "}
                {new Date(dispute.created_at).toLocaleDateString()}
              </p>
              <a
                href={`/items/${dispute.item_id}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "3px 10px",
                  borderRadius: "100px",
                  background: "var(--accent)",
                  color: "#fff",
                  fontSize: 11,
                  fontWeight: 700,
                  fontFamily: "var(--font-body)",
                  textDecoration: "none",
                  marginTop: 6,
                  width: "fit-content",
                  alignSelf: "flex-start",
                }}
              >
                {s.viewItemArrow}
              </a>
            </div>
            <div
              className="reported-card__actions"
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                flexShrink: 0,
                alignSelf: "flex-start",
                width: 180,
              }}
            >
              <button
                className="reported-card__dismiss"
                style={{ width: "100%", padding: "10px 0", textAlign: "center", boxSizing: "border-box" }}
                onClick={() => handleDismiss(dispute)}
              >
                {s.dismissDispute}
              </button>
              <button
                className="reported-card__delete"
                style={{ width: "100%", padding: "10px 0", textAlign: "center", boxSizing: "border-box" }}
                onClick={() => handleResolveForClaimant(dispute)}
              >
                {s.resolveForClaimant}
              </button>
              <button
                style={{
                  width: "100%",
                  padding: "10px 0",
                  textAlign: "center",
                  boxSizing: "border-box",
                  background: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontFamily: "var(--font-body)",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() =>
                  setMessagingDispute(
                    messagingDispute === String(dispute.id)
                      ? null
                      : String(dispute.id),
                  )
                }
              >
                {messagingDispute === String(dispute.id) ? s.cancelBtn : s.messageParties}
              </button>
            </div>
          </div>
          {messagingDispute === String(dispute.id) && (
            <div
              style={{
                width: "100%",
                borderTop: "1px solid var(--border-default)",
                paddingTop: 14,
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div style={{ display: "flex", gap: 6 }}>
                {(["claimant", "finder"] as const).map((target) => (
                  <button
                    key={target}
                    style={{
                      padding: "7px 16px",
                      borderRadius: 100,
                      border: "none",
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      background:
                        adminMsgTarget === target
                          ? "var(--accent)"
                          : "var(--bg-input)",
                      color:
                        adminMsgTarget === target ? "#fff" : "var(--text-muted)",
                    }}
                    onClick={() => setAdminMsgTarget(target)}
                  >
                    {target === "claimant" ? s.claimantLabel : s.finderLabel}
                  </button>
                ))}
              </div>
              <textarea
                className="panel-form__textarea"
                style={{ width: "100%", minHeight: 80, boxSizing: "border-box" }}
                placeholder={
                  adminMsgTarget === "claimant"
                    ? `${s.msgToClaimantPre}${dispute.claimant_email}${s.msgToClaimantPost}`
                    : s.msgToFinder
                }
                value={adminMsgText}
                onChange={(e) => setAdminMsgText(e.target.value)}
              />
              <button
                className="panel-form__submit"
                style={{ width: "100%" }}
                disabled={adminMsgSending || !adminMsgText.trim()}
                onClick={() => handleSendAdminMsg(dispute)}
              >
                {adminMsgSending ? s.sendingBtn : s.sendMessageBtn}
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
function MyDashboardCharts({
  chartKey,
  chartData,
  pieData,
  labels,
}: {
  chartKey: string;
  chartData: string;
  pieData: string;
  labels: { found: string; lost: string; returned: string; foundPosted: string; lostReported: string };
}) {
  useEffect(() => {
    const { monthLabels, foundByMonth, lostByMonth, returnedByMonth } =
      JSON.parse(chartData);
    const { totalFound, totalLost, totalReturned } = JSON.parse(pieData);

    const loadChartJs = () => {
      return new Promise<void>((resolve) => {
        if ((window as any).Chart) {
          resolve();
          return;
        }
        const sc = document.createElement("script");
        sc.src =
          "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
        sc.onload = () => resolve();
        document.head.appendChild(sc);
      });
    };

    loadChartJs().then(() => {
      const C = (window as any).Chart;
      const style = getComputedStyle(document.documentElement);
      const gridColor = style.getPropertyValue("--border-default").trim() || "rgba(0,0,0,0.06)";
      const tickColor = style.getPropertyValue("--text-muted").trim() || "rgba(0,0,0,0.45)";
      const clrFound = style.getPropertyValue("--accent").trim() || "#2f80ed";
      const clrLost = "#ef4444";
      const clrClaimed = style.getPropertyValue("--success").trim() || "#10b981";
      const chartFont = style.getPropertyValue("--font-body").trim() || "system-ui, sans-serif";

      const barEl = document.getElementById(
        `myDashBarChart-${chartKey}`,
      ) as HTMLCanvasElement | null;
      if (barEl) {
        const existing = C.getChart(barEl);
        if (existing) existing.destroy();
        new C(barEl, {
          type: "bar",
          data: {
            labels: monthLabels,
            datasets: [
              {
                label: labels.found,
                data: foundByMonth,
                backgroundColor: clrFound,
                borderRadius: 5,
                borderSkipped: false,
              },
              {
                label: labels.lost,
                data: lostByMonth,
                backgroundColor: clrLost,
                borderRadius: 5,
                borderSkipped: false,
              },
              {
                label: labels.returned,
                data: returnedByMonth,
                backgroundColor: clrClaimed,
                borderRadius: 5,
                borderSkipped: false,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                mode: "index",
                intersect: false,
                padding: 10,
                cornerRadius: 8,
                bodyFont: { family: chartFont, size: 12 },
                titleFont: { family: chartFont, size: 12 },
              },
            },
            scales: {
              x: {
                stacked: true,
                grid: { color: gridColor },
                ticks: {
                  color: tickColor,
                  font: { family: chartFont, size: 11 },
                  autoSkip: false,
                },
              },
              y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                  stepSize: 1,
                  color: tickColor,
                  font: { family: chartFont, size: 11 },
                },
                grid: { color: gridColor },
              },
            },
          },
        });
      }

      const pieEl = document.getElementById(
        `myDashPieChart-${chartKey}`,
      ) as HTMLCanvasElement | null;
      if (pieEl && totalFound + totalLost + totalReturned > 0) {
        const existing = C.getChart(pieEl);
        if (existing) existing.destroy();
        new C(pieEl, {
          type: "doughnut",
          data: {
            labels: [labels.foundPosted, labels.lostReported, labels.returned],
            datasets: [
              {
                data: [totalFound, totalLost, totalReturned],
                backgroundColor: [clrFound, clrLost, clrClaimed],
                borderWidth: 0,
                hoverOffset: 8,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "62%",
            plugins: {
              legend: { display: false },
              tooltip: {
                padding: 10,
                cornerRadius: 8,
                callbacks: {
                  label: (ctx: any) => {
                    const total = [
                      totalFound,
                      totalLost,
                      totalReturned,
                    ].reduce((a: number, b: number) => a + b, 0);
                    return ` ${ctx.label}: ${ctx.parsed} (${Math.round((ctx.parsed / total) * 100)}%)`;
                  },
                },
                bodyFont: { family: chartFont, size: 12 },
                titleFont: { family: chartFont, size: 12 },
              },
            },
          },
        });
      }
    });
  }, [chartKey, labels]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

export default function DashboardPage() {
  const {
    items,
    lostItems,
    addItem,
    addLostItem,
    updateItemStatus,
    removeLostItem,
    removeItem,
  } = useItems();
  const { user, isLoaded } = useUser();
  const { language, theme, hydrated } = useSettings();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("items");
  const [isReady, setIsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");

  // My Active Claims (claimant section)
  const [myActiveClaims, setMyActiveClaims] = useState<any[]>([]);
  const [activeClaimsLoading, setActiveClaimsLoading] = useState(false);
  const [totalReturnedByMe, setTotalReturnedByMe] = useState(0);
  const [myReturnedItems, setMyReturnedItems] = useState<any[]>([]);
  const [myItemClaims, setMyItemClaims] = useState<Record<number, number>>({});
  const [reportsTab, setReportsTab] = useState<"items" | "users" | "disputes">("items");
  const [reportMode, setReportMode] = useState<"found" | "lost">("found");
  const [s, setS] = useState<DashStrings>(DEFAULT_STRINGS);
  const [catMap, setCatMap] = useState<Record<string, string>>({});
  const [nameMap, setNameMap] = useState<Record<number, string>>({});

  // ── Filter state ────────────────────────────────────────────────────────────
  const [filterCategory, setFilterCategory] = useState("");
  const [filterLocation, setFilterLocation] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  const hasActiveFilters =
    !!filterCategory || !!filterLocation || !!filterDateFrom || !!filterDateTo;

  const clearFilters = () => {
    setFilterCategory("");
    setFilterLocation("");
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  const [banChecked, setBanChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("findr_is_admin") === "true";
    return false;
  });
  const [adminId] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("findr_admin_id") ?? "";
    return "";
  });
  const [adminName] = useState(() => {
    if (typeof window !== "undefined")
      return localStorage.getItem("findr_admin_name") ?? "Admin";
    return "Admin";
  });

  useEffect(() => {
    localStorage.setItem("findr_is_admin", String(isAdmin));
  }, [isAdmin]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setBanChecked(true);
      return;
    }
    const checkBan = async () => {
      const { data } = await supabase
        .from("banned_users")
        .select("email, suspended_until")
        .eq("email", user.primaryEmailAddress?.emailAddress)
        .maybeSingle();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended =
          data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) {
          router.push("/banned");
          return;
        }
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user, isLoaded]);

  // ── Active claims fetch (claimant's My Active Claims section) ──────────────
  useEffect(() => {
    if (!user?.id || !isLoaded) return;
    setActiveClaimsLoading(true);
    (async () => {
      const { data: claims } = await supabase
        .from("claim_requests")
        .select("*")
        .eq("claimant_id", user.id)
        .in("status", ["pending", "accepted"]);

      if (claims && claims.length > 0) {
        const itemIds = [...new Set(claims.map((c: any) => c.item_id))];
        const { data: claimItems } = await supabase
          .from("items")
          .select("id, name, status")
          .in("id", itemIds);
        const itemMap = new Map((claimItems || []).map((i: any) => [i.id, i]));
        setMyActiveClaims(
          claims
            .filter((c: any) => {
              const itemStatus = itemMap.get(c.item_id)?.status;
              return itemStatus && itemStatus !== "returned";
            })
            .map((c: any) => ({
              ...c,
              item_name: itemMap.get(c.item_id)?.name || "Unknown item",
              item_status: itemMap.get(c.item_id)?.status || "unknown",
            })),
        );
      } else {
        setMyActiveClaims([]);
      }
      setActiveClaimsLoading(false);
    })();
  }, [user?.id, isLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Returned-by-me count: items I found and successfully returned ─────────────
  useEffect(() => {
    if (!user?.id) return;
    (async () => {
      const res = await fetch(`/api/returned-count?author_id=${user.id}`);
      if (res.ok) {
        const json = await res.json();
        setTotalReturnedByMe(json.count ?? 0);
        setMyReturnedItems(json.items ?? []);
      }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Pending claim counts per found item (for My Dashboard claims summary) ────
  useEffect(() => {
    if (!user?.id) return;
    const myFoundItemIds = (items ?? [])
      .filter((i) => i.authorId === user.id)
      .map((i) => i.id);
    if (myFoundItemIds.length === 0) { setMyItemClaims({}); return; }
    (async () => {
      const { data } = await supabase
        .from("claim_requests")
        .select("item_id")
        .in("item_id", myFoundItemIds)
        .eq("status", "pending");
      const counts: Record<number, number> = {};
      for (const row of data || []) {
        counts[row.item_id] = (counts[row.item_id] || 0) + 1;
      }
      setMyItemClaims(counts);
    })();
  }, [user?.id, items]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Translation effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") {
      setS(DEFAULT_STRINGS);
      setIsReady(true);
      return;
    }

    // Clear confirmed-stale My Dashboard entries (English stored under non-English key).
    const myDashStaleChecks: Array<[string, string]> = [
      ["dash_activeMember", "Active member"],
      ["dash_statPosted", "Posted"],
      ["dash_statReturned", "Returned"],
      ["dash_statLost", "Lost"],
      ["dash_xpBreakdown", "XP breakdown"],
      ["dash_xpReturn", "Return: +100 XP each"],
      ["dash_xpPost", "Post: +20 XP each"],
      ["dash_xpReportLost", "Report lost: +5 XP each"],
      ["dash_monthlyActivity", "Monthly activity"],
      ["dash_chartFound", "Found"],
      ["dash_chartLost", "Lost"],
      ["dash_chartReturned", "Returned"],
      ["dash_actionBreakdown", "Action breakdown"],
      ["dash_chartFoundPosted", "Found posted"],
      ["dash_chartLostReported", "Lost reported"],
    ];
    for (const [prefix, englishVal] of myDashStaleChecks) {
      const k = `${prefix}_${language}`;
      if (localStorage.getItem(k) === englishVal) localStorage.removeItem(k);
    }

    const translations: [keyof DashStrings, string, string][] = [
      ["tabItems", "Items", "dash_tabItems"],
      ["tabMyItems", "My Items", "dash_tabMyItems"],
      ["tabReportItem", "Lost/Found Item", "dash_tabReportItem"],
      ["tabBecomeAdmin", "Become an Admin", "dash_tabBecomeAdmin"],
      ["tabAdmin", "Admin", "dash_tabAdmin"],
      ["tabReports", "Reports", "dash_tabReports"],
      ["tabBanManagement", "Ban Management", "dash_tabBanManagement"],
      ["tabInbox", "Inbox", "dash_tabInbox"],
      ["adminBannerMsg", DEFAULT_STRINGS.adminBannerMsg, "dash_adminBannerMsg"],
      ["adminBannerExit", "Exit Admin", "dash_adminBannerExit"],
      ["searchPlaceholder", "Search items...", "dash_searchPlaceholder"],
      ["foundItemsTab", "Found Items", "dash_foundItemsTab"],
      ["lostItemsTab", "Lost Items", "dash_lostItemsTab"],
      ["foundBy", "Found by:", "dash_foundBy"],
      ["lostBy", "Lost by:", "dash_lostBy"],
      ["claimPending", "Claim pending", "dash_claimPending"],
      ["noFoundItems", "No found items posted yet.", "dash_noFoundItems"],
      ["noFoundItemsSearch", "No items found for", "dash_noFoundItemsSearch"],
      ["tryKeywords", DEFAULT_STRINGS.tryKeywords, "dash_tryKeywords"],
      ["noLostItems", "No lost item reports yet.", "dash_noLostItems"],
      [
        "noLostItemsSearch",
        "No lost items found for",
        "dash_noLostItemsSearch",
      ],
      [
        "clickReportLost",
        DEFAULT_STRINGS.clickReportLost,
        "dash_clickReportLost",
      ],
      ["toggleFound", "Found an Item", "dash_toggleFound"],
      ["toggleLost", "Lost an Item", "dash_toggleLost"],
      ["reportFoundTitle", "Report Found Item", "dash_reportFoundTitle"],
      ["itemPosted", "Item posted!", "dash_itemPosted"],
      ["itemNameLabel", "Item Name", "dash_itemNameLabel"],
      ["itemNamePlaceholder", "Item Name", "dash_itemNamePlaceholder"],
      ["descriptionLabel", "Description", "dash_descriptionLabel"],
      [
        "descriptionPlaceholder",
        "Description (location, time, etc)",
        "dash_descriptionPlaceholder",
      ],
      ["locationLabel", "Where was it found?", "dash_locationLabel"],
      ["locationLostLabel", "Last seen where?", "dash_locationLostLabel"],
      ["photosLabel", "Photos (optional, up to 3)", "dash_photosLabel"],
      ["photosSelected", "photo(s) selected", "dash_photosSelected"],
      ["uploadPhotos", "Upload photos", "dash_uploadPhotos"],
      ["photoHint", DEFAULT_STRINGS.photoHint, "dash_photoHint"],
      ["cancelBtn", "Cancel", "dash_cancelBtn"],
      ["postItemBtn", "Post Item", "dash_postItemBtn"],
      ["uploadingBtn", "Uploading...", "dash_uploadingBtn"],
      ["reportLostTitle", "Report Lost Item", "dash_reportLostTitle"],
      ["lostItemPosted", "Lost item reported!", "dash_lostItemPosted"],
      ["whatLostLabel", "What did you lose?", "dash_whatLostLabel"],
      ["itemNameDefault", "Item Name", "dash_itemNameDefault"],
      [
        "descLostPlaceholder",
        "Description (location, time, etc)",
        "dash_descLostPlaceholder",
      ],
      ["postingBtn", "Posting...", "dash_postingBtn"],
      ["postLostBtn", "Post Lost Item", "dash_postLostBtn"],
      ["myItemsTitle", "My Items", "dash_myItemsTitle"],
      [
        "signInToView",
        "Please sign in to view your items.",
        "dash_signInToView",
      ],
      ["noItemsYet", "You haven't posted any items yet.", "dash_noItemsYet"],
      ["foundItemsPosted", "Found Items I Posted", "dash_foundItemsPosted"],
      ["lostItemsReported", "Lost Items I Reported", "dash_lostItemsReported"],
      ["claimPendingStatus", "Claim pending", "dash_claimPendingStatus"],
      ["activeStatus", "✓ Active", "dash_activeStatus"],
      ["confirmClaimed", "Confirm Claimed", "dash_confirmClaimed"],
      ["markAsFound", "Mark as Found", "dash_markAsFound"],
      ["becomeAdminTitle", "Become an Admin", "dash_becomeAdminTitle"],
      ["requestSubmitted", "Request submitted!", "dash_requestSubmitted"],
      ["reviewMsg", "We will review and get back to you.", "dash_reviewMsg"],
      ["fullNameLabel", "Full Name", "dash_fullNameLabel"],
      ["emailLabel", "Email", "dash_emailLabel"],
      ["schoolLabel", "School / Institution", "dash_schoolLabel"],
      ["schoolPlaceholder", "Lincoln High School", "dash_schoolPlaceholder"],
      ["teacherIdLabel", "Teacher ID / Staff Number", "dash_teacherIdLabel"],
      ["teacherIdPlaceholder", "T-00123", "dash_teacherIdPlaceholder"],
      ["uploadIdLabel", "Upload ID or Badge Photo", "dash_uploadIdLabel"],
      [
        "uploadIdPlaceholder",
        "Upload ID or badge photo",
        "dash_uploadIdPlaceholder",
      ],
      ["photoHintShort", "PNG, JPG up to 10MB", "dash_photoHintShort"],
      [
        "anythingElseLabel",
        "Anything else we should know?",
        "dash_anythingElseLabel",
      ],
      [
        "anythingElsePlaceholder",
        DEFAULT_STRINGS.anythingElsePlaceholder,
        "dash_anythingElsePlaceholder",
      ],
      ["submitRequestBtn", "Submit Request", "dash_submitRequestBtn"],
      ["submittingBtn", "Submitting...", "dash_submittingBtn"],
      ["adminAccessTitle", "Admin Access", "dash_adminAccessTitle"],
      ["adminLoginHint", DEFAULT_STRINGS.adminLoginHint, "dash_adminLoginHint"],
      ["adminPasswordLabel", "Admin Password", "dash_adminPasswordLabel"],
      [
        "adminPasswordPlaceholder",
        "e.g. FINDR-JANE-X4K2",
        "dash_adminPasswordPlaceholder",
      ],
      ["checkingBtn", "Checking...", "dash_checkingBtn"],
      ["unlockAdminBtn", "Unlock Admin View", "dash_unlockAdminBtn"],
      ["adminUnlocked", "Admin view unlocked!", "dash_adminUnlocked"],
      [
        "adminUnlockedSub",
        DEFAULT_STRINGS.adminUnlockedSub,
        "dash_adminUnlockedSub",
      ],
      ["adminIncorrect", DEFAULT_STRINGS.adminIncorrect, "dash_adminIncorrect"],
      ["reportedItemsTab", "Reported Items", "dash_reportedItemsTab"],
      ["reportedUsersTab", "Reported Users", "dash_reportedUsersTab"],
      ["reportedItemsTitle", "Reported Items", "dash_reportedItemsTitle"],
      ["reportedUsersTitle", "Reported Users", "dash_reportedUsersTitle"],
      ["loadingText", "Loading...", "dash_loadingText"],
      ["noItemReports", "No item reports. All clear!", "dash_noItemReports"],
      ["noUserReports", "No user reports. All clear!", "dash_noUserReports"],
      ["reportedBy", "Reported by", "dash_reportedBy"],
      ["postedBy", "Posted by", "dash_postedBy"],
      ["unknown", "Unknown", "dash_unknown"],
      ["dismissBtn", "Dismiss", "dash_dismissBtn"],
      ["deleteItemBtn", "Delete Item", "dash_deleteItemBtn"],
      ["banUserBtn", "Ban User", "dash_banUserBtn"],
      ["userEmailLabel", "User email:", "dash_userEmailLabel"],
      ["banMgmtTitle", "Ban Management", "dash_banMgmtTitle"],
      ["banMgmtHint", DEFAULT_STRINGS.banMgmtHint, "dash_banMgmtHint"],
      ["userEmailInputLabel", "User Email", "dash_userEmailInputLabel"],
      ["reasonLabel", "Reason", "dash_reasonLabel"],
      [
        "reasonPlaceholder",
        DEFAULT_STRINGS.reasonPlaceholder,
        "dash_reasonPlaceholder",
      ],
      ["permanentBtn", "Permanent", "dash_permanentBtn"],
      ["suspendBtn", "Suspend", "dash_suspendBtn"],
      [
        "suspendDaysLabel",
        "Suspend for how many days?",
        "dash_suspendDaysLabel",
      ],
      ["processingBtn", "Processing...", "dash_processingBtn"],
      ["banUserBtn2", "Ban User", "dash_banUserBtn2"],
      ["suspendUserBtn", "Suspend User", "dash_suspendUserBtn"],
      ["activeBansTitle", "Active Bans & Suspensions", "dash_activeBansTitle"],
      ["noBannedUsers", "No banned users.", "dash_noBannedUsers"],
      ["suspendedUntil", "Suspended until", "dash_suspendedUntil"],
      ["suspensionExpired", "Suspension expired", "dash_suspensionExpired"],
      ["permanentBan", "Permanent ban", "dash_permanentBan"],
      ["byLabel", "by", "dash_byLabel"],
      ["unbanBtn", "Unban", "dash_unbanBtn"],
      ["categoryLabel", "Category", "dash_categoryLabel"],
      ["categoryPlaceholder", "Select a category", "dash_categoryPlaceholder"],
      ["filterCategory", "Category", "dash_filterCategory"],
      ["filterLocation", "Location", "dash_filterLocation"],
      ["filterDate", "Date", "dash_filterDate"],
      ["filterAll", "All", "dash_filterAll"],
      ["clearFilters", "Clear filters", "dash_clearFilters"],
      ["myDashboardTab", "My Dashboard", "dash_myDashboardTab"],
      ["activeMember", "Active member", "dash_activeMember"],
      ["statPosted", "Posted", "dash_statPosted"],
      ["statReturned", "Returned", "dash_statReturned"],
      ["statLost", "Lost", "dash_statLost"],
      ["xpToNextLevel", "XP to next level", "dash_xpToNextLevel"],
      ["maxLevelReached", "Max level reached", "dash_maxLevelReached"],
      ["xpBreakdown", "XP breakdown", "dash_xpBreakdown"],
      ["xpReturn", "Return: +100 XP each", "dash_xpReturn"],
      ["xpPost", "Post: +20 XP each", "dash_xpPost"],
      ["xpReportLost", "Report lost: +5 XP each", "dash_xpReportLost"],
      ["monthlyActivity", "Monthly activity", "dash_monthlyActivity"],
      ["chartFound", "Found", "dash_chartFound"],
      ["chartLost", "Lost", "dash_chartLost"],
      ["chartReturned", "Returned", "dash_chartReturned"],
      ["actionBreakdown", "Action breakdown", "dash_actionBreakdown"],
      ["chartFoundPosted", "Found posted", "dash_chartFoundPosted"],
      ["chartLostReported", "Lost reported", "dash_chartLostReported"],
      ["noActivity", "No activity yet.", "dash_noActivity"],
      ["pendingClaimsTitle", "Pending Claims on My Items", "dash_pendingClaimsTitle"],
      ["levelLegend", "Legend", "dash_levelLegend"],
      ["levelChampion", "Champion", "dash_levelChampion"],
      ["levelFinder", "Finder", "dash_levelFinder"],
      ["levelHelper", "Helper", "dash_levelHelper"],
      ["levelNewcomer", "Newcomer", "dash_levelNewcomer"],
      ["brandTitle", "Findr Dashboard", "dash_brandTitle"],
      ["brandSub", "Your Lost & Found", "dash_brandSub"],
      ["noDisputes", "No disputes. All clear!", "dash_noDisputes"],
      ["disputesTab", "Disputes", "dash_disputesTab"],
      ["disputedBy", "Disputed by", "dash_disputedBy"],
      ["viewItemArrow", "View Item →", "dash_viewItemArrow"],
      ["dismissDispute", "Dismiss Dispute", "dash_dismissDispute"],
      ["resolveForClaimant", "Resolve for Claimant", "dash_resolveForClaimant"],
      ["messageParties", "Message Parties", "dash_messageParties"],
      ["claimantLabel", "Claimant", "dash_claimantLabel"],
      ["finderLabel", "Finder", "dash_finderLabel"],
      ["msgToClaimantPre", "Message to claimant (", "dash_msgToClaimantPre"],
      ["msgToClaimantPost", ")...", "dash_msgToClaimantPost"],
      ["msgToFinder", "Message to finder...", "dash_msgToFinder"],
      ["sendingBtn", "Sending...", "dash_sendingBtn"],
      ["sendMessageBtn", "Send Message", "dash_sendMessageBtn"],
      ["resolveForClaimantConfirm", DEFAULT_STRINGS.resolveForClaimantConfirm, "dash_resolveForClaimantConfirm"],
      ["dismissDisputeConfirm", DEFAULT_STRINGS.dismissDisputeConfirm, "dash_dismissDisputeConfirm"],
      ["deleteItemConfirmPre", "Delete \"", "dash_deleteItemConfirmPre"],
      ["deleteItemConfirmPost", "\" permanently?", "dash_deleteItemConfirmPost"],
      ["banConfirmPre", "Permanently ban", "dash_banConfirmPre"],
      ["unbanConfirmPre", "Unban", "dash_unbanConfirmPre"],
      ["failedPrefix", "Failed:", "dash_failedPrefix"],
      ["bannedSuccessPost", "has been permanently banned.", "dash_bannedSuccessPost"],
      ["suspendedSuccessMid", "has been suspended for", "dash_suspendedSuccessMid"],
      ["suspendedSuccessDays", "days.", "dash_suspendedSuccessDays"],
      ["unbannedSuccessPost", "has been unbanned.", "dash_unbannedSuccessPost"],
      ["deleteBlockedAlert", DEFAULT_STRINGS.deleteBlockedAlert, "dash_deleteBlockedAlert"],
      ["deleteSimpleConfirm", "Delete this item permanently?", "dash_deleteSimpleConfirm"],
      ["deletePendingConfirmPre", "There are", "dash_deletePendingConfirmPre"],
      ["deletePendingConfirmPost", DEFAULT_STRINGS.deletePendingConfirmPost, "dash_deletePendingConfirmPost"],
      ["deleteAcceptedConfirmPre", "You accepted", "dash_deleteAcceptedConfirmPre"],
      ["deleteAcceptedConfirmPost", DEFAULT_STRINGS.deleteAcceptedConfirmPost, "dash_deleteAcceptedConfirmPost"],
      ["claimCancelAlert", "This claim can no longer be cancelled.", "dash_claimCancelAlert"],
      ["deleteLostConfirm", "Delete this lost item report permanently?", "dash_deleteLostConfirm"],
      ["myActiveClaimsTitle", "My Active Claims", "dash_myActiveClaimsTitle"],
      ["noActiveClaims", "You have no active claims.", "dash_noActiveClaims"],
      ["claimAcceptedStatus", "Accepted: Coordinate Now", "dash_claimAcceptedStatus"],
      ["pendingReviewStatus", "Pending Review", "dash_pendingReviewStatus"],
      ["goToItemBtn", "Go to Item", "dash_goToItemBtn"],
      ["cancelClaimBtn", "Cancel Claim", "dash_cancelClaimBtn"],
      ["pendingClaimSingular", "pending claim", "dash_pendingClaimSingular"],
      ["pendingClaimsPlural", "pending claims", "dash_pendingClaimsPlural"],
      ["reviewItemBtn", "Review", "dash_reviewItemBtn"],
      ["claimInProgressStatus", "Claim in progress", "dash_claimInProgressStatus"],
      ["awaitingConfirmStatus", "Awaiting confirmation", "dash_awaitingConfirmStatus"],
      ["disputedStatus", "Disputed", "dash_disputedStatus"],
    ];

    const translateAll = async () => {
      await batchTranslate(
        translations,
        language,
        (updates) => setS((prev) => ({ ...prev, ...updates })),
      );
      setIsReady(true);
    };

    translateAll();
  }, [language, hydrated]);

  // Translate categories independently so they're ready as soon as language changes.
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setCatMap({}); return; }

    // Apply any already-cached category translations immediately (synchronous).
    const initial: Record<string, string> = {};
    for (const cat of CATEGORIES) {
      const cached = localStorage.getItem(`t:${language}:${cat}`);
      if (cached) initial[cat] = cached;
    }
    setCatMap(initial);

    const missing = CATEGORIES.filter((cat) => !initial[cat]);
    if (missing.length === 0) return;

    (async () => {
      const updates = { ...initial };
      await Promise.all(
        missing.map(async (cat) => {
          try {
            const res = await fetch("/api/translate", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ text: cat, target: language }),
            });
            if (res.ok) {
              const d = await res.json();
              const v = d.translatedText || cat;
              updates[cat] = v;
              localStorage.setItem(`t:${language}:${cat}`, v);
            }
          } catch {}
        }),
      );
      setCatMap(updates);
    })();
  }, [language, hydrated]);

  // Translate item titles whenever items load or language changes.
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setNameMap({}); return; }
    const allItems = [
      ...(items ?? []).map((i) => ({ id: i.id, name: i.name })),
      ...(lostItems ?? []).map((i) => ({ id: i.id, name: i.name })),
    ];
    if (allItems.length === 0) return;

    const initial: Record<number, string> = {};
    for (const { id, name } of allItems) {
      const cached = localStorage.getItem(`t:${language}:${name}`);
      if (cached) initial[id] = cached;
    }
    setNameMap(initial);

    (async () => {
      const updates = { ...initial };
      let changed = false;
      for (const { id, name } of allItems) {
        if (initial[id]) continue;
        const key = `t:${language}:${name}`;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: name, target: language }),
          });
          if (res.ok) {
            const d = await res.json();
            const v = d.translatedText || name;
            updates[id] = v;
            localStorage.setItem(key, v);
            changed = true;
          }
        } catch {}
      }
      if (changed) setNameMap(updates);
    })();
  }, [language, hydrated, items, lostItems]);

  // ── Item form state ───────────────────────────────────────────────────────
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [foundLocation, setFoundLocation] = useState<LocationData | null>(null);

  const [lostItemName, setLostItemName] = useState("");
  const [lostItemDesc, setLostItemDesc] = useState("");
  const [lostItemCategory, setLostItemCategory] = useState("");
  const [lostSelectedFiles, setLostSelectedFiles] = useState<File[]>([]);
  const [lostItemUploading, setLostItemUploading] = useState(false);
  const [lostItemSuccess, setLostItemSuccess] = useState(false);
  const [lostLocation, setLostLocation] = useState<LocationData | null>(null);

  const [matchModal, setMatchModal] = useState<{
    items: Array<{
      id: number;
      name: string;
      image: string | null;
      category: string | null;
      location: string | null;
      description: string;
      postedAt: string | null;
      authorName: string | null;
    }>;
    mode: "found" | "lost";
    onContinue: () => void;
  } | null>(null);
  const [matchChecking, setMatchChecking] = useState(false);

  // ── Crop state ────────────────────────────────────────────────────────────
  const [cropQueue, setCropQueue] = useState<File[]>([]);
  const [cropIndex, setCropIndex] = useState(0);
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<"found" | "lost" | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [cropResults, setCropResults] = useState<File[]>([]);

  const startCropQueue = (files: File[], target: "found" | "lost") => {
    setCropResults([]);
    setCropQueue(files);
    setCropIndex(0);
    setCropTarget(target);
    const url = URL.createObjectURL(files[0]);
    setCropSrc(url);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setRotation(0);
  };

  const advanceCropQueue = (
    results: File[],
    queue: File[],
    idx: number,
    target: "found" | "lost",
  ) => {
    URL.revokeObjectURL(cropSrc!);
    if (idx + 1 < queue.length) {
      setCropResults(results);
      setCropIndex(idx + 1);
      setCropSrc(URL.createObjectURL(queue[idx + 1]));
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
    } else {
      if (target === "found") setSelectedFiles(results);
      else setLostSelectedFiles(results);
      setCropSrc(null);
      setCropQueue([]);
      setCropResults([]);
      setCropTarget(null);
    }
  };

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels || !cropTarget) return;
    const cropped = await getCroppedImg(cropSrc, croppedAreaPixels, rotation);
    const newResults = [...cropResults, cropped];
    advanceCropQueue(newResults, cropQueue, cropIndex, cropTarget);
  };

  const handleCropSkip = () => {
    if (!cropSrc || !cropTarget) return;
    const original = cropQueue[cropIndex];
    const newResults = [...cropResults, original];
    advanceCropQueue(newResults, cropQueue, cropIndex, cropTarget);
  };

  const handleConfirmClaimed = async (itemId: number) => {
    if (!user?.id) return;
    const res = await fetch("/api/confirm-return", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ item_id: itemId, user_id: user.id }),
    });
    if (res.ok) {
      removeItem(itemId);
      setTotalReturnedByMe((prev) => prev + 1);
      setMyReturnedItems((prev) => [
        ...prev,
        { id: itemId, returned_at: new Date().toISOString(), date_found: new Date().toISOString() },
      ]);
    }
  };

  const handleDelete = async (itemId: number) => {
    const foundItem = (items ?? []).find((i) => i.id === itemId) as any;
    const itemStatus = foundItem?.status || "waiting";

    // Case D: cannot delete while handoff or dispute in progress
    if (itemStatus === "handed_off" || itemStatus === "disputed") {
      alert(s.deleteBlockedAlert);
      return;
    }

    const { data: allClaims } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("item_id", itemId);

    const pendClaimsArr = (allClaims || []).filter((c: any) => c.status === "pending");
    const hasActiveClaims = (allClaims || []).some(
      (c: any) => c.status === "pending" || c.status === "accepted",
    );
    const itemName = foundItem?.name || "this item";

    // Case A: no claims or all resolved
    if (!allClaims || allClaims.length === 0 || !hasActiveClaims) {
      if (!confirm(s.deleteSimpleConfirm)) return;
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (!error) updateItemStatus(itemId, "claimed");
      return;
    }

    // Case B: waiting with pending claims
    if (itemStatus === "waiting" && pendClaimsArr.length > 0) {
      if (!confirm(`${s.deletePendingConfirmPre} ${pendClaimsArr.length} ${s.deletePendingConfirmPost}`)) return;
      for (const c of pendClaimsArr) {
        sendEmail("claim-rejected", {
          claimant_email: c.claimant_email,
          claimant_name: c.claimant_name,
          item_name: itemName,
          rejection_reason: "The item was removed by the finder.",
        });
      }
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (!error) updateItemStatus(itemId, "claimed");
      return;
    }

    // Case C: claim_accepted
    if (itemStatus === "claim_accepted") {
      const accName = foundItem?.accepted_claimant_name || "the claimant";
      const accEmail = foundItem?.accepted_claimant_email || "";
      if (!confirm(`${s.deleteAcceptedConfirmPre} ${accName}${s.deleteAcceptedConfirmPost}`)) return;
      if (accEmail) {
        sendEmail("claim-rejected", {
          claimant_email: accEmail,
          claimant_name: accName,
          item_name: itemName,
          rejection_reason:
            "The item listing was removed by the finder after your claim was accepted. Please contact your school admin if you believe this is incorrect.",
        });
      }
      const { error } = await supabase.from("items").delete().eq("id", itemId);
      if (!error) updateItemStatus(itemId, "claimed");
      return;
    }
  };

  const handleCancelClaim = async (claimId: string, itemId: number) => {
    const { data: freshItem } = await supabase
      .from("items")
      .select("status")
      .eq("id", itemId)
      .maybeSingle();
    if (!freshItem || freshItem.status !== "waiting") {
      alert(s.claimCancelAlert);
      return;
    }
    await supabase
      .from("claim_requests")
      .update({ status: "cancelled", updated_at: new Date().toISOString() })
      .eq("id", claimId);
    setMyActiveClaims((prev) => prev.filter((c) => c.id !== claimId));
  };

  const handleDeleteLostItem = async (itemId: number) => {
    if (!confirm(s.deleteLostConfirm)) return;
    const { error } = await supabase
      .from("lost_items")
      .delete()
      .eq("id", itemId);
    if (!error) removeLostItem(itemId);
  };

  const handleMarkFound = async (itemId: number) => {
    const { error } = await supabase
      .from("lost_items")
      .delete()
      .eq("id", itemId);
    if (!error) removeLostItem(itemId);
  };

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

  const doFoundSubmit = async () => {
    if (
      !newItemName ||
      !newItemDesc ||
      selectedFiles.length === 0 ||
      !user ||
      !foundLocation
    )
      return;
    setIsUploading(true);
    try {
      const imageUrls: string[] = [];
      const aiKeywordsArray: string[] = [];
      for (const file of selectedFiles.slice(0, 3)) {
        const fileName = `${Date.now()}_${Math.random()}_${file.name}`;
        const uploadResult = await supabase.storage
          .from("item-images")
          .upload(fileName, file);
        if (uploadResult.error) {
          console.error("Upload error:", uploadResult.error.message);
          continue;
        }
        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
        const keywords = await extractKeywords(file);
        if (keywords) aiKeywordsArray.push(keywords);
      }
      if (imageUrls.length === 0) {
        console.error("No images uploaded successfully");
        return;
      }
      const { data: insertedItem, error: insertError } = await supabase
        .from("items")
        .insert([
          {
            name: newItemName,
            description: newItemDesc,
            category: newItemCategory || null,
            image_url: imageUrls[0],
            image_urls: imageUrls,
            author_name: user.fullName || user.username || "Anonymous",
            author_avatar: user.imageUrl,
            author_id: user.id,
            author_email: user.primaryEmailAddress?.emailAddress,
            status: "waiting",
            ai_keywords: aiKeywordsArray.join(", "),
            date_found: new Date().toISOString(),
            location: foundLocation.address,
            latitude: foundLocation.lat,
            longitude: foundLocation.lng,
          },
        ])
        .select()
        .single();
      if (insertError) {
        console.error("Insert error:", insertError.message);
        return;
      }
      addItem({
        id: insertedItem.id,
        name: insertedItem.name,
        description: insertedItem.description,
        image: insertedItem.image_url,
        images: imageUrls,
        authorName: insertedItem.author_name,
        authorAvatar: insertedItem.author_avatar,
        status: insertedItem.status,
        authorId: insertedItem.author_id,
        authorEmail: insertedItem.author_email || "",
        aiKeywords: insertedItem.ai_keywords || "",
        category: insertedItem.category || "",
        location: insertedItem.location ?? null,
        latitude: insertedItem.latitude ?? null,
        longitude: insertedItem.longitude ?? null,
      } as any);
      setNewItemName("");
      setNewItemDesc("");
      setNewItemCategory("");
      setSelectedFiles([]);
      setFoundLocation(null);
      setUploadSuccess(true);
      setTimeout(() => {
        setUploadSuccess(false);
        setActiveTab("items");
      }, 1500);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !newItemName ||
      !newItemDesc ||
      selectedFiles.length === 0 ||
      !user ||
      !foundLocation
    )
      return;
    setMatchChecking(true);
    try {
      const res = await fetch("/api/match-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${newItemName}${newItemCategory ? " " + newItemCategory : ""} ${newItemDesc}`,
          mode: "found",
        }),
      });
      const data = await res.json();
      if (data.items?.length > 0) {
        setMatchModal({ items: data.items, mode: "found", onContinue: doFoundSubmit });
        return;
      }
    } catch {
      // fall through to submit if check fails
    } finally {
      setMatchChecking(false);
    }
    doFoundSubmit();
  };

  const doLostSubmit = async () => {
    if (!lostItemName || !lostItemDesc || !user || !lostLocation) return;
    setLostItemUploading(true);
    try {
      const imageUrls: string[] = [];
      for (const file of lostSelectedFiles.slice(0, 3)) {
        const fileName = `lost_${Date.now()}_${Math.random()}_${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("item-images")
          .upload(fileName, file);
        if (uploadError) {
          console.error("Upload error:", uploadError.message);
          continue;
        }
        const { data: urlData } = supabase.storage
          .from("item-images")
          .getPublicUrl(fileName);
        imageUrls.push(urlData.publicUrl);
      }
      const { data: insertedItem, error: insertError } = await supabase
        .from("lost_items")
        .insert([
          {
            name: lostItemName,
            description: lostItemDesc,
            category: lostItemCategory || null,
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            author_name: user.fullName || user.username || "Anonymous",
            author_avatar: user.imageUrl,
            author_id: user.id,
            author_email: user.primaryEmailAddress?.emailAddress,
            status: "looking",
            location: lostLocation.address,
            latitude: lostLocation.lat,
            longitude: lostLocation.lng,
          },
        ])
        .select()
        .single();
      if (insertError) {
        console.error("Insert error:", insertError.message);
        return;
      }
      addLostItem({
        id: insertedItem.id,
        name: insertedItem.name,
        description: insertedItem.description,
        image: imageUrls[0] || "",
        images: imageUrls,
        authorName: insertedItem.author_name,
        authorAvatar: insertedItem.author_avatar,
        authorId: insertedItem.author_id,
        authorEmail: insertedItem.author_email || "",
        status: insertedItem.status,
        created_at: insertedItem.created_at,
        category: insertedItem.category || "",
        location: insertedItem.location ?? null,
        latitude: insertedItem.latitude ?? null,
        longitude: insertedItem.longitude ?? null,
      });
      setLostItemName("");
      setLostItemDesc("");
      setLostItemCategory("");
      setLostSelectedFiles([]);
      setLostLocation(null);
      setLostItemSuccess(true);
      setTimeout(() => {
        setLostItemSuccess(false);
        setActiveTab("items");
        setBoardTab("lost");
      }, 1500);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLostItemUploading(false);
    }
  };

  const handleLostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostItemName || !lostItemDesc || !user || !lostLocation) return;
    setMatchChecking(true);
    try {
      const res = await fetch("/api/match-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `${lostItemName}${lostItemCategory ? " " + lostItemCategory : ""} ${lostItemDesc}`,
          mode: "lost",
        }),
      });
      const data = await res.json();
      if (data.items?.length > 0) {
        setMatchModal({ items: data.items, mode: "lost", onContinue: doLostSubmit });
        return;
      }
    } catch {
      // fall through to submit if check fails
    } finally {
      setMatchChecking(false);
    }
    doLostSubmit();
  };

  // ── Filtering logic ─────────────────────────────────────────────────────────
  const applyFilters = (itemList: any[]) => {
    return itemList.filter((item) => {
      if (filterCategory && (item.category ?? "") !== filterCategory)
        return false;
      if (filterLocation) {
        const loc = (item.location ?? "").toLowerCase();
        if (!loc.includes(filterLocation.toLowerCase())) return false;
      }
      if (filterDateFrom) {
        const itemDate = item.date_found || item.created_at;
        if (!itemDate || new Date(itemDate) < new Date(filterDateFrom))
          return false;
      }
      if (filterDateTo) {
        const itemDate = item.date_found || item.created_at;
        if (
          !itemDate ||
          new Date(itemDate) > new Date(filterDateTo + "T23:59:59")
        )
          return false;
      }
      return true;
    });
  };

  const filteredItems = applyFilters(
    searchQuery.trim()
      ? (items ?? []).filter((item) => {
          const q = searchQuery.toLowerCase();
          const haystack =
            `${item.name} ${item.description} ${(item as any).aiKeywords ?? ""} ${item.category ?? ""}`.toLowerCase();
          return (
            haystack.includes(q) ||
            q.split(/\s+/).some((word) => haystack.includes(word))
          );
        })
      : (items ?? []),
  );

  const filteredLostItems = applyFilters(
    searchQuery.trim()
      ? (lostItems ?? []).filter((item) => {
          const q = searchQuery.toLowerCase();
          const haystack =
            `${item.name} ${item.description} ${item.category ?? ""}`.toLowerCase();
          return (
            haystack.includes(q) ||
            q.split(/\s+/).some((word) => haystack.includes(word))
          );
        })
      : (lostItems ?? []),
  );

  // ── Sidebar tabs ────────────────────────────────────────────────────────
  const SIDEBAR_TABS: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    { id: "items", label: s.tabItems, icon: <HiOutlineMagnifyingGlass /> },
    { id: "my-items", label: s.myDashboardTab, icon: <FaClipboard /> },
    { id: "report-item", label: s.tabReportItem, icon: <FaPlus /> },
    { id: "become-admin", label: s.tabBecomeAdmin, icon: <FaClipboard /> },
    { id: "admin-login", label: s.tabAdmin, icon: <CiLogin /> },
    {
      id: "reports",
      label: s.tabReports,
      icon: <MdFlagCircle />,
      adminOnly: true,
    },
    {
      id: "ban-management",
      label: s.tabBanManagement,
      icon: <ImHammer2 />,
      adminOnly: true,
    },
    { id: "inbox", label: s.tabInbox, icon: <IoMdMailOpen />, adminOnly: true },
  ];

  // ── Report Item pill toggle ───────────────────────────────────────────────
  const ReportItemToggle = () => (
    <div
      style={{
        display: "flex",
        background: "var(--bg-input)",
        border: "1.5px solid var(--border-input)",
        borderRadius: "100px",
        padding: "4px",
        gap: "2px",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {(["found", "lost"] as const).map((mode) => {
        const isActive = reportMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setReportMode(mode)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: "100px",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.1px",
              transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              background: isActive ? "var(--accent)" : "transparent",
              color: isActive ? "#fff" : "var(--text-muted)",
              boxShadow: isActive
                ? "0 2px 10px rgba(var(--accent-rgb, 47,128,237), 0.35)"
                : "none",
              transform: isActive ? "scale(1.02)" : "scale(1)",
            }}
          >
            {mode === "found" ? s.toggleFound : s.toggleLost}
          </button>
        );
      })}
    </div>
  );

  const renderMainContent = () => {
    switch (activeTab) {
      case "report-item":
        return (
          <div className="main-panel-content">
            <div className="main-panel-section-title">
              {reportMode === "found" ? s.reportFoundTitle : s.reportLostTitle}
            </div>

            <ReportItemToggle />

            {/* ── Found form ── */}
            {reportMode === "found" && (
              <>
                {uploadSuccess ? (
                  <div className="panel-success">
                    <span className="panel-success__icon">✓</span>
                    <p>{s.itemPosted}</p>
                  </div>
                ) : (
                  <form className="panel-form" onSubmit={handleSubmit}>
                    <label className="panel-form__label">
                      {s.itemNameLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={s.itemNamePlaceholder}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      required
                      className="panel-form__input"
                    />

                    <label className="panel-form__label">
                      {s.categoryLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <CategorySelect
                      value={newItemCategory}
                      onChange={setNewItemCategory}
                      placeholder={s.categoryPlaceholder}
                    />

                    <label className="panel-form__label">
                      {s.descriptionLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <textarea
                      placeholder={s.descriptionPlaceholder}
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      required
                      className="panel-form__textarea"
                    />

                    <label className="panel-form__label">
                      {s.locationLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <LocationPicker
                      value={foundLocation}
                      onChange={setFoundLocation}
                      required
                    />

                    <label className="panel-form__label">{s.photosLabel}</label>
                    <label
                      className="panel-form__file-label"
                      htmlFor="found-file-upload"
                    >
                      <span className="panel-form__file-icon">+</span>
                      <span className="panel-form__file-text">
                        {selectedFiles.length > 0
                          ? `${selectedFiles.length} ${s.photosSelected}`
                          : s.uploadPhotos}
                      </span>
                    </label>
                    <input
                      id="found-file-upload"
                      className="panel-form__file"
                      type="file"
                      accept="image/*"
                      multiple
                      required
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files).slice(0, 3);
                          if (files.length > 0) startCropQueue(files, "found");
                        }
                      }}
                    />
                    <p className="panel-form__file-hint">{s.photoHint}</p>
                    {selectedFiles.length > 0 && (
                      <div className="panel-form__preview-wrap">
                        {selectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              marginRight: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`preview ${idx + 1}`}
                              className="panel-form__preview"
                            />
                            <button
                              type="button"
                              className="panel-form__preview-remove"
                              onClick={() =>
                                setSelectedFiles(
                                  selectedFiles.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="panel-form__actions">
                      <button
                        type="button"
                        className="panel-form__cancel"
                        onClick={() => {
                          setNewItemName("");
                          setNewItemDesc("");
                          setNewItemCategory("");
                          setSelectedFiles([]);
                          setFoundLocation(null);
                          setActiveTab("items");
                        }}
                      >
                        {s.cancelBtn}
                      </button>
                      <button
                        type="submit"
                        className="panel-form__submit"
                        disabled={isUploading || !foundLocation || matchChecking}
                      >
                        {matchChecking ? "Checking..." : isUploading ? s.uploadingBtn : s.postItemBtn}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}

            {/* ── Lost form ── */}
            {reportMode === "lost" && (
              <>
                {lostItemSuccess ? (
                  <div className="panel-success">
                    <span className="panel-success__icon">✓</span>
                    <p>{s.lostItemPosted}</p>
                  </div>
                ) : (
                  <form className="panel-form" onSubmit={handleLostSubmit}>
                    <label className="panel-form__label">
                      {s.whatLostLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder={s.itemNameDefault}
                      value={lostItemName}
                      onChange={(e) => setLostItemName(e.target.value)}
                      required
                      className="panel-form__input"
                    />

                    <label className="panel-form__label">
                      {s.categoryLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <CategorySelect
                      value={lostItemCategory}
                      onChange={setLostItemCategory}
                      placeholder={s.categoryPlaceholder}
                    />

                    <label className="panel-form__label">
                      {s.descriptionLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <textarea
                      placeholder={s.descLostPlaceholder}
                      value={lostItemDesc}
                      onChange={(e) => setLostItemDesc(e.target.value)}
                      required
                      className="panel-form__textarea"
                    />

                    <label className="panel-form__label">
                      {s.locationLostLabel}{" "}
                      <span style={{ color: "var(--danger)" }}>*</span>
                    </label>
                    <LocationPicker
                      value={lostLocation}
                      onChange={setLostLocation}
                      required
                    />

                    <label className="panel-form__label">{s.photosLabel}</label>
                    <label
                      className="panel-form__file-label"
                      htmlFor="lost-file-upload"
                    >
                      <span className="panel-form__file-icon">+</span>
                      <span className="panel-form__file-text">
                        {lostSelectedFiles.length > 0
                          ? `${lostSelectedFiles.length} ${s.photosSelected}`
                          : s.uploadPhotos}
                      </span>
                    </label>
                    <input
                      id="lost-file-upload"
                      className="panel-form__file"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => {
                        if (e.target.files) {
                          const files = Array.from(e.target.files).slice(0, 3);
                          if (files.length > 0) startCropQueue(files, "lost");
                        }
                      }}
                    />
                    <p className="panel-form__file-hint">{s.photoHint}</p>
                    {lostSelectedFiles.length > 0 && (
                      <div className="panel-form__preview-wrap">
                        {lostSelectedFiles.map((file, idx) => (
                          <div
                            key={idx}
                            style={{
                              position: "relative",
                              display: "inline-block",
                              marginRight: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <img
                              src={URL.createObjectURL(file)}
                              alt={`preview ${idx + 1}`}
                              className="panel-form__preview"
                            />
                            <button
                              type="button"
                              className="panel-form__preview-remove"
                              onClick={() =>
                                setLostSelectedFiles(
                                  lostSelectedFiles.filter((_, i) => i !== idx),
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="panel-form__actions">
                      <button
                        type="button"
                        className="panel-form__cancel"
                        onClick={() => {
                          setLostItemName("");
                          setLostItemDesc("");
                          setLostItemCategory("");
                          setLostSelectedFiles([]);
                          setLostLocation(null);
                          setActiveTab("items");
                        }}
                      >
                        {s.cancelBtn}
                      </button>
                      <button
                        type="submit"
                        className="panel-form__submit"
                        disabled={lostItemUploading || !lostLocation || matchChecking}
                      >
                        {matchChecking ? "Checking..." : lostItemUploading ? s.postingBtn : s.postLostBtn}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        );

      case "become-admin":
        return <AdminPanel s={s} />;

      case "admin-login":
        return <AdminLoginPanel onUnlock={() => setIsAdmin(true)} s={s} />;

      case "reports":
        return isAdmin ? (
          <>
            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "16px 20px 0",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {(["items", "users"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setReportsTab(t)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px 8px 0 0",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-body)",
                    background:
                      reportsTab === t ? "var(--danger)" : "var(--bg-page)",
                    color: reportsTab === t ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t === "items" ? s.reportedItemsTab : s.reportedUsersTab}
                </button>
              ))}
              <button
                onClick={() => setReportsTab("disputes")}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px 8px 0 0",
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  fontFamily: "var(--font-body)",
                  background:
                    reportsTab === "disputes" ? "var(--danger)" : "var(--bg-page)",
                  color: reportsTab === "disputes" ? "#fff" : "var(--text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                {s.disputesTab}
              </button>
            </div>
            <div className="main-panel-content" style={{ maxWidth: "720px" }}>
              <div className="main-panel-section-title">
                {reportsTab === "items"
                  ? s.reportedItemsTitle
                  : reportsTab === "users"
                    ? s.reportedUsersTitle
                    : s.disputesTab}
              </div>
              {reportsTab === "items" && (
                <ReportedItemsPanel updateItemStatus={updateItemStatus} s={s} />
              )}
              {reportsTab === "users" && (
                <ReportedUsersPanel
                  adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
                  s={s}
                />
              )}
              {reportsTab === "disputes" && <DisputesPanel s={s} adminId={adminId} adminName={adminName} />}
            </div>
          </>
        ) : null;

      case "ban-management":
        return isAdmin ? (
          <BanManagementPanel
            adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
            s={s}
          />
        ) : null;

      case "inbox":
        return isAdmin ? (
          <AdminInboxPanel
            adminId={adminId}
            adminName={adminName}
            adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
          />
        ) : null;

      case "my-items": {
        const myFoundItems = (items ?? []).filter(
          (item) => item.authorId === user?.id && item.status !== "claimed",
        );
        const myLostItems = (lostItems ?? []).filter(
          (item) => item.authorId === user?.id,
        );

        // POSTED = items still active in the feed + items already returned.
        const totalFound = myFoundItems.length + totalReturnedByMe;
        const totalLost = myLostItems.length;
        const totalClaimed = totalReturnedByMe;
        const totalActions = totalFound + totalLost + totalClaimed;

        const xp = totalReturnedByMe * 100 + totalFound * 20 + totalLost * 5;
        const userLevel = xp >= 1000 ? s.levelLegend : xp >= 600 ? s.levelChampion : xp >= 300 ? s.levelFinder : xp >= 100 ? s.levelHelper : s.levelNewcomer;
        const xpNext = xp >= 1000 ? null : xp >= 600 ? 1000 : xp >= 300 ? 600 : xp >= 100 ? 300 : 100;
        const xpPrev = xp >= 1000 ? 600 : xp >= 600 ? 600 : xp >= 300 ? 300 : xp >= 100 ? 100 : 0;
        const xpPct = xpNext !== null ? Math.min(100, Math.round(((xp - xpPrev) / (xpNext - xpPrev)) * 100)) : 100;

        const now = new Date();
        const months: string[] = [];
        const monthLabels: string[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push(
            `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
          );
          monthLabels.push(d.toLocaleString("default", { month: "short" }));
        }

        const foundByMonth = months.map((m) => {
          const active = (items ?? []).filter((item) => {
            if (item.authorId !== user?.id) return false;
            if (item.status === "claimed") return false;
            const d = (item as any).date_found || (item as any).created_at || "";
            return d.startsWith(m);
          }).length;
          // Returned items are gone from `items`, so count their original found date too.
          const returned = (myReturnedItems ?? []).filter((item) => {
            const d = item.date_found || "";
            return d.startsWith(m);
          }).length;
          return active + returned;
        });
        const lostByMonth = months.map((m) =>
          (lostItems ?? []).filter((item) => {
            if (item.authorId !== user?.id) return false;
            const d = (item as any).created_at || "";
            return d.startsWith(m);
          }).length,
        );
        const returnedByMonth = months.map((m) =>
          (myReturnedItems ?? []).filter((item) => {
            const d = item.returned_at || item.date_found || "";
            return d.startsWith(m);
          }).length,
        );

        const chartDataJson = JSON.stringify({
          monthLabels,
          foundByMonth,
          lostByMonth,
          returnedByMonth,
        });
        const pieDataJson = JSON.stringify({ totalFound, totalLost, totalReturned: totalClaimed });
        const dashStyle = typeof window !== "undefined" ? getComputedStyle(document.documentElement) : null;
        const clrFound = dashStyle?.getPropertyValue("--accent").trim() || "#2f80ed";
        const clrLost = "#ef4444";
        const clrClaimed = dashStyle?.getPropertyValue("--success").trim() || "#10b981";

        const chartKey = `${user?.id}-${totalActions}-${theme}-${totalReturnedByMe}-${language}`;

        return (
          <div
            className="my-dash-root"
            style={{
              maxWidth: 960,
              width: "100%",
              margin: "0 auto",
              padding: "24px 0",
              display: "flex",
              flexDirection: "column",
              gap: 20,
            }}
          >
            {/* ── Profile card ── */}
            <div
              className="my-dash-profile-card"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "18px 20px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                boxShadow: "var(--card-shadow)",
              }}
            >
              <div className="my-dash-profile-top">
                {user?.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt="Profile"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "2.5px solid var(--accent)",
                      flexShrink: 0,
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: "50%",
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 24,
                      fontWeight: 700,
                      fontFamily: "var(--font-body)",
                      flexShrink: 0,
                    }}
                  >
                    {(user?.fullName || user?.username || "?")[0]?.toUpperCase()}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p
                    style={{
                      margin: "0 0 2px",
                      fontFamily: "var(--font-body)",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "var(--text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.fullName || user?.username || "Anonymous"}
                  </p>
                  <p
                    style={{
                      margin: "0 0 8px",
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {user?.primaryEmailAddress?.emailAddress || ""}
                  </p>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 5,
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "var(--accent-light)",
                      color: "var(--accent)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    {s.activeMember}
                  </span>
                </div>
              </div>
              <div className="my-dash-stats" style={{ display: "flex", gap: 20, flexShrink: 0 }}>
                {(
                  [
                    [s.statPosted, totalFound, clrFound],
                    [s.statReturned, totalClaimed, clrClaimed],
                    [s.statLost, totalLost, clrLost],
                  ] as [string, number, string][]
                ).map(([label, val, color]) => (
                  <div key={label} style={{ textAlign: "center" }}>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-body)",
                        fontSize: 22,
                        fontWeight: 700,
                        color,
                      }}
                    >
                      {val}
                    </p>
                    <p
                      style={{
                        margin: 0,
                        fontFamily: "var(--font-body)",
                        fontSize: 10,
                        color: "var(--text-muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.5px",
                      }}
                    >
                      {label}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* ── XP / Level card ── */}
            <div
              className="my-dash-xp-card"
              style={{
                padding: "16px 20px",
                background: "var(--bg-card)",
                border: "1px solid var(--border-default)",
                borderRadius: 16,
                boxShadow: "var(--card-shadow)",
                display: "flex",
                alignItems: "center",
                gap: 20,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 26, fontWeight: 700, color: clrFound }}>{xp} XP</span>
                  <span style={{ fontFamily: "var(--font-body)", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", padding: "2px 10px", borderRadius: 20, background: "var(--accent-light)" }}>{userLevel}</span>
                </div>
                <div style={{ height: 6, background: "var(--border-default)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
                  <div style={{ height: "100%", width: `${xpPct}%`, background: clrFound, borderRadius: 3, transition: "width 0.5s ease" }} />
                </div>
                {xpNext !== null
                  ? <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)" }}>{xp} / {xpNext} {s.xpToNextLevel}</p>
                  : <p style={{ margin: 0, fontFamily: "var(--font-body)", fontSize: 10, color: clrFound }}>{s.maxLevelReached}</p>}
              </div>
              <div className="my-dash-xp-breakdown" style={{ display: "flex", flexDirection: "column", gap: 4, flexShrink: 0, textAlign: "right" }}>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{s.xpBreakdown}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpReturn}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpPost}</span>
                <span style={{ fontFamily: "var(--font-body)", fontSize: 11, color: "var(--text-secondary)" }}>{s.xpReportLost}</span>
              </div>
            </div>

            {/* ── Charts row ── */}
            <div className="my-dash-charts-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Bar chart */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  boxShadow: "var(--card-shadow)",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {s.monthlyActivity}
                </p>
                <div
                  style={{ display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" }}
                >
                  {(
                    [
                      [s.chartFound, clrFound],
                      [s.chartLost, clrLost],
                      [s.chartReturned, clrClaimed],
                    ] as [string, string][]
                  ).map(([l, c]) => (
                    <span
                      key={l}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 5,
                        fontFamily: "var(--font-body)",
                        fontSize: 11,
                        color: "var(--text-secondary)",
                      }}
                    >
                      <span
                        style={{
                          width: 9,
                          height: 9,
                          borderRadius: 2,
                          background: c,
                          flexShrink: 0,
                        }}
                      />
                      {l}
                    </span>
                  ))}
                </div>
                <div style={{ position: "relative", height: 180, width: "100%" }}>
                  <canvas
                    id={`myDashBarChart-${chartKey}`}
                    role="img"
                    aria-label="Bar chart showing monthly found, lost, and claimed item activity"
                  >
                    Monthly activity chart.
                  </canvas>
                </div>
              </div>

              {/* Doughnut chart */}
              <div
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-default)",
                  borderRadius: 14,
                  padding: "16px 18px",
                  boxShadow: "var(--card-shadow)",
                  overflow: "hidden",
                  minWidth: 0,
                }}
              >
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-body)",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "var(--text-primary)",
                  }}
                >
                  {s.actionBreakdown}
                </p>
                {totalActions === 0 ? (
                  <p
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: 12,
                      color: "var(--text-muted)",
                      padding: "20px 0",
                    }}
                  >
                    {s.noActivity}
                  </p>
                ) : (
                  <>
                    <div
                      style={{
                        display: "flex",
                        gap: 12,
                        marginBottom: 12,
                        flexWrap: "wrap",
                      }}
                    >
                      {(
                        [
                          [s.chartFoundPosted, clrFound, totalFound],
                          [s.chartLostReported, clrLost, totalLost],
                          [s.chartReturned, clrClaimed, totalClaimed],
                        ] as [string, string, number][]
                      ).map(([l, c, v]) => (
                        <span
                          key={l}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 5,
                            fontFamily: "var(--font-body)",
                            fontSize: 11,
                            color: "var(--text-secondary)",
                          }}
                        >
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              borderRadius: 2,
                              background: c,
                              flexShrink: 0,
                            }}
                          />
                          {l}{" "}
                          {totalActions > 0
                            ? Math.round((v / totalActions) * 100)
                            : 0}
                          %
                        </span>
                      ))}
                    </div>
                    <div style={{ position: "relative", height: 180, width: "100%" }}>
                      <canvas
                        id={`myDashPieChart-${chartKey}`}
                        role="img"
                        aria-label="Doughnut chart showing breakdown of user actions"
                      >
                        Action breakdown chart.
                      </canvas>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* ── Chart init ── */}
            <MyDashboardCharts
              chartKey={chartKey}
              chartData={chartDataJson}
              pieData={pieDataJson}
              labels={{ found: s.chartFound, lost: s.chartLost, returned: s.chartReturned, foundPosted: s.chartFoundPosted, lostReported: s.chartLostReported }}
            />

            {/* ── Pending claims on my items ── */}
            {Object.values(myItemClaims).some((n) => n > 0) && (
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  {s.pendingClaimsTitle}
                </p>
                {myFoundItems
                  .filter((item) => (myItemClaims[item.id] ?? 0) > 0)
                  .map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-default)",
                        borderRadius: 12,
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 8,
                      }}
                    >
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: 6,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                      <p
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: 13,
                          fontWeight: 600,
                          color: "var(--text-primary)",
                          margin: 0,
                          flex: 1,
                          minWidth: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </p>
                      <span
                        style={{
                          background: "var(--warning)",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "3px 10px",
                          borderRadius: 100,
                          fontFamily: "var(--font-body)",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                        }}
                      >
                        {myItemClaims[item.id]}{" "}
                        {myItemClaims[item.id] !== 1 ? s.pendingClaimsPlural : s.pendingClaimSingular}
                      </span>
                      <button
                        style={{
                          background: "var(--accent)",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "6px 14px",
                          borderRadius: 8,
                          border: "none",
                          cursor: "pointer",
                          fontFamily: "var(--font-body)",
                          flexShrink: 0,
                        }}
                        onClick={() => router.push(`/items/${item.id}`)}
                      >
                        {s.reviewItemBtn}
                      </button>
                    </div>
                  ))}
              </div>
            )}

            {/* ── Found items ── */}
            {myFoundItems.length > 0 && (
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  {s.foundItemsPosted} ({myFoundItems.length})
                </p>
                <div className="items-container" style={{ margin: 0 }}>
                  {myFoundItems.map((item) => (
                    <div key={item.id} className="item-card">
                      <div className="item-image-wrapper">
                        <img className="item-image" src={item.image} alt={item.name} />
                      </div>
                      <div className="item-info">
                        <h3>{nameMap[item.id] || item.name}</h3>
                        <p>{item.description}</p>
                        {item.category && (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "100px",
                              background: "var(--accent)",
                              color: "#fff",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                              marginBottom: 2,
                            }}
                          >
                            {catMap[item.category] || item.category}
                          </span>
                        )}
                        {item.location && (
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              marginTop: 2,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {item.location}
                          </p>
                        )}
                        <p
                          style={{
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            marginTop: 4,
                            color:
                              item.status === "pending" || item.status === "claim_accepted"
                                ? "var(--accent)"
                                : item.status === "handed_off"
                                  ? "var(--text-muted)"
                                  : item.status === "disputed"
                                    ? "var(--danger)"
                                    : "var(--success)",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          {item.status === "pending"
                            ? s.claimPendingStatus
                            : item.status === "claim_accepted"
                              ? s.claimInProgressStatus
                              : item.status === "handed_off"
                                ? s.awaitingConfirmStatus
                                : item.status === "disputed"
                                  ? s.disputedStatus
                                  : s.activeStatus}
                        </p>
                      </div>
                      <div className="button-group">
                        {item.status === "pending" && (
                          <button
                            className="confirm-button"
                            onClick={() => handleConfirmClaimed(item.id)}
                          >
                            {s.confirmClaimed}
                          </button>
                        )}
                        <div className="button-group__row">
                          {item.status !== "handed_off" && item.status !== "disputed" && (
                            <button
                              className="delete-button"
                              onClick={() => handleDelete(item.id)}
                            >
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

            {/* ── Lost items ── */}
            {myLostItems.length > 0 && (
              <div>
                <p
                  style={{
                    margin: "0 0 10px",
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                  }}
                >
                  {s.lostItemsReported} ({myLostItems.length})
                </p>
                <div className="items-container" style={{ margin: 0 }}>
                  {myLostItems.map((item) => (
                    <div key={item.id} className="item-card">
                      <div className="item-image-wrapper">
                        {item.image ? (
                          <img
                            className="item-image"
                            src={item.image}
                            alt={item.name}
                          />
                        ) : (
                          <div
                            style={{
                              width: "100%",
                              height: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              background: "var(--bg-input)",
                              color: "var(--text-muted)",
                              fontSize: "2rem",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            ?
                          </div>
                        )}
                      </div>
                      <div className="item-info">
                        <h3>{nameMap[item.id] || item.name}</h3>
                        <p>{item.description}</p>
                        {item.category && (
                          <span
                            style={{
                              display: "inline-block",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: "100px",
                              background: "var(--accent)",
                              color: "#fff",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                              marginBottom: 2,
                            }}
                          >
                            {catMap[item.category] || item.category}
                          </span>
                        )}
                        {item.location && (
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              marginTop: 2,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {item.location}
                          </p>
                        )}
                      </div>
                      <div className="button-group">
                        <button
                          className="confirm-button"
                          onClick={() => handleMarkFound(item.id)}
                        >
                          {s.markAsFound}
                        </button>
                        <div className="button-group__row">
                          <button
                            className="delete-button"
                            onClick={() => handleDeleteLostItem(item.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── My Active Claims ── */}
            <div>
              <p
                style={{
                  margin: "0 0 10px",
                  fontFamily: "var(--font-body)",
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.8px",
                }}
              >
                {s.myActiveClaimsTitle}
              </p>
              {activeClaimsLoading ? (
                <p className="panel-empty">{s.loadingText}</p>
              ) : myActiveClaims.length === 0 ? (
                <p className="panel-empty">{s.noActiveClaims}</p>
              ) : (
                <div className="items-container" style={{ margin: 0 }}>
                  {myActiveClaims.map((claim: any) => (
                    <div key={claim.id} className="item-card">
                      <div className="item-info">
                        <h3 style={{ fontFamily: "var(--font-body)" }}>{claim.item_name}</h3>
                        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.8rem" }}>
                          {claim.description_proof?.slice(0, 100)}
                          {(claim.description_proof?.length || 0) > 100 ? "…" : ""}
                        </p>
                        <span
                          style={{
                            display: "inline-block",
                            marginTop: 6,
                            padding: "2px 10px",
                            borderRadius: 100,
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            fontFamily: "var(--font-body)",
                            background:
                              claim.status === "accepted"
                                ? "var(--success)"
                                : "var(--warning)",
                            color: "#fff",
                          }}
                        >
                          {claim.status === "accepted"
                            ? s.claimAcceptedStatus
                            : s.pendingReviewStatus}
                        </span>
                      </div>
                      <div className="button-group">
                        {claim.status === "accepted" ? (
                          <button
                            className="confirm-button"
                            onClick={() => router.push(`/items/${claim.item_id}`)}
                          >
                            {s.goToItemBtn}
                          </button>
                        ) : (
                          <button
                            className="delete-button"
                            style={{
                              background: "transparent",
                              border: "1.5px solid var(--danger)",
                              color: "var(--danger)",
                              borderRadius: 8,
                              padding: "6px 12px",
                              fontFamily: "var(--font-body)",
                              fontSize: "0.75rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                            onClick={() => handleCancelClaim(claim.id, claim.item_id)}
                          >
                            {s.cancelClaimBtn}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {!user && <p className="panel-empty">{s.signInToView}</p>}
            {user && myFoundItems.length === 0 && myLostItems.length === 0 && (
              <p className="panel-empty">{s.noItemsYet}</p>
            )}
          </div>
        );
      }

      default:
        return null;
    }
  };

  if (!isLoaded || !banChecked || !isReady) return <LoadingSpinner />;

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar__brand">
          <span className="dashboard-sidebar__brand-icon">
            <HiOutlineMagnifyingGlass />
          </span>
          <div>
            <p className="dashboard-sidebar__brand-title">{s.brandTitle}</p>
            <p className="dashboard-sidebar__brand-sub">{s.brandSub}</p>
          </div>
        </div>
        <div className="sidebar-tabs">
          {SIDEBAR_TABS.filter((tab) => !tab.adminOnly || isAdmin).map(
            (tab) => (
              <button
                key={tab.id}
                className={`sidebar-tab${activeTab === tab.id ? " sidebar-tab--active" : ""}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="sidebar-tab__icon">{tab.icon}</span>
                <span className="sidebar-tab__label">{tab.label}</span>
                {activeTab === tab.id && <span className="sidebar-tab__pip" />}
              </button>
            ),
          )}
        </div>
      </aside>

      <main className="dashboard-main">
        {isAdmin && (
          <div className="admin-banner">
            <span className="admin-banner__icon">*</span>
            <span>{s.adminBannerMsg}</span>
            <button
              className="admin-banner__exit"
              onClick={() => {
                setIsAdmin(false);
                localStorage.removeItem("findr_is_admin");
                localStorage.removeItem("findr_admin_id");
                localStorage.removeItem("findr_admin_name");
              }}
            >
              {s.adminBannerExit}
            </button>
          </div>
        )}

        {activeTab !== "items" ? (
          renderMainContent()
        ) : (
          <>
            {/* ── Search + Filter box ── */}
            <div
              style={{
                margin: "16px 0 0",
                background: "var(--bg-card)",
                border: "1.5px solid var(--border-default)",
                borderRadius: "16px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              {/* Search row */}
              <div className="panel-search" style={{ margin: 0 }}>
                <input
                  className="panel-search__input"
                  placeholder={s.searchPlaceholder}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <button
                    className="panel-search__clear"
                    onClick={() => setSearchQuery("")}
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Filter row */}
              <div
                className="dash-filter-row"
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr auto",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                {/* Category filter */}
                <div style={{ position: "relative" }}>
                  <select
                    className="dash-filter-select"
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 30px 8px 10px",
                      borderRadius: "8px",
                      border: "1.5px solid var(--border-input)",
                      background: filterCategory
                        ? "var(--accent)"
                        : "var(--bg-input)",
                      color: filterCategory ? "#fff" : "var(--text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "12px",
                      fontWeight: 600,
                      cursor: "pointer",
                      appearance: "none",
                      WebkitAppearance: "none",
                      outline: "none",
                      transition: "all 0.15s ease",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="">{s.filterCategory}</option>
                    {CATEGORIES.map((cat) => (
                      <option
                        key={cat}
                        value={cat}
                        style={{
                          background: "var(--bg-input)",
                          color: "var(--text-primary)",
                        }}
                      >
                        {cat}
                      </option>
                    ))}
                  </select>
                  <FaChevronDown
                    style={{
                      position: "absolute",
                      right: 9,
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: filterCategory
                        ? "rgba(255,255,255,0.7)"
                        : "var(--text-muted)",
                      fontSize: 10,
                      pointerEvents: "none",
                    }}
                  />
                </div>

                {/* Location filter */}
                <div style={{ position: "relative" }}>
                  <form autoComplete="off" style={{ margin: 0 }}>
                    <input
                      className="dash-filter-location"
                      value={filterLocation}
                      onChange={(e) => setFilterLocation(e.target.value)}
                      placeholder={s.filterLocation}
                      autoComplete="off"
                      style={{
                        width: "100%",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        border: "1.5px solid var(--border-input)",
                        background: filterLocation
                          ? "var(--accent)"
                          : "var(--bg-input)",
                        color: filterLocation ? "#fff" : "var(--text-muted)",
                        fontFamily: "var(--font-body)",
                        fontSize: "12px",
                        fontWeight: 600,
                        outline: "none",
                        transition: "all 0.15s ease",
                        boxSizing: "border-box",
                      }}
                    />
                  </form>
                </div>

                {/* Date range filter */}
                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                  <input
                    type="date"
                    value={filterDateFrom}
                    onChange={(e) => setFilterDateFrom(e.target.value)}
                    title="From date"
                    style={{
                      flex: 1,
                      padding: "8px 6px",
                      borderRadius: "8px",
                      border: "1.5px solid var(--border-input)",
                      background: filterDateFrom ? "var(--accent)" : "var(--bg-input)",
                      color: filterDateFrom ? "#fff" : "var(--text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: 600,
                      outline: "none",
                      transition: "all 0.15s ease",
                      boxSizing: "border-box",
                      colorScheme: "dark",
                      minWidth: 0,
                    }}
                  />
                  <span style={{ color: "var(--text-muted)", fontSize: 11, flexShrink: 0 }}>–</span>
                  <input
                    type="date"
                    value={filterDateTo}
                    onChange={(e) => setFilterDateTo(e.target.value)}
                    title="To date"
                    style={{
                      flex: 1,
                      padding: "8px 6px",
                      borderRadius: "8px",
                      border: "1.5px solid var(--border-input)",
                      background: filterDateTo ? "var(--accent)" : "var(--bg-input)",
                      color: filterDateTo ? "#fff" : "var(--text-muted)",
                      fontFamily: "var(--font-body)",
                      fontSize: "11px",
                      fontWeight: 600,
                      outline: "none",
                      transition: "all 0.15s ease",
                      boxSizing: "border-box",
                      colorScheme: "dark",
                      minWidth: 0,
                    }}
                  />
                </div>

                {/* Clear filters button */}
                <button
                  onClick={clearFilters}
                  disabled={!hasActiveFilters}
                  style={{
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1.5px solid var(--border-input)",
                    background: hasActiveFilters
                      ? "var(--danger)"
                      : "var(--bg-input)",
                    color: hasActiveFilters ? "#fff" : "var(--text-muted)",
                    fontFamily: "var(--font-body)",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: hasActiveFilters ? "pointer" : "not-allowed",
                    opacity: hasActiveFilters ? 1 : 0.45,
                    transition: "all 0.15s ease",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  {s.clearFilters}
                </button>
              </div>

              {/* Active filter chips */}
              {hasActiveFilters && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {filterCategory && (
                    <span
                      onClick={() => setFilterCategory("")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        background: "rgba(var(--accent-rgb, 47,128,237), 0.15)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {filterCategory} <span style={{ opacity: 0.7 }}>×</span>
                    </span>
                  )}
                  {filterLocation && (
                    <span
                      onClick={() => setFilterLocation("")}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        background: "rgba(var(--accent-rgb, 47,128,237), 0.15)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      📍 {filterLocation}{" "}
                      <span style={{ opacity: 0.7 }}>×</span>
                    </span>
                  )}
                  {(filterDateFrom || filterDateTo) && (
                    <span
                      onClick={() => {
                        setFilterDateFrom("");
                        setFilterDateTo("");
                      }}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "3px 10px",
                        borderRadius: "100px",
                        background: "rgba(var(--accent-rgb, 47,128,237), 0.15)",
                        border: "1px solid var(--accent)",
                        color: "var(--accent)",
                        fontFamily: "var(--font-body)",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      📅 {filterDateFrom || "…"} – {filterDateTo || "…"}{" "}
                      <span style={{ opacity: 0.7 }}>×</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "16px 0 0",
                borderBottom: "1px solid var(--border-default)",
              }}
            >
              {(["found", "lost"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setBoardTab(t)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px 8px 0 0",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: "0.9rem",
                    fontFamily: "var(--font-body)",
                    background: boardTab === t ? "var(--accent)" : "var(--bg-page)",
                    color: boardTab === t ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t === "found"
                    ? `${s.foundItemsTab} (${filteredItems.filter((i) => i.status !== "claimed").length})`
                    : `${s.lostItemsTab} (${filteredLostItems.length})`}
                </button>
              ))}
            </div>

            {boardTab === "found" && (
              <div className="items-container">
                {filteredItems
                  .filter((i) => i.status !== "claimed")
                  .map((item) => (
                    <div
                      key={item.id}
                      id={`item-${item.id}`}
                      className="item-card item-card--clickable"
                      onClick={() => router.push(`/items/${item.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          router.push(`/items/${item.id}`);
                      }}
                    >
                      <div className="item-image-wrapper">
                        <img
                          className="item-image"
                          src={item.image}
                          alt={item.name}
                        />
                      </div>
                      <div className="item-info item-info--card">
                        <h3>{nameMap[item.id] || item.name}</h3>
                        <div className="posted-by">
                          {item.authorAvatar && (
                            <img
                              src={item.authorAvatar}
                              alt="User"
                              className="posted-by__avatar"
                            />
                          )}
                          <span>
                            {s.foundBy} {item.authorName || "Anonymous"}
                          </span>
                        </div>
                        {(item as any).location && (
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              marginTop: 4,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            📍 {(item as any).location}
                          </p>
                        )}
                        {item.category && (
                          <p
                            style={{
                              fontSize: "0.72rem",
                              color: "var(--text-muted)",
                              marginTop: 4,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            🏷️ {catMap[item.category] || item.category}
                          </p>
                        )}
                        {item.status === "pending" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                            }}
                          >
                            {s.claimPending}
                          </span>
                        )}
                        {item.status === "claim_accepted" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--warning)",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                              display: "block",
                            }}
                          >
                            {s.claimInProgressStatus}
                          </span>
                        )}
                        {item.status === "handed_off" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--text-muted)",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                              display: "block",
                            }}
                          >
                            {s.awaitingConfirmStatus}
                          </span>
                        )}
                        {item.status === "disputed" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--danger)",
                              fontFamily: "var(--font-body)",
                              marginTop: 4,
                              display: "block",
                            }}
                          >
                            {s.disputedStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                {filteredItems.filter((i) => i.status !== "claimed").length ===
                  0 && (
                  <div className="empty-state">
                    <p>
                      {searchQuery
                        ? `${s.noFoundItemsSearch} "${searchQuery}"`
                        : s.noFoundItems}
                    </p>
                    {searchQuery && <p>{s.tryKeywords}</p>}
                  </div>
                )}
              </div>
            )}

            {boardTab === "lost" && (
              <div className="items-container">
                {filteredLostItems.map((item) => (
                  <div
                    key={item.id}
                    id={`lost-item-${item.id}`}
                    className="item-card item-card--clickable"
                    onClick={() => router.push(`/items/${item.id}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ")
                        router.push(`/items/${item.id}`);
                    }}
                  >
                    <div className="item-image-wrapper">
                      {item.image ? (
                        <img
                          className="item-image"
                          src={item.image}
                          alt={item.name}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            background: "var(--bg-input)",
                            color: "var(--text-muted)",
                            fontSize: "2rem",
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          ?
                        </div>
                      )}
                    </div>
                    <div className="item-info item-info--card">
                      <h3>{nameMap[item.id] || item.name}</h3>
                      <div className="posted-by">
                        {item.authorAvatar && (
                          <img
                            src={item.authorAvatar}
                            alt="User"
                            className="posted-by__avatar"
                          />
                        )}
                        <span>
                          {s.lostBy} {item.authorName || "Anonymous"}
                        </span>
                      </div>
                      {item.location && (
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            marginTop: 4,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          📍 {item.location}
                        </p>
                      )}
                      {item.category && (
                        <p
                          style={{
                            fontSize: "0.72rem",
                            color: "var(--text-muted)",
                            marginTop: 4,
                            fontFamily: "var(--font-body)",
                          }}
                        >
                          🏷️ {catMap[item.category] || item.category}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
                {filteredLostItems.length === 0 && (
                  <div className="empty-state">
                    <p>
                      {searchQuery
                        ? `${s.noLostItemsSearch} "${searchQuery}"`
                        : s.noLostItems}
                    </p>
                    <p>{s.clickReportLost}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>

      {/* ── MATCH CHECK MODAL ── */}
      {matchModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
            zIndex: 1500,
            backdropFilter: "blur(4px)",
          }}
          onClick={() => setMatchModal(null)}
        >
          <div
            style={{
              background: "var(--bg-card)",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: "520px",
              padding: "24px 20px 32px",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.22)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              border: "1px solid var(--border-default)",
              borderBottom: "none",
              animation: "sheet-up 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 16,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: "0 0 4px",
                }}
              >
                {matchModal.mode === "found"
                  ? "Someone might be looking for this!"
                  : "This might already be found!"}
              </p>
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  color: "var(--text-muted)",
                  margin: 0,
                }}
              >
                {matchModal.mode === "found"
                  ? "Before you post, check if someone already reported losing a similar item."
                  : "Before you post, check if someone already found a similar item."}
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {matchModal.items.map((item) => {
                const daysAgo =
                  item.postedAt
                    ? Math.floor(
                        (Date.now() - new Date(item.postedAt).getTime()) /
                          86400000,
                      )
                    : null;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: "flex",
                      gap: "12px",
                      padding: "12px",
                      border: "1.5px solid var(--border-input)",
                      borderRadius: "12px",
                      background: "var(--bg-input)",
                      cursor: matchModal.mode === "lost" ? "pointer" : "default",
                      transition: "border-color 0.15s ease",
                    }}
                    onClick={() => {
                      if (matchModal.mode === "lost") {
                        setMatchModal(null);
                        router.push(`/items/${item.id}`);
                      }
                    }}
                  >
                    {item.image ? (
                      <img
                        src={item.image}
                        alt={item.name}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 8,
                          background: "var(--bg-hover)",
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "var(--text-muted)",
                          fontSize: 22,
                        }}
                      >
                        ?
                      </div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p
                        style={{
                          margin: "0 0 2px",
                          fontFamily: "var(--font-body)",
                          fontSize: 14,
                          fontWeight: 700,
                          color: "var(--text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {item.name}
                      </p>
                      {item.description && (
                        <p
                          style={{
                            margin: "0 0 4px",
                            fontFamily: "var(--font-body)",
                            fontSize: 12,
                            color: "var(--text-secondary)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.description}
                        </p>
                      )}
                      <p
                        style={{
                          margin: 0,
                          fontFamily: "var(--font-body)",
                          fontSize: 11,
                          color: "var(--text-muted)",
                        }}
                      >
                        {item.authorName && `by ${item.authorName}`}
                        {daysAgo !== null &&
                          ` · ${
                            daysAgo === 0
                              ? "today"
                              : daysAgo === 1
                                ? "yesterday"
                                : `${daysAgo} days ago`
                          }`}
                        {item.location && ` · ${item.location}`}
                      </p>
                    </div>
                    {matchModal.mode === "lost" && (
                      <span
                        style={{
                          alignSelf: "center",
                          color: "var(--accent)",
                          fontSize: 20,
                          flexShrink: 0,
                        }}
                      >
                        ›
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "1.5px solid var(--border-input)",
                  borderRadius: "10px",
                  background: "var(--bg-input)",
                  color: "var(--text-primary)",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => {
                  const fn = matchModal.onContinue;
                  setMatchModal(null);
                  fn();
                }}
              >
                No, post anyway
              </button>
              <button
                type="button"
                style={{
                  flex: 1,
                  padding: "12px 16px",
                  border: "none",
                  borderRadius: "10px",
                  background: "var(--accent)",
                  color: "#fff",
                  fontFamily: "var(--font-body)",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={() => setMatchModal(null)}
              >
                Let me check
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── CROP MODAL ── */}
      {cropSrc && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.88)",
            zIndex: 2000,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
            gap: "14px",
          }}
        >
          <p
            style={{
              color: "#fff",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: "15px",
              margin: 0,
              letterSpacing: "-0.1px",
            }}
          >
            Crop Photo
            {cropQueue.length > 1
              ? ` (${cropIndex + 1} of ${cropQueue.length})`
              : ""}
          </p>

          <div
            style={{
              position: "relative",
              width: "min(90vw, 600px)",
              aspectRatio: "4 / 3",
              borderRadius: "12px",
              overflow: "hidden",
              border: "2px solid rgba(255,255,255,0.12)",
            }}
          >
            <Cropper
              image={cropSrc}
              crop={crop}
              zoom={zoom}
              rotation={rotation}
              aspect={6 / 5}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "10px",
              width: "min(90vw, 600px)",
              background: "rgba(255,255,255,0.06)",
              borderRadius: "10px",
              padding: "14px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  minWidth: 44,
                }}
              >
                Zoom
              </span>
              <input
                type="range"
                min={1}
                max={3}
                step={0.05}
                value={zoom}
                onChange={(e) => setZoom(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--accent)" }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {zoom.toFixed(1)}×
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.6px",
                  minWidth: 44,
                }}
              >
                Rotate
              </span>
              <input
                type="range"
                min={-180}
                max={180}
                step={1}
                value={rotation}
                onChange={(e) => setRotation(Number(e.target.value))}
                style={{ flex: 1, accentColor: "var(--accent)" }}
              />
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "var(--font-body)",
                  fontSize: "11px",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {rotation}°
              </span>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "10px",
              width: "min(90vw, 600px)",
            }}
          >
            <button
              onClick={handleCropSkip}
              style={{
                flex: 1,
                padding: "13px 0",
                borderRadius: "9px",
                border: "1.5px solid rgba(255,255,255,0.2)",
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 600,
                cursor: "pointer",
                transition: "border-color 0.15s ease, color 0.15s ease",
              }}
            >
              Skip crop
            </button>
            <button
              onClick={handleCropConfirm}
              style={{
                flex: 2,
                padding: "13px 0",
                borderRadius: "9px",
                border: "none",
                background: "var(--accent)",
                color: "#fff",
                fontFamily: "var(--font-body)",
                fontSize: "13px",
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease, transform 0.12s ease",
              }}
            >
              Apply Crop
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
