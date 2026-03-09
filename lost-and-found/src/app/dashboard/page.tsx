"use client";

import "./dashboard.css";
import { useItems } from "@/context/ItemsContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import emailjs from "@emailjs/browser";
import { useSettings } from "@/context/SettingsContext";
import { useEffect, useState, useRef } from "react";
import { getConversationId } from "@/app/components/MessagingSystem";
import { FaFlag } from "react-icons/fa6";
import { FaUser } from "react-icons/fa";
import { useRouter } from "next/navigation";
import { AdminInboxPanel } from "@/app/components/AdminInboxPanel";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import { HiOutlineSearch } from "react-icons/hi";
import { IoAddSharp } from "react-icons/io5";
import { FaExclamationTriangle } from "react-icons/fa";
import { ImHammer2 } from "react-icons/im";
import { FaClipboard } from "react-icons/fa";
import { IoMdMailOpen } from "react-icons/io";
import { MdFlagCircle } from "react-icons/md";
import { CiLogin } from "react-icons/ci";


interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  item_id: string;
  item_title: string;
  text: string;
  created_at: string;
}
interface ChatUser {
  uid: string;
  displayName: string;
}
interface ChatItem {
  id: number;
  name: string;
  [key: string]: unknown;
}
interface ActiveChat {
  conversationId: string;
  item: ChatItem;
  otherUser: ChatUser;
}
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

type TabId = "items" | "add-item" | "report-lost" | "my-items" | "become-admin" | "admin-login" | "reports" | "ban-management" | "inbox";

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam or duplicate",
  "Misleading information",
  "Already claimed / resolved",
  "Other",
];

const SIDEBAR_TABS: { id: TabId; label: string; icon: React.ReactNode; adminOnly?: boolean }[] = [
  { id: "items",          label: "Items",             icon: <HiOutlineSearch /> },
  { id: "add-item",       label: "Report Found Item",  icon: <IoAddSharp /> },
  { id: "report-lost",    label: "Report Lost Item",   icon: <FaExclamationTriangle /> },
  { id: "my-items",       label: "My Items",           icon: <FaUser /> },
  { id: "become-admin",   label: "Become an Admin",    icon: <FaClipboard /> },
  { id: "admin-login",    label: "Admin",              icon: <CiLogin /> },
  { id: "reports",        label: "Reports",            icon: <MdFlagCircle />, adminOnly: true },
  { id: "ban-management", label: "Ban Management",     icon: <ImHammer2 />, adminOnly: true },
  { id: "inbox",          label: "Inbox",              icon: <IoMdMailOpen />, adminOnly: true },
];

