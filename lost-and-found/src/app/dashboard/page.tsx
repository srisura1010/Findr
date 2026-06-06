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
  // Sidebar tabs
  tabItems: string;
  tabMyItems: string;
  tabReportItem: string;
  tabBecomeAdmin: string;
  tabAdmin: string;
  tabReports: string;
  tabBanManagement: string;
  tabInbox: string;
  // Admin banner
  adminBannerMsg: string;
  adminBannerExit: string;
  // Search / board tabs
  searchPlaceholder: string;
  foundItemsTab: string;
  lostItemsTab: string;
  // Item cards
  foundBy: string;
  lostBy: string;
  claimPending: string;
  noFoundItems: string;
  noFoundItemsSearch: string;
  tryKeywords: string;
  noLostItems: string;
  noLostItemsSearch: string;
  clickReportLost: string;
  // Toggle
  toggleFound: string;
  toggleLost: string;
  // Add found item form
  reportFoundTitle: string;
  itemPosted: string;
  itemNameLabel: string;
  itemNamePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  photosLabel: string;
  photosSelected: string;
  uploadPhotos: string;
  photoHint: string;
  cancelBtn: string;
  postItemBtn: string;
  uploadingBtn: string;
  // Report lost form
  reportLostTitle: string;
  lostItemPosted: string;
  whatLostLabel: string;
  itemNameDefault: string;
  descLostPlaceholder: string;
  postingBtn: string;
  postLostBtn: string;
  // My items
  myItemsTitle: string;
  signInToView: string;
  noItemsYet: string;
  foundItemsPosted: string;
  lostItemsReported: string;
  claimPendingStatus: string;
  activeStatus: string;
  confirmClaimed: string;
  markAsFound: string;
  // Become admin panel
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
  // Admin login panel
  adminAccessTitle: string;
  adminLoginHint: string;
  adminPasswordLabel: string;
  adminPasswordPlaceholder: string;
  checkingBtn: string;
  unlockAdminBtn: string;
  adminUnlocked: string;
  adminUnlockedSub: string;
  adminIncorrect: string;
  // Reports panel
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
  // Ban management
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
  adminBannerMsg: "Admin mode active — you can delete items and ban users",
  adminBannerExit: "Exit Admin",
  searchPlaceholder: "Search items...",
  foundItemsTab: "Found Items",
  lostItemsTab: "Lost Items",
  foundBy: "Found by:",
  lostBy: "Lost by:",
  claimPending: "⏳ Claim pending",
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
  claimPendingStatus: "⏳ Claim pending",
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
  noItemReports: "No item reports — all clear!",
  noUserReports: "No user reports — all clear!",
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
};

