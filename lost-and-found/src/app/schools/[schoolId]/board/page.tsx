"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { FaTrash, FaPlus } from "react-icons/fa6";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { useSettings } from "@/context/SettingsContext";
import { MdFlagCircle } from "react-icons/md";
import { HiOutlineMagnifyingGlass } from "react-icons/hi2";
import { CiLogin } from "react-icons/ci";

// ─── Types ────────────────────────────────────────────────────────────────────
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
}

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
}

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
}

interface SchoolReport {
  id: number;
  school_id: string;
  item_id: number;
  item_name: string;
  item_image: string | null;
  reporter_id: string;
  reporter_name: string;
  reporter_email: string | null;
  reason: string;
  created_at: string;
}

// ─── Cache helpers ─────────────────────────────────────────────────────────────
const SCHOOL_BOARD_CACHE_TTL_MS = 5 * 60 * 1000;

function getSchoolBoardCacheKey(schoolId: string) {
  return `findr_school_board_${schoolId}`;
}

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
    if (
      !parsed?.timestamp ||
      !Array.isArray(parsed.found) ||
      !Array.isArray(parsed.lost)
    )
      return null;
    if (Date.now() - parsed.timestamp > SCHOOL_BOARD_CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeSchoolBoardCache(
  schoolId: string,
  found: SchoolItem[],
  lost: SchoolLostItem[],
) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      getSchoolBoardCacheKey(schoolId),
      JSON.stringify({ timestamp: Date.now(), found, lost }),
    );
  } catch {}
}

// ─── Gradient helpers ──────────────────────────────────────────────────────────
function hexToRgba(hex: string, a: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function gradStyles(hex: string): string[] {
  return [
    `linear-gradient(to top, ${hexToRgba(hex, 0.97)} 0%, ${hexToRgba(hex, 0.72)} 40%, ${hexToRgba(hex, 0.2)} 75%, transparent 100%)`,
    `linear-gradient(to right, ${hexToRgba(hex, 0.95)} 0%, ${hexToRgba(hex, 0.65)} 50%, ${hexToRgba(hex, 0.1)} 100%)`,
    `linear-gradient(135deg, ${hexToRgba(hex, 0.92)} 0%, ${hexToRgba(hex, 0.5)} 55%, transparent 100%)`,
    `linear-gradient(to bottom, ${hexToRgba(hex, 0.85)} 0%, ${hexToRgba(hex, 0.55)} 100%)`,
  ];
}

// ─── Translation helper ────────────────────────────────────────────────────────
async function fetchTranslation(
  key: string,
  target: string,
  cacheKey: string,
  setter: (val: string) => void,
) {
  const cached = localStorage.getItem(`${cacheKey}_${target}`);
  if (cached) {
    setter(cached);
    return;
  }
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: key, target }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated =
        (data.translatedText as string | undefined)?.trim() || key;
      setter(translated);
      localStorage.setItem(`${cacheKey}_${target}`, translated);
    } else {
      setter(key);
    }
  } catch {
    setter(key);
  }
}

// ─── BoardStrings ──────────────────────────────────────────────────────────────
interface BoardStrings {
  backBtn: string;
  adminBadge: string;
  exitAdmin: string;
  itemsTab: string;
  // merged tab
  addItemTab: string;
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
}