function ReportModal({
  item, currentUser, onClose, onSubmitted,
}: {
  item: any;
  currentUser: { uid: string; displayName: string; email: string };
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    await supabase.from("reports").insert({
      item_id: item.id,
      item_name: item.name,
      item_image: item.image || null,
      reporter_id: currentUser.uid,
      reporter_name: currentUser.displayName,
      reporter_email: currentUser.email,
      reason: selectedReason,
    });
    setDone(true);
    setSubmitting(false);
    setTimeout(() => { onSubmitted(); onClose(); }, 1200);
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div className="panel-success">
            <span className="panel-success__icon">✓</span>
            <p>Report submitted</p>
          </div>
        ) : (
          <>
            <p className="report-modal__title">Report "{item.name}"</p>
            <p className="report-modal__subtitle">Why are you reporting this item?</p>
            <div className="report-modal__reasons">
              {REPORT_REASONS.map((reason) => (
                <button
                  key={reason}
                  className={`report-modal__reason${selectedReason === reason ? " report-modal__reason--selected" : ""}`}
                  onClick={() => setSelectedReason(reason)}
                >
                  {reason}
                </button>
              ))}
            </div>
            <div className="report-modal__actions">
              <button className="report-modal__cancel" onClick={onClose}>Cancel</button>
              <button className="report-modal__submit" onClick={handleSubmit} disabled={!selectedReason || submitting}>
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ChatModal({
  conversationId, item, currentUser, otherUser, onClose,
}: {
  conversationId: string;
  item: ChatItem;
  currentUser: ChatUser;
  otherUser: ChatUser;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchMessages = async () => {
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (messages) setMessages(messages);
    };
    fetchMessages();
    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) =>
        setMessages((prev) =>
          prev.some((m) => m.id === (payload.new as Message).id)
            ? prev : [...prev, payload.new as Message],
        ),
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");
    setMessages((prev) => [...prev, {
      id: Date.now(), conversation_id: conversationId,
      sender_id: currentUser.uid, sender_name: currentUser.displayName,
      receiver_id: otherUser.uid, item_id: String(item.id),
      item_title: item.name, text: trimmed, created_at: new Date().toISOString(),
    }]);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: currentUser.uid, sender_name: currentUser.displayName,
      receiver_id: otherUser.uid, receiver_name: otherUser.displayName,
      item_id: String(item.id), item_title: item.name, text: trimmed, read: false,
    });
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal" onClick={(e) => e.stopPropagation()}>
        <div className="chat-modal__header">
          <div className="chat-modal__avatar">{otherUser.displayName?.[0]?.toUpperCase() ?? "?"}</div>
          <div className="chat-modal__header-info">
            <div className="chat-modal__name">{otherUser.displayName}</div>
            <div className="chat-modal__item">{item.name}</div>
          </div>
          <button className="chat-modal__close" onClick={onClose}>×</button>
        </div>
        <div className="chat-modal__messages">
          {messages.length === 0 && (
            <div className="chat-modal__empty"><p>Say hi about <strong>{item.name}</strong></p></div>
          )}
          {messages.map((msg) => {
            const isOwn = msg.sender_id === currentUser.uid;
            return (
              <div key={msg.id} className={`chat-bubble-wrapper${isOwn ? " chat-bubble-wrapper--own" : ""}`}>
                <div className={`chat-bubble${isOwn ? " chat-bubble--own" : " chat-bubble--other"}`}>{msg.text}</div>
                <span className="chat-bubble__time">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
        <div className="chat-modal__input-row">
          <textarea rows={1} value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown} placeholder="Type a message..." className="chat-modal__textarea" />
          <button onClick={handleSend} disabled={!text.trim() || sending}
            className={`chat-modal__send${text.trim() ? " chat-modal__send--active" : ""}`}>↑</button>
        </div>
      </div>
    </div>
  );
}

function AdminPanel() {
  const { user } = useUser();
  const [adminForm, setAdminForm] = useState({ name: "", email: "", school: "", teacherId: "", extraInfo: "" });
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
        const { error: uploadError } = await supabase.storage.from("item-images").upload(fileName, adminFile);
        if (uploadError) { console.error(uploadError.message); return; }
        const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
        idImageUrl = urlData.publicUrl;
      }
      const { error } = await supabase.from("admin_requests").insert([{
        name: adminForm.name, email: adminForm.email, school: adminForm.school,
        teacher_id: adminForm.teacherId, extra_info: adminForm.extraInfo,
        id_image_url: idImageUrl, status: "pending",
      }]);
      if (error) { console.error(error.message); return; }
      setAdminSuccess(true);
    } catch (err) {
      console.error(err);
    } finally {
      setAdminUploading(false);
    }
  };

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">Become an Admin</div>
      {adminSuccess ? (
        <div className="panel-success">
          <span className="panel-success__icon">✓</span>
          <p>Request submitted!</p>
          <p className="panel-success__sub">We will review and get back to you.</p>
        </div>
      ) : (
        <form className="panel-form" onSubmit={handleAdminSubmit}>
          <label className="panel-form__label">Full Name</label>
          <input className="panel-form__input" type="text" placeholder="Jane Smith" required value={adminForm.name} readOnly />

          <label className="panel-form__label">Email</label>
          <input className="panel-form__input" type="email" placeholder="jane@school.edu" required value={adminForm.email} readOnly />

          <label className="panel-form__label">School / Institution</label>
          <input className="panel-form__input" type="text" placeholder="Lincoln High School" required value={adminForm.school}
            onChange={(e) => setAdminForm((p) => ({ ...p, school: e.target.value }))} />

          <label className="panel-form__label">Teacher ID / Staff Number</label>
          <input className="panel-form__input" type="text" placeholder="T-00123" required value={adminForm.teacherId}
            onChange={(e) => setAdminForm((p) => ({ ...p, teacherId: e.target.value }))} />

          <label className="panel-form__label">Upload ID or Badge Photo</label>
          <label className="panel-form__file-label" htmlFor="admin-file-upload">
            <span className="panel-form__file-icon">+</span>
            <span className="panel-form__file-text">
              {adminFile ? adminFile.name : "Upload ID or badge photo"}
            </span>
          </label>
          <input
            id="admin-file-upload"
            className="panel-form__file"
            type="file"
            accept="image/*"
            onChange={(e) => { if (e.target.files?.[0]) setAdminFile(e.target.files[0]); }}
          />
          <p className="panel-form__file-hint">PNG, JPG up to 10MB</p>

          {adminFile && (
            <div className="panel-form__preview-wrap">
              <img src={URL.createObjectURL(adminFile)} alt="preview" className="panel-form__preview" />
              <button type="button" className="panel-form__preview-remove" onClick={() => setAdminFile(null)}>×</button>
            </div>
          )}

          <label className="panel-form__label">Anything else we should know?</label>
          <textarea className="panel-form__textarea" placeholder="e.g. I run the lost and found office..."
            value={adminForm.extraInfo} onChange={(e) => setAdminForm((p) => ({ ...p, extraInfo: e.target.value }))} />

          <button type="submit" className="panel-form__submit" disabled={adminUploading}>
            {adminUploading ? "Submitting..." : "Submit Request"}
          </button>
        </form>
      )}
    </div>
  );
}

function AdminLoginPanel({ onUnlock }: { onUnlock: () => void }) {
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
      .from("admins").select("id, name")
      .eq("email", user?.primaryEmailAddress?.emailAddress)
      .eq("password", password).single();
    if (dbError || !data) {
      setError("Incorrect password or not approved yet.");
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
          <p>Admin view unlocked!</p>
          <p className="panel-success__sub">Delete buttons and ban tools are now visible.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">Admin Access</div>
      <p className="admin-login__hint">Enter the password from your approval email.</p>
      <form className="panel-form" onSubmit={handleCheck}>
        <label className="panel-form__label">Admin Password</label>
        <input className="panel-form__input" type="password" placeholder="e.g. FINDR-JANE-X4K2"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="admin-login__error">{error}</p>}
        <button type="submit" className="panel-form__submit" disabled={checking}>
          {checking ? "Checking..." : "Unlock Admin View"}
        </button>
      </form>
    </div>
  );
}