// ── Sub-panels (receive s prop) ───────────────────────────────────────────────

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
    if (!confirm(`Delete "${report.item_name}" permanently?`)) return;
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
    if (!confirm(`Permanently ban ${report.reported_user_name}?`)) return;
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
      setErrorMsg(`Failed: ${error.message}`);
    } else {
      setSuccessMsg(
        banType === "permanent"
          ? `${email} has been permanently banned.`
          : `${email} has been suspended for ${suspendDays} days.`,
      );
      setEmail("");
      setReason("");
      fetchBannedUsers();
    }
    setLoading(false);
  };

  const handleUnban = async (emailToUnban: string) => {
    if (!confirm(`Unban ${emailToUnban}?`)) return;
    const { error } = await supabase
      .from("banned_users")
      .delete()
      .eq("email", emailToUnban);
    if (!error) {
      setSuccessMsg(`${emailToUnban} has been unbanned.`);
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
                fontFamily: "Poppins, sans-serif",
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
              fontFamily: "Poppins, sans-serif",
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
                    fontFamily: "Poppins, sans-serif",
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
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {u.reason}
                </span>
                <span
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    fontFamily: "Poppins, sans-serif",
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
                  fontFamily: "Poppins, sans-serif",
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const {
    items,
    lostItems,
    addItem,
    addLostItem,
    updateItemStatus,
    removeLostItem,
  } = useItems();
  const { user, isLoaded } = useUser();
  const { language } = useSettings();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("items");
  const [isReady, setIsReady] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [reportsTab, setReportsTab] = useState<"items" | "users">("items");
  const [reportMode, setReportMode] = useState<"found" | "lost">("found");
  const [s, setS] = useState<DashStrings>(DEFAULT_STRINGS);

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

  // ── Translation effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (language === "en") {
      setS(DEFAULT_STRINGS);
      setIsReady(true);
      return;
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
      ["claimPending", "⏳ Claim pending", "dash_claimPending"],
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
      ["claimPendingStatus", "⏳ Claim pending", "dash_claimPendingStatus"],
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
      ["noItemReports", "No item reports — all clear!", "dash_noItemReports"],
      ["noUserReports", "No user reports — all clear!", "dash_noUserReports"],
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
    ];

    const translateAll = async () => {
      await Promise.all(
        translations.map(([field, key, cacheKey]) =>
          fetchTranslation(key, language, cacheKey, (val) =>
            setS((prev) => ({ ...prev, [field]: val })),
          ),
        ),
      );
      setIsReady(true);
    };

    translateAll();
  }, [language]);

  // ── Item handlers ─────────────────────────────────────────────────────────
  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [lostItemName, setLostItemName] = useState("");
  const [lostItemDesc, setLostItemDesc] = useState("");
  const [lostSelectedFiles, setLostSelectedFiles] = useState<File[]>([]);
  const [lostItemUploading, setLostItemUploading] = useState(false);
  const [lostItemSuccess, setLostItemSuccess] = useState(false);

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

  const advanceCropQueue = (results: File[], queue: File[], idx: number, target: "found" | "lost") => {
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
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (!error) updateItemStatus(itemId, "claimed");
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm("Delete this item permanently?")) return;
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (!error) updateItemStatus(itemId, "claimed");
  };

  const handleDeleteLostItem = async (itemId: number) => {
    if (!confirm("Delete this lost item report permanently?")) return;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemDesc || selectedFiles.length === 0 || !user)
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
            image_url: imageUrls[0],
            image_urls: imageUrls,
            author_name: user.fullName || user.username || "Anonymous",
            author_avatar: user.imageUrl,
            author_id: user.id,
            author_email: user.primaryEmailAddress?.emailAddress,
            status: "waiting",
            ai_keywords: aiKeywordsArray.join(", "),
            date_found: new Date().toISOString(),
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
      } as any);
      setNewItemName("");
      setNewItemDesc("");
      setSelectedFiles([]);
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

  const handleLostSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lostItemName || !lostItemDesc || !user) return;
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
            image_url: imageUrls[0] || null,
            image_urls: imageUrls.length > 0 ? imageUrls : null,
            author_name: user.fullName || user.username || "Anonymous",
            author_avatar: user.imageUrl,
            author_id: user.id,
            author_email: user.primaryEmailAddress?.emailAddress,
            status: "looking",
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
      });
      setLostItemName("");
      setLostItemDesc("");
      setLostSelectedFiles([]);
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

  const filteredItems = searchQuery.trim()
    ? (items ?? []).filter((item) => {
        const q = searchQuery.toLowerCase();
        const haystack =
          `${item.name} ${item.description} ${(item as any).aiKeywords ?? ""}`.toLowerCase();
        return (
          haystack.includes(q) ||
          q.split(/\s+/).some((word) => haystack.includes(word))
        );
      })
    : (items ?? []);

  const filteredLostItems = searchQuery.trim()
    ? (lostItems ?? []).filter((item) => {
        const q = searchQuery.toLowerCase();
        const haystack = `${item.name} ${item.description}`.toLowerCase();
        return (
          haystack.includes(q) ||
          q.split(/\s+/).some((word) => haystack.includes(word))
        );
      })
    : (lostItems ?? []);

  // ── Sidebar tabs ────────────────────────────────────────────────────────
  const SIDEBAR_TABS: {
    id: TabId;
    label: string;
    icon: React.ReactNode;
    adminOnly?: boolean;
  }[] = [
    { id: "items", label: s.tabItems, icon: <HiOutlineMagnifyingGlass /> },
    { id: "my-items", label: s.tabMyItems, icon: <FaClipboard /> },
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
              fontFamily: "Poppins, sans-serif",
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

            {/* Pill toggle */}
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
                    <label className="panel-form__label">{s.itemNameLabel}</label>
                    <input
                      type="text"
                      placeholder={s.itemNamePlaceholder}
                      value={newItemName}
                      onChange={(e) => setNewItemName(e.target.value)}
                      required
                      className="panel-form__input"
                    />
                    <label className="panel-form__label">
                      {s.descriptionLabel}
                    </label>
                    <textarea
                      placeholder={s.descriptionPlaceholder}
                      value={newItemDesc}
                      onChange={(e) => setNewItemDesc(e.target.value)}
                      required
                      className="panel-form__textarea"
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
                          setSelectedFiles([]);
                          setActiveTab("items");
                        }}
                      >
                        {s.cancelBtn}
                      </button>
                      <button
                        type="submit"
                        className="panel-form__submit"
                        disabled={isUploading}
                      >
                        {isUploading ? s.uploadingBtn : s.postItemBtn}
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
                    <label className="panel-form__label">{s.whatLostLabel}</label>
                    <input
                      type="text"
                      placeholder={s.itemNameDefault}
                      value={lostItemName}
                      onChange={(e) => setLostItemName(e.target.value)}
                      required
                      className="panel-form__input"
                    />
                    <label className="panel-form__label">
                      {s.descriptionLabel}
                    </label>
                    <textarea
                      placeholder={s.descLostPlaceholder}
                      value={lostItemDesc}
                      onChange={(e) => setLostItemDesc(e.target.value)}
                      required
                      className="panel-form__textarea"
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
                          setLostSelectedFiles([]);
                          setActiveTab("items");
                        }}
                      >
                        {s.cancelBtn}
                      </button>
                      <button
                        type="submit"
                        className="panel-form__submit"
                        disabled={lostItemUploading}
                      >
                        {lostItemUploading ? s.postingBtn : s.postLostBtn}
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
                    fontFamily: "Poppins, sans-serif",
                    background:
                      reportsTab === t ? "var(--danger)" : "var(--bg-page)",
                    color: reportsTab === t ? "#fff" : "var(--text-muted)",
                    transition: "all 0.15s ease",
                  }}
                >
                  {t === "items" ? s.reportedItemsTab : s.reportedUsersTab}
                </button>
              ))}
            </div>
            <div className="main-panel-content" style={{ maxWidth: "720px" }}>
              <div className="main-panel-section-title">
                {reportsTab === "items"
                  ? s.reportedItemsTitle
                  : s.reportedUsersTitle}
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
        return (
          <div className="main-panel-content" style={{ maxWidth: "960px" }}>
            <div className="main-panel-section-title">{s.myItemsTitle}</div>
            {!user ? (
              <p className="panel-empty">{s.signInToView}</p>
            ) : myFoundItems.length === 0 && myLostItems.length === 0 ? (
              <p className="panel-empty">{s.noItemsYet}</p>
            ) : (
              <>
                {myFoundItems.length > 0 && (
                  <>
                    <p
                      className="panel-section-title"
                      style={{ marginBottom: 8 }}
                    >
                      {s.foundItemsPosted} ({myFoundItems.length})
                    </p>
                    <div className="items-container" style={{ margin: 0 }}>
                      {myFoundItems.map((item) => (
                        <div key={item.id} className="item-card">
                          <div className="item-image-wrapper">
                            <img
                              className="item-image"
                              src={item.image}
                              alt={item.name}
                            />
                          </div>
                          <div className="item-info">
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
                            <p
                              style={{
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                marginTop: 4,
                                color:
                                  item.status === "pending"
                                    ? "var(--accent)"
                                    : "var(--success)",
                                fontFamily: "Poppins, sans-serif",
                              }}
                            >
                              {item.status === "pending"
                                ? s.claimPendingStatus
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
                              <button
                                className="delete-button"
                                onClick={() => handleDelete(item.id)}
                              >
                                <FaTrash />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {myLostItems.length > 0 && (
                  <>
                    <p
                      className="panel-section-title"
                      style={{
                        marginBottom: 8,
                        marginTop: myFoundItems.length > 0 ? 24 : 0,
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
                                  fontFamily: "Poppins, sans-serif",
                                }}
                              >
                                ?
                              </div>
                            )}
                          </div>
                          <div className="item-info">
                            <h3>{item.name}</h3>
                            <p>{item.description}</p>
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
                  </>
                )}
              </>
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
            <p className="dashboard-sidebar__brand-title">Findr Dashboard</p>
            <p className="dashboard-sidebar__brand-sub">Your Lost & Found</p>
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
            <div className="panel-search" style={{ margin: "16px 20px 0" }}>
              <span className="panel-search__icon"></span>
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

            <div
              style={{
                display: "flex",
                gap: "8px",
                padding: "16px 20px 0",
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
                    fontFamily: "Poppins, sans-serif",
                    background: boardTab === t ? "#285ebb" : "var(--bg-page)",
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
                        <h3>{item.name}</h3>
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
                        {item.status === "pending" && (
                          <span
                            style={{
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              color: "var(--accent)",
                              fontFamily: "Poppins, sans-serif",
                              marginTop: 4,
                            }}
                          >
                            {s.claimPending}
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
                            fontFamily: "Poppins, sans-serif",
                          }}
                        >
                          ?
                        </div>
                      )}
                    </div>
                    <div className="item-info item-info--card">
                      <h3>{item.name}</h3>
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
          {/* Header */}
          <p
            style={{
              color: "#fff",
              fontFamily: "Poppins, sans-serif",
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

          {/* Cropper box — 16:10 matches .item-image-wrapper aspect-ratio */}
          <div
            style={{
              position: "relative",
              width: "min(90vw, 600px)",
              aspectRatio: "16 / 10",
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
              aspect={16 / 10}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onRotationChange={setRotation}
              onCropComplete={(_area, pixels) => setCroppedAreaPixels(pixels)}
            />
          </div>

          {/* Controls */}
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
            {/* Zoom */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "Poppins, sans-serif",
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
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "11px",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {zoom.toFixed(1)}×
              </span>
            </div>

            {/* Rotate */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: "Poppins, sans-serif",
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
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "11px",
                  minWidth: 32,
                  textAlign: "right",
                }}
              >
                {rotation}°
              </span>
            </div>
          </div>

          {/* Action buttons */}
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
                fontFamily: "Poppins, sans-serif",
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
                fontFamily: "Poppins, sans-serif",
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