const DEFAULT_BOARD: BoardStrings = {
  backBtn: "← Back",
  adminBadge: "School Admin",
  exitAdmin: "Exit",
  itemsTab: "Items",
  addItemTab: "Add Item",
  toggleFound: "Found an Item",
  toggleLost: "Lost an Item",
  adminTab: "Admin",
  reportsTab: "Reports",
  searchPlaceholder: "Search items...",
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
};

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function SchoolBoardPage() {
  const { schoolId } = useParams<{ schoolId: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { language } = useSettings();

  const [school, setSchool] = useState<School | null>(null);
  const [loadingSchool, setLoadingSchool] = useState(true);
  const [s, setS] = useState<BoardStrings>(DEFAULT_BOARD);
  const [stringsReady, setStringsReady] = useState(false);

  // ── Fetch school ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!schoolId) return;
    const fetchSchool = async () => {
      const { data } = await supabase
        .from("schools")
        .select("*")
        .eq("id", schoolId)
        .eq("status", "approved")
        .maybeSingle();
      if (data) setSchool(data as School);
      setLoadingSchool(false);
    };
    fetchSchool();
  }, [schoolId]);

  // ── Translations ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (language === "en") {
      setS(DEFAULT_BOARD);
      setStringsReady(true);
      return;
    }

    const translateAll = async () => {
      const boardSetters: [keyof BoardStrings, string, string][] = [
        ["backBtn", "← Back", "sc_board_backBtn"],
        ["adminBadge", "School Admin", "sc_board_adminBadge"],
        ["exitAdmin", "Exit", "sc_board_exitAdmin"],
        ["itemsTab", "Items", "sc_board_itemsTab"],
        ["addItemTab", "Add Item", "sc_board_addItemTab"],
        ["toggleFound", "Found an Item", "sc_board_toggleFound"],
        ["toggleLost", "Lost an Item", "sc_board_toggleLost"],
        ["adminTab", "Admin", "sc_board_adminTab"],
        ["reportsTab", "Reports", "sc_board_reportsTab"],
        ["searchPlaceholder", "Search items...", "sc_board_searchPlaceholder"],
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
        [
          "itemNamePlaceholder",
          "e.g. Blue water bottle",
          "sc_board_itemNamePlaceholder",
        ],
        ["descLabel", "Description", "sc_board_descLabel"],
        [
          "descFoundPlaceholder",
          DEFAULT_BOARD.descFoundPlaceholder,
          "sc_board_descFoundPlaceholder",
        ],
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
        [
          "descLostPlaceholder",
          DEFAULT_BOARD.descLostPlaceholder,
          "sc_board_descLostPlaceholder",
        ],
        [
          "photosOptionalLabel",
          "Photos (optional, up to 3)",
          "sc_board_photosOptionalLabel",
        ],
        ["postLostBtn", "Post Lost Item", "sc_board_postLostBtn"],
        ["postingLostBtn", "Posting...", "sc_board_postingLostBtn"],
        ["lostPostedMsg", "Lost item reported!", "sc_board_lostPostedMsg"],
        ["adminLoginTitle", "School Admin Access", "sc_board_adminLoginTitle"],
        [
          "adminLoginHint",
          DEFAULT_BOARD.adminLoginHint,
          "sc_board_adminLoginHint",
        ],
        ["adminPasswordLabel", "Admin Password", "sc_board_adminPasswordLabel"],
        [
          "adminPasswordPlaceholder",
          "e.g. FINDR-JANE-X4K2",
          "sc_board_adminPasswordPlaceholder",
        ],
        ["unlockBtn", "Unlock Admin View", "sc_board_unlockBtn"],
        ["checkingBtn", "Checking...", "sc_board_checkingBtn"],
        [
          "adminUnlockedMsg",
          "Admin view unlocked!",
          "sc_board_adminUnlockedMsg",
        ],
        [
          "adminUnlockedSub",
          DEFAULT_BOARD.adminUnlockedSub,
          "sc_board_adminUnlockedSub",
        ],
        [
          "adminIncorrect",
          DEFAULT_BOARD.adminIncorrect,
          "sc_board_adminIncorrect",
        ],
      ];

      await Promise.all(
        boardSetters.map(([field, key, cacheKey]) =>
          fetchTranslation(key, language, cacheKey, (val) =>
            setS((prev) => ({ ...prev, [field]: val })),
          ),
        ),
      );
      setStringsReady(true);
    };

    translateAll();
  }, [language]);

  if (!isLoaded || loadingSchool || !stringsReady) return <LoadingSpinner />;

  if (!school)
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: 16,
          fontFamily: "Poppins, sans-serif",
        }}
      >
        <p style={{ color: "var(--text-secondary)" }}>School not found.</p>
        <button
          onClick={() => router.push("/schools")}
          style={{
            padding: "8px 18px",
            borderRadius: 8,
            border: "1.5px solid var(--border-input)",
            background: "var(--bg-card)",
            cursor: "pointer",
            fontFamily: "Poppins, sans-serif",
            fontWeight: 600,
            color: "var(--text-secondary)",
          }}
        >
          ← Back to Schools
        </button>
      </div>
    );

  return (
    <SchoolBoard
      school={school}
      user={user}
      onBack={() => router.push("/schools")}
      s={s}
    />
  );
}

// ─── SchoolBoard ───────────────────────────────────────────────────────────────
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