function ReportedItemsPanel({ updateItemStatus }: { updateItemStatus: (id: number, status: string) => void }) {
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

  useEffect(() => { fetchReports(); }, []);

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

  if (loading) return <p className="panel-empty">Loading...</p>;
  if (reports.length === 0) return <p className="panel-empty">No item reports — all clear!</p>;

  return (
    <div className="panel-item-list">
      {reports.map((report) => (
        <div key={report.id} className="reported-card">
          {report.item_image && (
            <img src={report.item_image} alt={report.item_name} className="reported-card__img" />
          )}
          <div className="reported-card__body">
            <p className="reported-card__name">{report.item_name}</p>
            <p className="reported-card__reason">{report.reason}</p>
            <p className="reported-card__meta">
              Reported by {report.reporter_name} · {new Date(report.created_at).toLocaleDateString()}
            </p>
            <p className="reported-card__meta" style={{ color: "var(--danger)", marginTop: "2px" }}>
              Posted by {report.items?.author_name ?? "Unknown"} · {report.items?.author_email ?? ""}
            </p>
          </div>
          <div className="reported-card__actions">
            <button className="reported-card__dismiss" onClick={() => handleDismiss(report.id)}>Dismiss</button>
            <button className="reported-card__delete" onClick={() => handleDeleteItem(report)}>Delete Item</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ReportedUsersPanel({ adminEmail }: { adminEmail: string }) {
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

  useEffect(() => { fetchReports(); }, []);

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
    await supabase.from("user_reports").delete().eq("reported_user_id", report.reported_user_id);
    setReports((prev) => prev.filter((r) => r.reported_user_id !== report.reported_user_id));
  };

  if (loading) return <p className="panel-empty">Loading...</p>;
  if (reports.length === 0) return <p className="panel-empty">No user reports — all clear!</p>;

  return (
    <div className="panel-item-list">
      {reports.map((report) => (
        <div key={report.id} className="reported-card">
          <div className="reported-card__body">
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", background: "var(--accent)",
                display: "flex", alignItems: "center", justifyContent: "center",
                color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0,
              }}>
                {report.reported_user_name?.[0]?.toUpperCase() ?? "?"}
              </div>
              <p className="reported-card__name" style={{ margin: 0 }}>{report.reported_user_name}</p>
            </div>
            <p className="reported-card__reason">{report.reason}</p>
            <p className="reported-card__meta">
              Reported by {report.reporter_name} ({report.reporter_email}) · {new Date(report.created_at).toLocaleDateString()}
            </p>
            {report.reported_user_email && (
              <p className="reported-card__meta" style={{ color: "var(--danger)", marginTop: 2 }}>
                User email: {report.reported_user_email}
              </p>
            )}
          </div>
          <div className="reported-card__actions">
            <button className="reported-card__dismiss" onClick={() => handleDismiss(report.id)}>Dismiss</button>
            <button className="reported-card__delete" onClick={() => handleBanUser(report)}>Ban User</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function BanManagementPanel({ adminEmail }: { adminEmail: string }) {
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
    const { data } = await supabase.from("banned_users").select("*").order("banned_at", { ascending: false });
    if (data) setBannedUsers(data);
    setFetchingList(false);
  };

  useEffect(() => { fetchBannedUsers(); }, []);

  const handleBan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !reason.trim()) return;
    setLoading(true);
    setSuccessMsg("");
    setErrorMsg("");
    const suspendedUntil = banType === "suspend"
      ? new Date(Date.now() + Number(suspendDays) * 86400000).toISOString()
      : null;
    await supabase.from("banned_users").delete().eq("email", email.trim().toLowerCase());
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
      setSuccessMsg(banType === "permanent" ? `${email} has been permanently banned.` : `${email} has been suspended for ${suspendDays} days.`);
      setEmail("");
      setReason("");
      fetchBannedUsers();
    }
    setLoading(false);
  };

  const handleUnban = async (emailToUnban: string) => {
    if (!confirm(`Unban ${emailToUnban}?`)) return;
    const { error } = await supabase.from("banned_users").delete().eq("email", emailToUnban);
    if (!error) { setSuccessMsg(`${emailToUnban} has been unbanned.`); fetchBannedUsers(); }
  };

  const isActive = (u: BannedUser) => {
    if (!u.suspended_until) return true;
    return new Date(u.suspended_until) > new Date();
  };

  return (
    <div className="main-panel-content">
      <div className="main-panel-section-title">Ban Management</div>
      <p className="admin-login__hint">Ban or suspend users by their account email.</p>
      <form className="panel-form" onSubmit={handleBan}>
        <label className="panel-form__label">User Email</label>
        <input className="panel-form__input" type="email" placeholder="user@school.edu"
          value={email} onChange={(e) => setEmail(e.target.value)} required />

        <label className="panel-form__label">Reason</label>
        <textarea className="panel-form__textarea" placeholder="e.g. Spam, abusive messages, false claims..."
          value={reason} onChange={(e) => setReason(e.target.value)} required />

        <div style={{ display: "flex", gap: "8px", marginBottom: "4px" }}>
          <button type="button"
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid var(--border-input)", background: banType === "permanent" ? "var(--accent)" : "var(--bg-input)", color: banType === "permanent" ? "#fff" : "var(--text-primary)", fontSize: "13px", fontWeight: "600", fontFamily: "Poppins, sans-serif", cursor: "pointer", transition: "all 0.15s ease" }}
            onClick={() => setBanType("permanent")}>Permanent</button>
          <button type="button"
            style={{ flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid var(--border-input)", background: banType === "suspend" ? "var(--accent)" : "var(--bg-input)", color: banType === "suspend" ? "#fff" : "var(--text-primary)", fontSize: "13px", fontWeight: "600", fontFamily: "Poppins, sans-serif", cursor: "pointer", transition: "all 0.15s ease" }}
            onClick={() => setBanType("suspend")}>Suspend</button>
        </div>

        {banType === "suspend" && (
          <>
            <label className="panel-form__label">Suspend for how many days?</label>
            <input className="panel-form__input" type="number" min="1" max="365"
              value={suspendDays} onChange={(e) => setSuspendDays(e.target.value)} />
          </>
        )}

        {successMsg && <p style={{ color: "var(--success)", fontSize: "0.85rem", margin: "4px 0", fontFamily: "Poppins, sans-serif" }}>{successMsg}</p>}
        {errorMsg && <p className="admin-login__error">{errorMsg}</p>}

        <button type="submit" className="panel-form__submit" disabled={loading}>
          {loading ? "Processing..." : banType === "permanent" ? "Ban User" : "Suspend User"}
        </button>
      </form>

      <div className="main-panel-section-title" style={{ marginTop: "1.5rem" }}>Active Bans & Suspensions</div>
      {fetchingList ? (
        <p className="panel-empty">Loading...</p>
      ) : bannedUsers.length === 0 ? (
        <p className="panel-empty">No banned users.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
          {bannedUsers.map((u) => (
            <div key={u.email} style={{
              padding: "12px 14px", borderRadius: "10px",
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              opacity: isActive(u) ? 1 : 0.5,
              display: "flex", justifyContent: "space-between", alignItems: "center",
              gap: "12px",
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
                <span style={{ fontWeight: 600, fontSize: "0.85rem", color: "var(--text-primary)", fontFamily: "Poppins, sans-serif", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</span>
                <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontFamily: "Poppins, sans-serif" }}>{u.reason}</span>
                <span style={{ fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "Poppins, sans-serif" }}>
                  {u.suspended_until ? isActive(u) ? `Suspended until ${new Date(u.suspended_until).toLocaleDateString()}` : "Suspension expired" : "Permanent ban"} · by {u.banned_by}
                </span>
              </div>
              <button onClick={() => handleUnban(u.email)} style={{
                padding: "5px 12px", borderRadius: "6px", background: "var(--danger)",
                color: "white", border: "none", cursor: "pointer", fontSize: "0.78rem",
                fontFamily: "Poppins, sans-serif", fontWeight: 600, flexShrink: 0,
                transition: "background 0.15s ease",
              }}>Unban</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { items, lostItems, addItem, addLostItem, updateItemStatus, removeLostItem } = useItems();
  const { user, isLoaded } = useUser();
  const { language } = useSettings();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<TabId>("items");
  const [isReady, setIsReady] = useState(false);
  const [activeChat, setActiveChat] = useState<ActiveChat | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [reportingItem, setReportingItem] = useState<any | null>(null);
  const [boardTab, setBoardTab] = useState<"found" | "lost">("found");
  const [reportsTab, setReportsTab] = useState<"items" | "users">("items");
  const [myItemsTab, setMyItemsTab] = useState<"found" | "lost">("found");

  const [banChecked, setBanChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("findr_is_admin") === "true";
    return false;
  });
  const [adminId] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("findr_admin_id") ?? "";
    return "";
  });
  const [adminName] = useState(() => {
    if (typeof window !== "undefined") return localStorage.getItem("findr_admin_name") ?? "Admin";
    return "Admin";
  });

  useEffect(() => { localStorage.setItem("findr_is_admin", String(isAdmin)); }, [isAdmin]);

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) { setBanChecked(true); return; }
    const checkBan = async () => {
      const { data } = await supabase
        .from("banned_users").select("email, suspended_until")
        .eq("email", user.primaryEmailAddress?.emailAddress).maybeSingle();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended = data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) { router.push("/banned"); return; }
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user, isLoaded]);

  const [lostItemName, setLostItemName] = useState("");
  const [lostItemDesc, setLostItemDesc] = useState("");
  const [lostItemUploading, setLostItemUploading] = useState(false);
  const [lostItemSuccess, setLostItemSuccess] = useState(false);
  const [lostSelectedFile, setLostSelectedFile] = useState<File | null>(null);

  const [newItemName, setNewItemName] = useState("");
  const [newItemDesc, setNewItemDesc] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const [addItemText, setAddItemText] = useState("+ Add Item");
  const [reportFoundText, setReportFoundText] = useState("Report Found Item");
  const [itemNameText, setItemNameText] = useState("Item Name");
  const [descriptionText, setDescriptionText] = useState("Description (location, time, etc)");
  const [cancelText, setCancelText] = useState("Cancel");
  const [postItemText, setPostItemText] = useState("Post Item");
  const [uploadingText, setUploadingText] = useState("Uploading...");
  const [foundByText, setFoundByText] = useState("Found by:");
  const [retrieveText, setRetrieveText] = useState("Retrieve");
  const [confirmText, setConfirmText] = useState("Confirm Claimed");
  const [pendingText, setPendingText] = useState("Item Claimed (Pending Confirmation)");
  const [signInText, setSignInText] = useState("Please sign in to retrieve items");
  const [requestSentText, setRequestSentText] = useState("Request sent! The owner has been notified.");
  const [markedClaimedText, setMarkedClaimedText] = useState("Item officially marked as claimed!");

  useEffect(() => {
    if (language === "en") {
      setAddItemText("+ Add Item"); setReportFoundText("Report Found Item"); setItemNameText("Item Name");
      setDescriptionText("Description (location, time, etc)"); setCancelText("Cancel"); setPostItemText("Post Item");
      setUploadingText("Uploading..."); setFoundByText("Found by:"); setRetrieveText("Retrieve");
      setConfirmText("Confirm Claimed"); setPendingText("Item Claimed (Pending Confirmation)");
      setSignInText("Please sign in to retrieve items"); setRequestSentText("Request sent! The owner has been notified.");
      setMarkedClaimedText("Item officially marked as claimed!"); setIsReady(true); return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "+ Add Item", setter: setAddItemText, cacheKey: "nav_addItem" },
        { key: "Report Found Item", setter: setReportFoundText, cacheKey: "nav_reportFound" },
        { key: "Item Name", setter: setItemNameText, cacheKey: "nav_itemName" },
        { key: "Description (location, time, etc)", setter: setDescriptionText, cacheKey: "nav_description" },
        { key: "Cancel", setter: setCancelText, cacheKey: "nav_cancel" },
        { key: "Post Item", setter: setPostItemText, cacheKey: "nav_postItem" },
        { key: "Uploading...", setter: setUploadingText, cacheKey: "nav_uploading" },
        { key: "Found by:", setter: setFoundByText, cacheKey: "dash_foundBy" },
        { key: "Retrieve", setter: setRetrieveText, cacheKey: "dash_retrieve" },
        { key: "Confirm Claimed", setter: setConfirmText, cacheKey: "dash_confirm" },
        { key: "Item Claimed (Pending Confirmation)", setter: setPendingText, cacheKey: "dash_pending" },
        { key: "Please sign in to retrieve items", setter: setSignInText, cacheKey: "dash_signIn" },
        { key: "Request sent! The owner has been notified.", setter: setRequestSentText, cacheKey: "dash_requestSent" },
        { key: "Item officially marked as claimed!", setter: setMarkedClaimedText, cacheKey: "dash_markedClaimed" },
      ];
      for (const { key, setter, cacheKey } of translations) {
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) { setter(cached); continue; }
        try {
          const res = await fetch("/api/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: key, target: language }) });
          if (res.ok) { const data = await res.json(); const t = data.translatedText || key; setter(t); localStorage.setItem(`${cacheKey}_${language}`, t); }
        } catch { /* keep cached */ }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language]);

  const filteredItems = searchQuery.trim()
    ? (items ?? []).filter((item) => {
        const q = searchQuery.toLowerCase();
        const haystack = `${item.name} ${item.description} ${(item as any).aiKeywords ?? ""}`.toLowerCase();
        return haystack.includes(q) || q.split(/\s+/).some((word) => haystack.includes(word));
      })
    : (items ?? []);

  const filteredLostItems = searchQuery.trim()
    ? (lostItems ?? []).filter((item) => {
        const q = searchQuery.toLowerCase();
        const haystack = `${item.name} ${item.description}`.toLowerCase();
        return haystack.includes(q) || q.split(/\s+/).some((word) => haystack.includes(word));
      })
    : (lostItems ?? []);

  const handleRetrieve = async (item: any) => {
    if (!user) return alert(signInText);
    const { error } = await supabase.from("items").update({
      status: "pending", claimer_email: user.primaryEmailAddress?.emailAddress,
    }).eq("id", item.id);
    if (error) { console.error(error.message); return; }
    emailjs.send(
      process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
      process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID!,
      { author_name: item.authorName || "Owner", item_name: item.name, retriever_name: user.fullName || "A user", retriever_email: user.primaryEmailAddress?.emailAddress, to_email: item.authorEmail },
      process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!,
    ).catch(console.error);
    updateItemStatus(item.id, "pending", user.primaryEmailAddress?.emailAddress);
    alert(requestSentText);
  };

  const handleConfirmClaimed = async (itemId: number) => {
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (!error) { updateItemStatus(itemId, "claimed"); alert(markedClaimedText); }
  };

  const handleDelete = async (itemId: number) => {
    if (!confirm("Delete this item permanently?")) return;
    const { error } = await supabase.from("items").delete().eq("id", itemId);
    if (!error) updateItemStatus(itemId, "claimed");
  };

  const handleDeleteLostItem = async (itemId: number) => {
    if (!confirm("Delete this lost item report permanently?")) return;
    const { error } = await supabase.from("lost_items").delete().eq("id", itemId);
    if (!error) removeLostItem(itemId);
  };

  const handleOpenChat = (item: any, isLost = false) => {
    if (!user) return alert(signInText);
    if (user.id === item.authorId) return;
    const conversationId = getConversationId(
      { id: String(item.id) + (isLost ? "_lost" : ""), title: item.name },
      { uid: user.id, displayName: user.fullName || "Me" },
      { uid: item.authorId, displayName: item.authorName || (isLost ? "Owner" : "Finder") },
    );
    setActiveChat({
      conversationId,
      item,
      otherUser: { uid: item.authorId, displayName: item.authorName || (isLost ? "Owner" : "Finder") },
    });
  };

  const handleMarkFound = async (itemId: number) => {
    const { error } = await supabase.from("lost_items").delete().eq("id", itemId);
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
      const res = await fetch("/api/image-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: base64, mimeType: file.type }) });
      if (!res.ok) return "";
      const { keywords } = await res.json();
      return keywords ?? "";
    } catch { return ""; }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName || !newItemDesc || !selectedFile || !user) return;
    setIsUploading(true);
    try {
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const [uploadResult, aiKeywords] = await Promise.all([
        supabase.storage.from("item-images").upload(fileName, selectedFile),
        extractKeywords(selectedFile),
      ]);
      if (uploadResult.error) { console.error("Upload error:", uploadResult.error.message); return; }
      const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
      const imageUrl = urlData.publicUrl;
      const { data: insertedItem, error: insertError } = await supabase.from("items").insert([{
        name: newItemName, description: newItemDesc, image_url: imageUrl,
        author_name: user.fullName || user.username || "Anonymous", author_avatar: user.imageUrl,
        author_id: user.id, author_email: user.primaryEmailAddress?.emailAddress,
        status: "waiting", ai_keywords: aiKeywords,
      }]).select().single();
      if (insertError) { console.error("Insert error:", insertError.message); return; }
      addItem({
        id: insertedItem.id, name: insertedItem.name, description: insertedItem.description,
        image: insertedItem.image_url, authorName: insertedItem.author_name,
        authorAvatar: insertedItem.author_avatar, status: insertedItem.status,
        authorId: insertedItem.author_id, authorEmail: insertedItem.author_email || "",
        aiKeywords: insertedItem.ai_keywords || "",
      } as any);
      setNewItemName(""); setNewItemDesc(""); setSelectedFile(null); setUploadSuccess(true);
      setTimeout(() => { setUploadSuccess(false); setActiveTab("items"); }, 1500);
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
      let imageUrl = "";
      if (lostSelectedFile) {
        const fileName = `lost_${Date.now()}_${lostSelectedFile.name}`;
        const { error: uploadError } = await supabase.storage.from("item-images").upload(fileName, lostSelectedFile);
        if (uploadError) { console.error("Upload error:", uploadError.message); }
        else {
          const { data: urlData } = supabase.storage.from("item-images").getPublicUrl(fileName);
          imageUrl = urlData.publicUrl;
        }
      }
      const { data: insertedItem, error: insertError } = await supabase.from("lost_items").insert([{
        name: lostItemName, description: lostItemDesc, image_url: imageUrl || null,
        author_name: user.fullName || user.username || "Anonymous", author_avatar: user.imageUrl,
        author_id: user.id, author_email: user.primaryEmailAddress?.emailAddress, status: "looking",
      }]).select().single();
      if (insertError) { console.error("Insert error:", insertError.message); return; }
      addLostItem({
        id: insertedItem.id, name: insertedItem.name, description: insertedItem.description,
        image: insertedItem.image_url || "", authorName: insertedItem.author_name,
        authorAvatar: insertedItem.author_avatar, authorId: insertedItem.author_id,
        authorEmail: insertedItem.author_email || "", status: insertedItem.status,
        created_at: insertedItem.created_at,
      });
      setLostItemName(""); setLostItemDesc(""); setLostSelectedFile(null); setLostItemSuccess(true);
      setTimeout(() => { setLostItemSuccess(false); setActiveTab("items"); setBoardTab("lost"); }, 1500);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLostItemUploading(false);
    }
  };

  const renderMainContent = () => {
    switch (activeTab) {
      case "add-item":
        return (
          <div className="main-panel-content">
            <div className="main-panel-section-title">{reportFoundText}</div>
            {uploadSuccess ? (
              <div className="panel-success"><span className="panel-success__icon">✓</span><p>Item posted!</p></div>
            ) : (
              <form className="panel-form" onSubmit={handleSubmit}>
                <label className="panel-form__label">Item Name</label>
                <input type="text" placeholder={itemNameText} value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)} required className="panel-form__input" />

                <label className="panel-form__label">Description</label>
                <textarea placeholder={descriptionText} value={newItemDesc}
                  onChange={(e) => setNewItemDesc(e.target.value)} required className="panel-form__textarea" />

                <label className="panel-form__label">Photo</label>
                <label className="panel-form__file-label" htmlFor="found-file-upload">
                  <span className="panel-form__file-icon">+</span>
                  <span className="panel-form__file-text">
                    {selectedFile ? selectedFile.name : "Upload a photo"}
                  </span>
                </label>
                <input
                  id="found-file-upload"
                  className="panel-form__file"
                  type="file"
                  accept="image/*"
                  required
                  onChange={(e) => { if (e.target.files?.[0]) setSelectedFile(e.target.files[0]); }}
                />
                <p className="panel-form__file-hint">PNG, JPG up to 10MB</p>

                {selectedFile && (
                  <div className="panel-form__preview-wrap">
                    <img src={URL.createObjectURL(selectedFile)} alt="preview" className="panel-form__preview" />
                    <button type="button" className="panel-form__preview-remove" onClick={() => setSelectedFile(null)}>×</button>
                  </div>
                )}

                <div className="panel-form__actions">
                  <button type="button" className="panel-form__cancel"
                    onClick={() => { setNewItemName(""); setNewItemDesc(""); setSelectedFile(null); setActiveTab("items"); }}>
                    {cancelText}
                  </button>
                  <button type="submit" className="panel-form__submit" disabled={isUploading}>
                    {isUploading ? uploadingText : postItemText}
                  </button>
                </div>
              </form>
            )}
          </div>
        );

      case "report-lost":
        return (
          <div className="main-panel-content">
            <div className="main-panel-section-title">Report Lost Item</div>
            {lostItemSuccess ? (
              <div className="panel-success"><span className="panel-success__icon">✓</span><p>Lost item reported!</p></div>
            ) : (
              <form className="panel-form" onSubmit={handleLostSubmit}>
                <label className="panel-form__label">What did you lose?</label>
                <input type="text" placeholder="e.g. Black North Face backpack" value={lostItemName}
                  onChange={(e) => setLostItemName(e.target.value)} required className="panel-form__input" />

                <label className="panel-form__label">Description</label>
                <textarea placeholder="Where did you lose it? Any identifying features?" value={lostItemDesc}
                  onChange={(e) => setLostItemDesc(e.target.value)} required className="panel-form__textarea" />

                <label className="panel-form__label">
                  Photo <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>(optional)</span>
                </label>
                <label className="panel-form__file-label" htmlFor="lost-file-upload">
                  <span className="panel-form__file-icon">+</span>
                  <span className="panel-form__file-text">
                    {lostSelectedFile ? lostSelectedFile.name : "Upload a photo (optional)"}
                  </span>
                </label>
                <input
                  id="lost-file-upload"
                  className="panel-form__file"
                  type="file"
                  accept="image/*"
                  onChange={(e) => { if (e.target.files?.[0]) setLostSelectedFile(e.target.files[0]); }}
                />
                <p className="panel-form__file-hint">PNG, JPG up to 10MB</p>

                {lostSelectedFile && (
                  <div className="panel-form__preview-wrap">
                    <img src={URL.createObjectURL(lostSelectedFile)} alt="preview" className="panel-form__preview" />
                    <button type="button" className="panel-form__preview-remove" onClick={() => setLostSelectedFile(null)}>×</button>
                  </div>
                )}

                <div className="panel-form__actions">
                  <button type="button" className="panel-form__cancel"
                    onClick={() => { setLostItemName(""); setLostItemDesc(""); setLostSelectedFile(null); setActiveTab("items"); }}>
                    {cancelText}
                  </button>
                  <button type="submit" className="panel-form__submit" disabled={lostItemUploading}>
                    {lostItemUploading ? "Posting..." : "Post Lost Item"}
                  </button>
                </div>
              </form>
            )}
          </div>
        );

      case "my-items": {
        const myFoundItems = (items ?? []).filter(
          (item) => item.authorId === user?.id && item.status !== "claimed"
        );
        const myLostItems = (lostItems ?? []).filter(
          (item) => item.authorId === user?.id
        );
        const totalCount = myFoundItems.length + myLostItems.length;

        return (
          <>
            <div style={{
              display: "flex", gap: "8px",
              padding: "16px 20px 0",
              borderBottom: "1px solid var(--border-default)",
            }}>
              <button
                onClick={() => setMyItemsTab("found")}
                style={{
                  padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none",
                  cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
                  fontFamily: "Poppins, sans-serif",
                  background: myItemsTab === "found" ? "#f97316" : "var(--bg-page)",
                  color: myItemsTab === "found" ? "#fff" : "var(--text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                Found Items I Posted ({myFoundItems.length})
              </button>
              <button
                onClick={() => setMyItemsTab("lost")}
                style={{
                  padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none",
                  cursor: "pointer", fontWeight: 600, fontSize: "0.9rem",
                  fontFamily: "Poppins, sans-serif",
                  background: myItemsTab === "lost" ? "#f97316" : "var(--bg-page)",
                  color: myItemsTab === "lost" ? "#fff" : "var(--text-muted)",
                  transition: "all 0.15s ease",
                }}
              >
                Lost Items I Reported ({myLostItems.length})
              </button>
            </div>

            <div className="main-panel-content">
              <div className="main-panel-section-title">My Items</div>

              {totalCount === 0 && (
                <p className="panel-empty">You haven't posted any items yet.</p>
              )}

              {myItemsTab === "found" && (
                <>
                  {myFoundItems.length === 0 ? (
                    <p className="panel-empty">You haven't posted any found items.</p>
                  ) : (
                    <div className="panel-item-list">
                      {myFoundItems.map((item) => (
                        <div key={item.id} className="reported-card">
                          {item.image && (
                            <img src={item.image} alt={item.name} className="reported-card__img" />
                          )}
                          <div className="reported-card__body">
                            <p className="reported-card__name">{item.name}</p>
                            <p className="reported-card__reason">{item.description}</p>
                            <p className="reported-card__meta">
                              Status:{" "}
                              <strong style={{ color: item.status === "pending" ? "var(--accent)" : "var(--text-secondary)" }}>
                                {item.status === "pending" ? "Claim pending confirmation" : "Waiting to be claimed"}
                              </strong>
                            </p>
                          </div>
                          <div className="reported-card__actions">
                            {item.status === "pending" && (
                              <button
                                className="confirm-button"
                                style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                                onClick={() => handleConfirmClaimed(item.id)}
                              >
                                Confirm Claimed
                              </button>
                            )}
                            <button
                              className="reported-card__delete"
                              onClick={() => handleDelete(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}

              {myItemsTab === "lost" && (
                <>
                  {myLostItems.length === 0 ? (
                    <p className="panel-empty">You haven't reported any lost items.</p>
                  ) : (
                    <div className="panel-item-list">
                      {myLostItems.map((item) => (
                        <div key={item.id} className="reported-card">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="reported-card__img" />
                          ) : (
                            <div className="reported-card__img" style={{
                              display: "flex", alignItems: "center", justifyContent: "center",
                              background: "var(--bg-input)", color: "var(--text-muted)",
                              fontSize: "1.5rem", flexShrink: 0,
                            }}>?</div>
                          )}
                          <div className="reported-card__body">
                            <p className="reported-card__name">{item.name}</p>
                            <p className="reported-card__reason">{item.description}</p>
                            <p className="reported-card__meta">
                              Status: <strong style={{ color: "var(--text-secondary)" }}>Still looking</strong>
                            </p>
                          </div>
                          <div className="reported-card__actions">
                            <button
                              className="confirm-button"
                              style={{ fontSize: "0.8rem", padding: "6px 12px" }}
                              onClick={() => handleMarkFound(item.id)}
                            >
                              Mark as Found
                            </button>
                            <button
                              className="reported-card__delete"
                              onClick={() => handleDeleteLostItem(item.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        );
      }

      case "become-admin":
        return <AdminPanel />;

      case "admin-login":
        return <AdminLoginPanel onUnlock={() => setIsAdmin(true)} />;

      case "reports":
        return isAdmin ? (
          <>
            <div style={{
              display: "flex", gap: "8px",
              padding: "16px 20px 0",
              borderBottom: "1px solid var(--border-default)",
            }}>
              <button onClick={() => setReportsTab("items")} style={{ padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", fontFamily: "Poppins, sans-serif", background: reportsTab === "items" ? "var(--danger)" : "var(--bg-page)", color: reportsTab === "items" ? "#fff" : "var(--text-muted)", transition: "all 0.15s ease" }}>
                Reported Items
              </button>
              <button onClick={() => setReportsTab("users")} style={{ padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", fontFamily: "Poppins, sans-serif", background: reportsTab === "users" ? "var(--danger)" : "var(--bg-page)", color: reportsTab === "users" ? "#fff" : "var(--text-muted)", transition: "all 0.15s ease" }}>
                Reported Users
              </button>
            </div>
            <div className="main-panel-content" style={{ maxWidth: "720px" }}>
              <div className="main-panel-section-title">
                {reportsTab === "items" ? "Reported Items" : "Reported Users"}
              </div>
              {reportsTab === "items" && <ReportedItemsPanel updateItemStatus={updateItemStatus} />}
              {reportsTab === "users" && <ReportedUsersPanel adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""} />}
            </div>
          </>
        ) : null;

      case "ban-management":
        return isAdmin ? <BanManagementPanel adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""} /> : null;

      case "inbox":
        return isAdmin ? (
          <AdminInboxPanel
            adminId={adminId}
            adminName={adminName}
            adminEmail={user?.primaryEmailAddress?.emailAddress ?? ""}
          />
        ) : null;

      default:
        return null;
    }
  };

  if (!isLoaded || !banChecked || !isReady) return <LoadingSpinner />;

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="sidebar-tabs">
          {SIDEBAR_TABS.filter((tab) => !tab.adminOnly || isAdmin).map((tab) => (
            <button key={tab.id}
              className={`sidebar-tab${activeTab === tab.id ? " sidebar-tab--active" : ""}`}
              onClick={() => setActiveTab(tab.id)}>
              <span className="sidebar-tab__icon">{tab.icon}</span>
              <span className="sidebar-tab__label">{tab.label}</span>
              {activeTab === tab.id && <span className="sidebar-tab__pip" />}
            </button>
          ))}
        </div>
      </aside>

      <main className="dashboard-main">
        {isAdmin && (
          <div className="admin-banner">
            <span className="admin-banner__icon">*</span>
            <span>Admin mode active — you can delete items and ban users</span>
            <button className="admin-banner__exit"
              onClick={() => {
                setIsAdmin(false);
                localStorage.removeItem("findr_is_admin");
                localStorage.removeItem("findr_admin_id");
                localStorage.removeItem("findr_admin_name");
              }}>
              Exit Admin
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
                placeholder="Search items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button className="panel-search__clear" onClick={() => setSearchQuery("")}>×</button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", padding: "16px 20px 0", borderBottom: "1px solid var(--border-default)" }}>
              <button onClick={() => setBoardTab("found")} style={{ padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", fontFamily: "Poppins, sans-serif", background: boardTab === "found" ? "#f97316" : "var(--bg-page)", color: boardTab === "found" ? "#fff" : "var(--text-muted)", transition: "all 0.15s ease" }}>
                Found Items ({filteredItems.filter((i) => i.status !== "claimed").length})
              </button>
              <button onClick={() => setBoardTab("lost")} style={{ padding: "8px 20px", borderRadius: "8px 8px 0 0", border: "none", cursor: "pointer", fontWeight: 600, fontSize: "0.9rem", fontFamily: "Poppins, sans-serif", background: boardTab === "lost" ? "#f97316" : "var(--bg-page)", color: boardTab === "lost" ? "#fff" : "var(--text-muted)", transition: "all 0.15s ease" }}>
                Lost Items ({filteredLostItems.length})
              </button>
            </div>

            {boardTab === "found" && (
              <div className="items-container">
                {filteredItems.filter((i) => i.status !== "claimed").map((item) => {
                  const currentStatus = item.status || "waiting";
                  const isItemOwner = user?.id === item.authorId;
                  return (
                    <div key={item.id} id={`item-${item.id}`} className={`item-card${isAdmin ? " item-card--admin" : ""}`}>
                      <button className="report-flag" onClick={() => setReportingItem(item)}>
                        <FaFlag />
                        <span className="report-flag__tooltip">Report</span>
                      </button>
                      <div className="item-image-wrapper">
                        <img className="item-image" src={item.image} alt={item.name} />
                      </div>
                      <div className="item-info">
                        <h3>{item.name}</h3>
                        <div className="posted-by">
                          {item.authorAvatar && <img src={item.authorAvatar} alt="User" className="posted-by__avatar" />}
                          <span>{foundByText} {item.authorName || "Anonymous"}</span>
                        </div>
                        <p>{item.description}</p>
                      </div>
                      <div className="button-group">
                        {currentStatus === "waiting" && !isItemOwner && (
                          <button className="retrieve-button" onClick={() => handleRetrieve(item)}>{retrieveText}</button>
                        )}
                        {currentStatus === "pending" && (
                          isItemOwner ? (
                            <button className="confirm-button" onClick={() => handleConfirmClaimed(item.id)}>{confirmText}</button>
                          ) : (
                            <button className="pending-button" disabled>{pendingText}</button>
                          )
                        )}
                        {!isItemOwner && (
                          <button className="message-finder-button" onClick={() => handleOpenChat(item)}>Message Finder</button>
                        )}
                        {isAdmin && (
                          <button className="delete-button" onClick={() => handleDelete(item.id)}>Delete Item</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredItems.filter((i) => i.status !== "claimed").length === 0 && (
                  <div className="empty-state">
                    <p>{searchQuery ? `No items found for "${searchQuery}"` : "No found items posted yet."}</p>
                    {searchQuery && <p>Try different keywords like color, type, or brand</p>}
                  </div>
                )}
              </div>
            )}

            {boardTab === "lost" && (
              <div className="items-container">
                {filteredLostItems.map((item) => {
                  const isItemOwner = user?.id === item.authorId;
                  return (
                    <div key={item.id} id={`lost-item-${item.id}`} className={`item-card${isAdmin ? " item-card--admin" : ""}`}>
                      <button className="report-flag" onClick={() => setReportingItem({ ...item, image: item.image || "" })}>
                        <FaFlag />
                        <span className="report-flag__tooltip">Report</span>
                      </button>
                      <div className="item-image-wrapper">
                        {item.image ? (
                          <img className="item-image" src={item.image} alt={item.name} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg-input)", color: "var(--text-muted)", fontSize: "2rem", fontFamily: "Poppins, sans-serif" }}>?</div>
                        )}
                      </div>
                      <div className="item-info">
                        <h3>{item.name}</h3>
                        <div className="posted-by">
                          {item.authorAvatar && <img src={item.authorAvatar} alt="User" className="posted-by__avatar" />}
                          <span>Lost by: {item.authorName || "Anonymous"}</span>
                        </div>
                        <p>{item.description}</p>
                      </div>
                      <div className="button-group">
                        {!isItemOwner && (
                          <button className="retrieve-button" style={{ background: "#f97316" }} onClick={() => handleOpenChat(item, true)}>
                            I Found This!
                          </button>
                        )}
                        {isItemOwner && (
                          <button className="confirm-button" onClick={() => handleMarkFound(item.id)}>
                            Mark as Found
                          </button>
                        )}
                        {!isItemOwner && (
                          <button className="message-finder-button" onClick={() => handleOpenChat(item, true)}>
                            Message Owner
                          </button>
                        )}
                        {isAdmin && (
                          <button className="delete-button" onClick={() => handleDeleteLostItem(item.id)}>Delete</button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {filteredLostItems.length === 0 && (
                  <div className="empty-state">
                    <p>{searchQuery ? `No lost items found for "${searchQuery}"` : "No lost item reports yet."}</p>
                    <p>Click "Report Lost Item" in the sidebar to post what you lost.</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {reportingItem && user && (
          <ReportModal
            item={reportingItem}
            currentUser={{ uid: user.id, displayName: user.fullName || "Me", email: user.primaryEmailAddress?.emailAddress || "" }}
            onClose={() => setReportingItem(null)}
            onSubmitted={() => setReportingItem(null)}
          />
        )}

        {activeChat && user && (
          <ChatModal
            conversationId={activeChat.conversationId}
            item={activeChat.item}
            currentUser={{ uid: user.id, displayName: user.fullName || "Me" }}
            otherUser={activeChat.otherUser}
            onClose={() => setActiveChat(null)}
          />
        )}
      </main>
    </div>
  );
}