// ─── SchoolReportsPanel ────────────────────────────────────────────────────────
function SchoolReportsPanel({
  school,
  onDeleteItem,
  color,
}: {
  school: School;
  onDeleteItem: (itemId: number) => void;
  color: string;
}) {
  const [reports, setReports] = useState<SchoolReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      const { data } = await supabase
        .from("school_reports")
        .select("*")
        .eq("school_id", school.id)
        .order("created_at", { ascending: false });
      if (data) setReports(data as SchoolReport[]);
      setLoading(false);
    };
    fetchReports();
  }, [school.id]);

  const handleDismiss = async (reportId: number) => {
    await supabase.from("school_reports").delete().eq("id", reportId);
    setReports((prev) => prev.filter((r) => r.id !== reportId));
  };

  const handleDeleteItem = async (report: SchoolReport) => {
    if (!confirm(`Delete "${report.item_name}" permanently?`)) return;
    await supabase.from("school_items").delete().eq("id", report.item_id);
    await supabase
      .from("school_reports")
      .delete()
      .eq("item_id", report.item_id);
    onDeleteItem(report.item_id);
    setReports((prev) => prev.filter((r) => r.item_id !== report.item_id));
  };

  if (loading)
    return (
      <div className="sc-empty" style={{ padding: "32px 0" }}>
        Loading...
      </div>
    );

  if (reports.length === 0)
    return (
      <div className="sc-empty" style={{ padding: "32px 0" }}>
        No reports — all clear!
      </div>
    );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: "4px 0",
      }}
    >
      {reports.map((report) => (
        <div
          key={report.id}
          style={{
            background: "var(--bg-card, #16161e)",
            border: "1.5px solid var(--border-default, #2a2a3a)",
            borderRadius: 12,
            padding: "14px 16px",
            display: "flex",
            gap: 14,
            alignItems: "flex-start",
          }}
        >
          {report.item_image && (
            <img
              src={report.item_image}
              alt={report.item_name}
              style={{
                width: 60,
                height: 60,
                borderRadius: 8,
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontFamily: "Poppins, sans-serif",
                fontWeight: 700,
                fontSize: "0.9rem",
                color: "var(--text-primary, #e8e8f0)",
                margin: "0 0 3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {report.item_name}
            </p>
            <p
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "0.82rem",
                color: "var(--danger, #e05252)",
                margin: "0 0 4px",
                fontWeight: 600,
              }}
            >
              {report.reason}
            </p>
            <p
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: "0.74rem",
                color: "var(--text-muted, #888)",
                margin: 0,
              }}
            >
              Reported by {report.reporter_name}
              {report.reporter_email ? ` · ${report.reporter_email}` : ""} ·{" "}
              {new Date(report.created_at).toLocaleDateString()}
            </p>
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 6,
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => handleDismiss(report.id)}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                border: "1.5px solid var(--border-default, #2a2a3a)",
                background: "transparent",
                color: "var(--text-muted, #888)",
                fontFamily: "Poppins, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
            <button
              onClick={() => handleDeleteItem(report)}
              style={{
                padding: "5px 12px",
                borderRadius: 7,
                border: "none",
                background: "var(--danger, #e05252)",
                color: "#fff",
                fontFamily: "Poppins, sans-serif",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Delete Item
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function SchoolBoard({
  school,
  user,
  onBack,
  s,
}: {
  school: School;
  user: any;
  onBack: () => void;
  s: BoardStrings;
}) {
  type BoardTab = "items" | "add-item" | "admin-login" | "reports";

  const router = useRouter();

  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);
  // ── pill toggle state (mirrors dashboard reportMode) ────────────────────────
  const [addMode, setAddMode] = useState<"found" | "lost">("found");

  useEffect(() => {
    setIsSchoolAdmin(
      localStorage.getItem(`findr_school_admin_${school.id}`) === "true",
    );
  }, [school.id]);

  // Build tab list dynamically
  const BOARD_TABS: { id: BoardTab; label: string; icon?: React.ReactNode }[] = [
    { id: "items", label: s.itemsTab, icon: <HiOutlineMagnifyingGlass style={{ fontSize: 20 }} /> },
    { id: "add-item", label: s.addItemTab, icon: <FaPlus style={{ fontSize: 11 }} /> },
    { id: "admin-login", label: s.adminTab, icon: <CiLogin style={{ fontSize: 20 }} /> },
    ...(isSchoolAdmin ? [{ id: "reports" as BoardTab, label: s.reportsTab, icon: <MdFlagCircle style={{ fontSize: 20 }} /> }] : []),
  ];

  const [activeTab, setActiveTab] = useState<BoardTab>("items");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [searchQuery, setSearchQuery] = useState("");
  const [items, setItems] = useState<SchoolItem[]>([]);
  const [lostItems, setLostItems] = useState<SchoolLostItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);

  const color = school.color;
  const color2 = school.secondary_color ?? "#f5c842";
  const gradOverlay = gradStyles(color)[school.gradient_mode ?? 0];
  const hasBg = !!school.bg_image_url;

  useEffect(() => {
    const cachedBoard = readSchoolBoardCache(school.id);
    if (cachedBoard) {
      setItems(cachedBoard.found);
      setLostItems(cachedBoard.lost);
      setLoadingItems(false);
    } else {
      setLoadingItems(true);
    }

    const fetchItems = async () => {
      const [{ data: found }, { data: lost }] = await Promise.all([
        supabase
          .from("school_items")
          .select("*")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("school_lost_items")
          .select("*")
          .eq("school_id", school.id)
          .order("created_at", { ascending: false }),
      ]);
      const nextFound = (found ?? []) as SchoolItem[];
      const nextLost = (lost ?? []) as SchoolLostItem[];
      setItems(nextFound);
      setLostItems(nextLost);
      writeSchoolBoardCache(school.id, nextFound, nextLost);
      setLoadingItems(false);
    };
    fetchItems();
  }, [school.id]);

  // ── Add Found Item ──────────────────────────────────────────────────────────
  const [foundName, setFoundName] = useState("");
  const [foundDesc, setFoundDesc] = useState("");
  const [foundCategory, setFoundCategory] = useState("");
  const [foundLocation, setFoundLocation] = useState("");
  const [foundDate, setFoundDate] = useState("");
  const [foundFiles, setFoundFiles] = useState<File[]>([]);
  const [foundUploading, setFoundUploading] = useState(false);
  const [foundSuccess, setFoundSuccess] = useState(false);

  const handleAddFound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !foundName || !foundDesc) return;
    setFoundUploading(true);
    const imageUrls: string[] = [];
    for (const file of foundFiles.slice(0, 3)) {
      const fn = `school_${school.id}_${Date.now()}_${file.name}`;
      await supabase.storage.from("item-images").upload(fn, file);
      const { data } = supabase.storage.from("item-images").getPublicUrl(fn);
      imageUrls.push(data.publicUrl);
    }
    const { data: inserted } = await supabase
      .from("school_items")
      .insert({
        school_id: school.id,
        name: foundName,
        description: foundDesc,
        category: foundCategory || null,
        location: foundLocation || null,
        date_found: foundDate
          ? new Date(foundDate).toISOString()
          : new Date().toISOString(),
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        author_name: user.fullName || user.username || "Anonymous",
        author_avatar: user.imageUrl,
        author_id: user.id,
        author_email: user.primaryEmailAddress?.emailAddress,
        status: "waiting",
      })
      .select()
      .single();
    if (inserted) setItems((prev) => [inserted, ...prev]);
    setFoundName("");
    setFoundDesc("");
    setFoundCategory("");
    setFoundLocation("");
    setFoundDate("");
    setFoundFiles([]);
    setFoundSuccess(true);
    setTimeout(() => {
      setFoundSuccess(false);
      setActiveTab("items");
    }, 1500);
    setFoundUploading(false);
  };

  // ── Add Lost Item ───────────────────────────────────────────────────────────
  const [lostName, setLostName] = useState("");
  const [lostDesc, setLostDesc] = useState("");
  const [lostCategory, setLostCategory] = useState("");
  const [lostLocation, setLostLocation] = useState("");
  const [lostFiles, setLostFiles] = useState<File[]>([]);
  const [lostUploading, setLostUploading] = useState(false);
  const [lostSuccess, setLostSuccess] = useState(false);

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
    const { data: inserted } = await supabase
      .from("school_lost_items")
      .insert({
        school_id: school.id,
        name: lostName,
        description: lostDesc,
        category: lostCategory || null,
        location: lostLocation || null,
        image_url: imageUrls[0] || null,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        author_name: user.fullName || user.username || "Anonymous",
        author_avatar: user.imageUrl,
        author_id: user.id,
        author_email: user.primaryEmailAddress?.emailAddress,
        status: "looking",
      })
      .select()
      .single();
    if (inserted) setLostItems((prev) => [inserted, ...prev]);
    setLostName("");
    setLostDesc("");
    setLostCategory("");
    setLostLocation("");
    setLostFiles([]);
    setLostSuccess(true);
    setTimeout(() => {
      setLostSuccess(false);
      setActiveTab("items");
      setBoardTab("lost");
    }, 1500);
    setLostUploading(false);
  };

  // ── Admin login ─────────────────────────────────────────────────────────────
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState("");
  const [adminChecking, setAdminChecking] = useState(false);
  const [adminUnlocked, setAdminUnlocked] = useState(false);

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminChecking(true);
    setAdminError("");

    const { data: schoolRow } = await supabase
      .from("schools")
      .select("password")
      .eq("id", school.id)
      .maybeSingle();

    const repMatch =
      schoolRow?.password && schoolRow.password === adminPassword;

    const { data: staffRow } = repMatch
      ? { data: null }
      : await supabase
          .from("school_admins")
          .select("id")
          .eq("school_id", school.id)
          .eq("user_email", user?.primaryEmailAddress?.emailAddress ?? "")
          .eq("password", adminPassword)
          .maybeSingle();

    if (!repMatch && !staffRow) {
      setAdminError(s.adminIncorrect);
    } else {
      localStorage.setItem(`findr_school_admin_${school.id}`, "true");
      setIsSchoolAdmin(true);
      setAdminUnlocked(true);
    }
    setAdminChecking(false);
  };

  // ── Admin actions ───────────────────────────────────────────────────────────
  const handleDeleteFound = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this item permanently?")) return;
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleDeleteLost = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm("Delete this lost item?")) return;
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkClaimed = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await supabase.from("school_items").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };
  const handleMarkFound = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    await supabase.from("school_lost_items").delete().eq("id", id);
    setLostItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleReportDeleteItem = (itemId: number) => {
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  };

  const filteredFound = searchQuery.trim()
    ? items.filter((i) =>
        `${i.name} ${i.description}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : items;
  const filteredLost = searchQuery.trim()
    ? lostItems.filter((i) =>
        `${i.name} ${i.description}`
          .toLowerCase()
          .includes(searchQuery.toLowerCase()),
      )
    : lostItems;

  // ── Shared select style ─────────────────────────────────────────────────────
  const selectStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: "8px",
    border: "1.5px solid var(--sc-input-border, #2a2a3a)",
    background: "var(--sc-input-bg, #12121a)",
    color: "var(--sc-text, #e8e8f0)",
    fontFamily: "Poppins, sans-serif",
    fontSize: "13px",
    fontWeight: 500,
    outline: "none",
    appearance: "none" as any,
    WebkitAppearance: "none" as any,
    cursor: "pointer",
    boxSizing: "border-box" as any,
  };

  // ── Pill toggle (mirrors dashboard ReportItemToggle) ────────────────────────
  const AddItemToggle = () => (
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
        const isActive = addMode === mode;
        return (
          <button
            key={mode}
            type="button"
            onClick={() => setAddMode(mode)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: "100px",
              border: "none",
              cursor: "pointer",
              fontFamily: "Poppins, sans-serif",
              fontSize: "13px",
              fontWeight: 700,
              letterSpacing: "0.1px",
              transition: "all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)",
              background: isActive ? color : "transparent",
              color: isActive ? "#fff" : "var(--text-muted)",
              boxShadow: isActive
                ? `0 2px 10px ${hexToRgba(color, 0.35)}`
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

  return (
    <div
      className="sc-board"
      style={
        { "--sc-color": color, "--sc-color-2": color2 } as React.CSSProperties
      }
    >
      {/* ── Header ── */}
      <div
        className="sc-board__header"
        style={{
          borderBottomColor: color,
          ...(hasBg ? { minHeight: 120, height: 120 } : {}),
        }}
      >
        <button
          className="sc-board__back"
          onClick={onBack}
          style={
            hasBg
              ? {
                  background: "rgba(0,0,0,0.3)",
                  color: "#fff",
                  borderColor: "rgba(255,255,255,0.3)",
                }
              : {}
          }
        >
          {s.backBtn}
        </button>
        <div className="sc-board__identity">
          {school.logo_url ? (
            <img
              src={school.logo_url}
              alt={school.name}
              className="sc-board__logo"
            />
          ) : (
            <div className="sc-board__initial" style={{ background: color }}>
              {school.name[0]}
            </div>
          )}
          <div>
            <p
              className="sc-board__name"
              style={
                hasBg
                  ? { color: "#fff", textShadow: "0 1px 6px rgba(0,0,0,0.5)" }
                  : {}
              }
            >
              {school.name}
            </p>
            <p
              className="sc-board__code"
              style={hasBg ? { color: "rgba(255,255,255,0.75)" } : {}}
            >
              {school.code}
            </p>
          </div>
        </div>
        {isSchoolAdmin && (
          <div
            className="sc-admin-badge"
            style={{
              background: hexToRgba(color2, 0.2),
              borderColor: color2,
              color: hasBg ? "#fff" : undefined,
            }}
          >
            {s.adminBadge}
            <button
              className="sc-admin-badge__exit"
              onClick={() => {
                localStorage.removeItem(`findr_school_admin_${school.id}`);
                setIsSchoolAdmin(false);
                if (activeTab === "reports") setActiveTab("items");
              }}
            >
              {s.exitAdmin}
            </button>
          </div>
        )}
      </div>

      {/* ── Layout ── */}
      <div className="sc-board__layout">
        <aside className="sc-board__sidebar">
          {BOARD_TABS.map((tab) => (
            <button
              key={tab.id}
              className={`sc-board__tab${activeTab === tab.id ? " sc-board__tab--active" : ""}`}
              style={
                activeTab === tab.id ? { background: `${color}22`, color } : {}
              }
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.icon && (
                <span className="sc-board__tab-icon" aria-hidden="true">
                  {tab.icon}
                </span>
              )}
              <span className="sc-board__tab-label">{tab.label}</span>
              {activeTab === tab.id && (
                <span
                  className="sc-board__tab-pip"
                  style={{ background: color2 }}
                />
              )}
            </button>
          ))}
        </aside>

        <main
          className="sc-board__main"
          style={
            hasBg
              ? {
                  backgroundImage: `${gradOverlay}, url(${school.bg_image_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : {}
          }
        >
          {/* ── ITEMS ── */}
          {activeTab === "items" && (
            <>
              <div className="sc-search-row">
                <div className="sc-search-wrap">
                  <input
                    className="sc-search"
                    placeholder={s.searchPlaceholder}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      className="sc-search__clear"
                      onClick={() => setSearchQuery("")}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              <div className="sc-tabs-row">
                {(["found", "lost"] as const).map((t) => (
                  <button
                    key={t}
                    className={`sc-tab-btn${boardTab === t ? " sc-tab-btn--active" : ""}`}
                    style={
                      boardTab === t
                        ? {
                            background: color,
                            color: "#fff",
                            borderColor: color,
                          }
                        : {}
                    }
                    onClick={() => setBoardTab(t)}
                  >
                    {t === "found"
                      ? `${s.foundTabLabel} (${filteredFound.filter((i) => i.status !== "claimed").length})`
                      : `${s.lostTabLabel} (${filteredLost.length})`}
                  </button>
                ))}
              </div>

              {loadingItems ? (
                <div className="sc-empty">{s.loadingText}</div>
              ) : boardTab === "found" ? (
                <div className="sc-items-grid">
                  {filteredFound
                    .filter((i) => i.status !== "claimed")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="sc-item-card sc-item-card--clickable"
                        onClick={() => router.push(`/school-items/${item.id}`)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ")
                            router.push(`/school-items/${item.id}`);
                        }}
                      >
                        <div className="sc-item-card__img-wrap">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={item.name}
                              className="sc-item-card__img"
                            />
                          ) : (
                            <div className="sc-item-card__no-img">
                              {s.noImage}
                            </div>
                          )}
                        </div>
                        <div className="sc-item-card__info">
                          <p className="sc-item-card__name">{item.name}</p>
                          <p className="sc-item-card__desc">
                            {item.description}
                          </p>
                          <p className="sc-item-card__by">
                            {s.foundBy} {item.author_name}
                          </p>
                          {item.status === "pending" && (
                            <span className="sc-item-card__status sc-item-card__status--pending">
                              {s.claimPending}
                            </span>
                          )}
                        </div>
                        {(isSchoolAdmin || user?.id === item.author_id) && (
                          <div className="sc-item-card__actions">
                            {user?.id === item.author_id &&
                              item.status === "pending" && (
                                <button
                                  className="sc-btn sc-btn--success sc-btn--sm"
                                  onClick={(e) => handleMarkClaimed(e, item.id)}
                                >
                                  {s.confirmClaimed}
                                </button>
                              )}
                            <button
                              className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                              onClick={(e) => handleDeleteFound(e, item.id)}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  {filteredFound.filter((i) => i.status !== "claimed")
                    .length === 0 && (
                    <div className="sc-empty">{s.noFoundItems}</div>
                  )}
                </div>
              ) : (
                <div className="sc-items-grid">
                  {filteredLost.map((item) => (
                    <div
                      key={item.id}
                      className="sc-item-card sc-item-card--clickable"
                      onClick={() => router.push(`/school-items/${item.id}`)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ")
                          router.push(`/school-items/${item.id}`);
                      }}
                    >
                      <div className="sc-item-card__img-wrap">
                        {item.image_url ? (
                          <img
                            src={item.image_url}
                            alt={item.name}
                            className="sc-item-card__img"
                          />
                        ) : (
                          <div className="sc-item-card__no-img">
                            {s.noImage}
                          </div>
                        )}
                      </div>
                      <div className="sc-item-card__info">
                        <p className="sc-item-card__name">{item.name}</p>
                        <p className="sc-item-card__desc">{item.description}</p>
                        <p className="sc-item-card__by">
                          {s.lostBy} {item.author_name}
                        </p>
                      </div>
                      {(isSchoolAdmin || user?.id === item.author_id) && (
                        <div className="sc-item-card__actions">
                          {user?.id === item.author_id && (
                            <button
                              className="sc-btn sc-btn--success sc-btn--sm"
                              onClick={(e) => handleMarkFound(e, item.id)}
                            >
                              {s.markFound}
                            </button>
                          )}
                          <button
                            className="sc-btn sc-btn--danger sc-btn--sm sc-btn--icon"
                            onClick={(e) => handleDeleteLost(e, item.id)}
                          >
                            <FaTrash />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  {filteredLost.length === 0 && (
                    <div className="sc-empty">{s.noLostItems}</div>
                  )}
                </div>
              )}
            </>
          )}

          {/* ── ADD ITEM (merged found + lost with pill toggle) ── */}
          {activeTab === "add-item" && (
            <div className="sc-panel-content">
              <div className="sc-section-title">
                {addMode === "found" ? s.reportFoundTitle : s.reportLostTitle}
              </div>

              {/* ── Pill toggle ── */}
              <AddItemToggle />

              {/* ── Found form ── */}
              {addMode === "found" && (
                <>
                  {foundSuccess ? (
                    <div className="sc-success">
                      <span className="sc-success__icon">✓</span>
                      <p>{s.itemPostedMsg}</p>
                    </div>
                  ) : (
                    <form className="sc-form" onSubmit={handleAddFound}>
                      <label className="sc-form__label">{s.itemNameLabel}</label>
                      <input
                        className="sc-form__input"
                        type="text"
                        placeholder={s.itemNamePlaceholder}
                        required
                        value={foundName}
                        onChange={(e) => setFoundName(e.target.value)}
                      />

                      <label className="sc-form__label">Category</label>
                      <select
                        style={selectStyle}
                        value={foundCategory}
                        onChange={(e) => setFoundCategory(e.target.value)}
                      >
                        <option value="">Select a category</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <label className="sc-form__label">{s.descLabel}</label>
                      <textarea
                        className="sc-form__textarea"
                        placeholder={s.descFoundPlaceholder}
                        required
                        value={foundDesc}
                        onChange={(e) => setFoundDesc(e.target.value)}
                      />

                      <label className="sc-form__label">Where was it found?</label>
                      <input
                        className="sc-form__input"
                        type="text"
                        placeholder="e.g. Room 204, near the gym, front office..."
                        value={foundLocation}
                        onChange={(e) => setFoundLocation(e.target.value)}
                      />

                      <label className="sc-form__label">Date Found</label>
                      <input
                        className="sc-form__input"
                        type="date"
                        value={foundDate}
                        onChange={(e) => setFoundDate(e.target.value)}
                        style={{ colorScheme: "dark" }}
                      />

                      <label className="sc-form__label">{s.photosLabel}</label>
                      <label
                        className="sc-form__file-label"
                        htmlFor="sc-found-upload"
                      >
                        <span className="sc-form__file-icon">+</span>
                        <span>
                          {foundFiles.length > 0
                            ? `${foundFiles.length} ${s.photosSelected}`
                            : s.uploadPhotos}
                        </span>
                      </label>
                      <input
                        id="sc-found-upload"
                        className="sc-form__file"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          e.target.files &&
                          setFoundFiles(Array.from(e.target.files).slice(0, 3))
                        }
                      />
                      {foundFiles.length > 0 && (
                        <div className="sc-form__previews">
                          {foundFiles.map((file, idx) => (
                            <div key={idx} className="sc-form__preview-wrap">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`preview ${idx + 1}`}
                                className="sc-form__preview"
                              />
                              <button
                                type="button"
                                className="sc-form__preview-remove"
                                onClick={() =>
                                  setFoundFiles(
                                    foundFiles.filter((_, i) => i !== idx),
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="sc-form__actions">
                        <button
                          type="button"
                          className="sc-btn sc-btn--ghost"
                          onClick={() => setActiveTab("items")}
                        >
                          {s.cancelBtn}
                        </button>
                        <button
                          type="submit"
                          className="sc-btn sc-btn--primary"
                          style={{ background: color, borderColor: color }}
                          disabled={foundUploading}
                        >
                          {foundUploading ? s.postingBtn : s.postItemBtn}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}

              {/* ── Lost form ── */}
              {addMode === "lost" && (
                <>
                  {lostSuccess ? (
                    <div className="sc-success">
                      <span className="sc-success__icon">✓</span>
                      <p>{s.lostPostedMsg}</p>
                    </div>
                  ) : (
                    <form className="sc-form" onSubmit={handleAddLost}>
                      <label className="sc-form__label">{s.whatLostLabel}</label>
                      <input
                        className="sc-form__input"
                        type="text"
                        placeholder={s.lostItemPlaceholder}
                        required
                        value={lostName}
                        onChange={(e) => setLostName(e.target.value)}
                      />

                      <label className="sc-form__label">Category</label>
                      <select
                        style={selectStyle}
                        value={lostCategory}
                        onChange={(e) => setLostCategory(e.target.value)}
                      >
                        <option value="">Select a category</option>
                        {CATEGORIES.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <label className="sc-form__label">{s.descLabel}</label>
                      <textarea
                        className="sc-form__textarea"
                        placeholder={s.descLostPlaceholder}
                        required
                        value={lostDesc}
                        onChange={(e) => setLostDesc(e.target.value)}
                      />

                      <label className="sc-form__label">Last seen where?</label>
                      <input
                        className="sc-form__input"
                        type="text"
                        placeholder="e.g. Cafeteria, locker room, room 101..."
                        value={lostLocation}
                        onChange={(e) => setLostLocation(e.target.value)}
                      />

                      <label className="sc-form__label">
                        {s.photosOptionalLabel}
                      </label>
                      <label
                        className="sc-form__file-label"
                        htmlFor="sc-lost-upload"
                      >
                        <span className="sc-form__file-icon">+</span>
                        <span>
                          {lostFiles.length > 0
                            ? `${lostFiles.length} ${s.photosSelected}`
                            : s.uploadPhotos}
                        </span>
                      </label>
                      <input
                        id="sc-lost-upload"
                        className="sc-form__file"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={(e) =>
                          e.target.files &&
                          setLostFiles(Array.from(e.target.files).slice(0, 3))
                        }
                      />
                      {lostFiles.length > 0 && (
                        <div className="sc-form__previews">
                          {lostFiles.map((file, idx) => (
                            <div key={idx} className="sc-form__preview-wrap">
                              <img
                                src={URL.createObjectURL(file)}
                                alt={`preview ${idx + 1}`}
                                className="sc-form__preview"
                              />
                              <button
                                type="button"
                                className="sc-form__preview-remove"
                                onClick={() =>
                                  setLostFiles(
                                    lostFiles.filter((_, i) => i !== idx),
                                  )
                                }
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="sc-form__actions">
                        <button
                          type="button"
                          className="sc-btn sc-btn--ghost"
                          onClick={() => setActiveTab("items")}
                        >
                          {s.cancelBtn}
                        </button>
                        <button
                          type="submit"
                          className="sc-btn sc-btn--primary"
                          style={{ background: color, borderColor: color }}
                          disabled={lostUploading}
                        >
                          {lostUploading ? s.postingLostBtn : s.postLostBtn}
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── ADMIN LOGIN ── */}
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
                  <label className="sc-form__label">
                    {s.adminPasswordLabel}
                  </label>
                  <input
                    className="sc-form__input"
                    type="password"
                    placeholder={s.adminPasswordPlaceholder}
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    required
                  />
                  {adminError && <p className="sc-form__error">{adminError}</p>}
                  <button
                    type="submit"
                    className="sc-btn sc-btn--primary"
                    style={{ background: color, borderColor: color }}
                    disabled={adminChecking}
                  >
                    {adminChecking ? s.checkingBtn : s.unlockBtn}
                  </button>
                </form>
              )}
            </div>
          )}

          {/* ── REPORTS (school admin only) ── */}
          {activeTab === "reports" && isSchoolAdmin && (
            <div className="sc-panel-content">
              <div className="sc-section-title">Reports</div>
              <p
                style={{
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "0.82rem",
                  color: "var(--text-muted, #888)",
                  margin: "0 0 16px",
                }}
              >
                Items reported by users in this school board. Only you (school
                admin) can see and act on these.
              </p>
              <SchoolReportsPanel
                school={school}
                onDeleteItem={handleReportDeleteItem}
                color={color}
              />
            </div>
          )}
        </main>
      </div>
    </div>
  );
}