"use client";

import "./messages.css";
import { useEffect, useState, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";
import { FaFlag, FaShieldHalved } from "react-icons/fa6";
import LoadingSpinner from "@/app/components/LoadingSpinner";


interface Message {
  id: number;
  conversation_id: string;
  sender_id: string;
  sender_name: string;
  receiver_id: string;
  receiver_name: string;
  item_id: string;
  item_title: string;
  text: string;
  created_at: string;
  read: boolean;
}

interface Conversation {
  conversation_id: string;
  item_title: string;
  otherUserId: string;
  otherUserName: string;
  otherUserEmail: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
  isAdminConv?: boolean;
}

interface Admin {
  id: string;
  email: string;
  name: string | null;
}

const USER_REPORT_REASONS = [
  "Harassment or threats",
  "Spam or scam",
  "Fake or misleading identity",
  "Inappropriate messages",
  "Other",
];

async function t(text: string, language: string): Promise<string> {
  if (language === "en") return text;
  const cacheKey = `msg_ui_${language}_${text.slice(0, 40)}`;
  const cached = localStorage.getItem(cacheKey);
  if (cached) return cached;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: language }),
    });
    if (res.ok) {
      const data = await res.json();
      const translated = data.translatedText || text;
      localStorage.setItem(cacheKey, translated);
      return translated;
    }
  } catch { /* keep original */ }
  return text;
}

function ReportUserModal({
  reportedUserId,
  reportedUserName,
  reportedUserEmail,
  currentUser,
  onClose,
}: {
  reportedUserId: string;
  reportedUserName: string;
  reportedUserEmail: string;
  currentUser: { id: string; fullName: string | null; email: string };
  onClose: () => void;
}) {
  const [selectedReason, setSelectedReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (!selectedReason || submitting) return;
    setSubmitting(true);
    await supabase.from("user_reports").insert({
      reporter_id: currentUser.id,
      reporter_name: currentUser.fullName || "Anonymous",
      reporter_email: currentUser.email,
      reported_user_id: reportedUserId,
      reported_user_name: reportedUserName,
      reported_user_email: reportedUserEmail,
      reason: selectedReason,
    });
    setDone(true);
    setSubmitting(false);
    setTimeout(onClose, 1200);
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
            <p className="report-modal__title">Report {reportedUserName}</p>
            <p className="report-modal__subtitle">Why are you reporting this user?</p>
            <div className="report-modal__reasons">
              {USER_REPORT_REASONS.map((reason) => (
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
              <button
                className="report-modal__submit"
                onClick={handleSubmit}
                disabled={!selectedReason || submitting}
              >
                {submitting ? "Submitting..." : "Submit Report"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ContactAdminModal({
  admins,
  loading,
  onSelect,
  onClose,
}: {
  admins: Admin[];
  loading: boolean;
  onSelect: (admin: Admin) => void;
  onClose: () => void;
}) {
  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <p className="report-modal__title">
          <FaShieldHalved className="messages-sidebar__admin-icon" />
          Contact an Admin
        </p>
        <p className="report-modal__subtitle">Select an admin to start a conversation.</p>

        {loading ? (
          <div className="admin-modal-loading">Loading admins…</div>
        ) : admins.length === 0 ? (
          <div className="admin-modal-loading">No admins available right now.</div>
        ) : (
          <div style={{ margin: "12px 0" }}>
            {admins.map((admin) => (
              <button
                key={admin.id}
                className="admin-select-btn"
                onClick={() => onSelect(admin)}
              >
                <div className="admin-select-avatar">
                  {(admin.name || admin.email)[0].toUpperCase()}
                </div>
                <div>
                  <div className="admin-select-name">{admin.name || "Admin"}</div>
                  <div className="admin-select-email">{admin.email}</div>
                </div>
                <div className="admin-select-tag">Admin</div>
              </button>
            ))}
          </div>
        )}

        <div className="report-modal__actions" style={{ marginTop: 4 }}>
          <button className="report-modal__cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

export default function MessagesPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { language } = useSettings();

  const [banChecked, setBanChecked] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reportingUser, setReportingUser] = useState(false);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [isReady, setIsReady] = useState(false);
  const [uiMessagesTitle, setUiMessagesTitle]           = useState("Messages");
  const [uiNoConversations, setUiNoConversations]       = useState("No conversations yet.");
  const [uiSelectConversation, setUiSelectConversation] = useState("Select a conversation to start chatting");
  const [uiStartConversation, setUiStartConversation]   = useState("Start the conversation!");
  const [uiTypePlaceholder, setUiTypePlaceholder]       = useState("Type a message…");

  useEffect(() => {
    const translateUI = async () => {
      setIsReady(false);
      const [
        messagesTitle, noConversations, selectConversation,
        startConversation, typePlaceholder,
      ] = await Promise.all([
        t("Messages", language),
        t("No conversations yet.", language),
        t("Select a conversation to start chatting", language),
        t("Start the conversation!", language),
        t("Type a message…", language),
      ]);
      setUiMessagesTitle(messagesTitle);
      setUiNoConversations(noConversations);
      setUiSelectConversation(selectConversation);
      setUiStartConversation(startConversation);
      setUiTypePlaceholder(typePlaceholder);
      setIsReady(true);
    };
    translateUI();
  }, [language]);

  useEffect(() => {
    if (isLoaded && !user) router.push("/");
  }, [isLoaded, user, router]);

  useEffect(() => {
    if (!user) { setBanChecked(true); return; }
    const checkBan = async () => {
      const { data } = await supabase
        .from("banned_users")
        .select("email, suspended_until")
        .eq("email", user.primaryEmailAddress?.emailAddress)
        .single();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended = data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) { router.push("/banned"); return; }
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user]);

  const handleOpenAdminModal = async () => {
    setShowAdminModal(true);
    setAdminsLoading(true);
    const { data } = await supabase.from("admins").select("id, email, name");
    setAdmins(data ?? []);
    setAdminsLoading(false);
  };

  const handleSelectAdmin = async (admin: Admin) => {
    if (!user) return;
    setShowAdminModal(false);
    const convId = `admin_${[user.id, admin.id].sort().join("_")}`;
    const existing = conversations.find((c) => c.conversation_id === convId);
    if (!existing) {
      setConversations((prev) => [
        {
          conversation_id: convId,
          item_title: "Admin Support",
          otherUserId: admin.id,
          otherUserName: admin.name || "Admin",
          otherUserEmail: admin.email,
          lastMessage: "",
          lastMessageAt: new Date().toISOString(),
          unread: false,
          isAdminConv: true,
        },
        ...prev,
      ]);
    }
    setActiveConvId(convId);
    setReportingUser(false);
  };

  useEffect(() => {
    if (!user) return;

    const fetchConversations = async () => {
      const { data: sent } = await supabase
        .from("chat_messages").select("*")
        .eq("sender_id", user.id).order("created_at", { ascending: false });

      const { data: received } = await supabase
        .from("chat_messages").select("*")
        .eq("receiver_id", user.id).order("created_at", { ascending: false });

      const all = [...(sent ?? []), ...(received ?? [])];
      all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      if (!all.length) return;

      const convMap = new Map<string, Conversation>();
      for (const msg of all) {
        if (!convMap.has(msg.conversation_id)) {
          const isOwn = msg.sender_id === user.id;
          const isAdminConv = msg.conversation_id.startsWith("admin_");
          convMap.set(msg.conversation_id, {
            conversation_id: msg.conversation_id,
            item_title: isAdminConv ? "Admin Support" : msg.item_title,
            otherUserId: isOwn ? msg.receiver_id : msg.sender_id,
            otherUserName: isOwn ? (msg.receiver_name || msg.receiver_id) : msg.sender_name,
            otherUserEmail: isOwn ? (msg.receiver_email || "") : (msg.sender_email || ""),
            lastMessage: msg.text,
            lastMessageAt: msg.created_at,
            unread: !msg.read && msg.receiver_id === user.id,
            isAdminConv,
          });
        }
      }

      const convList = Array.from(convMap.values());
      if (language !== "en") {
        await Promise.all(
          convList.map(async (conv) => {
            const [title, lastMsg] = await Promise.all([
              t(conv.item_title, language),
              t(conv.lastMessage, language),
            ]);
            conv.item_title = title;
            conv.lastMessage = lastMsg;
          })
        );
      }

      setConversations(convList);
    };

    fetchConversations();

    const channel = supabase
      .channel("messages-page-convos")
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `receiver_id=eq.${user.id}`,
      }, () => fetchConversations())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, language]);

  useEffect(() => {
    if (!activeConvId || !user) return;

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("chat_messages").select("*")
        .eq("conversation_id", activeConvId).order("created_at", { ascending: true });

      if (data) {
        if (language !== "en") {
          const translated = await Promise.all(
            data.map(async (msg) => {
              const translatedText = await t(msg.text, language);
              return { ...msg, text: translatedText };
            })
          );
          setMessages(translated);
        } else {
          setMessages(data);
        }
      }

      await supabase.from("chat_messages").update({ read: true })
        .eq("conversation_id", activeConvId).eq("receiver_id", user.id);

      setConversations((prev) =>
        prev.map((c) => c.conversation_id === activeConvId ? { ...c, unread: false } : c)
      );
    };

    fetchMessages();

    const channel = supabase
      .channel(`messages-page-chat:${activeConvId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${activeConvId}`,
      }, async (payload) => {
        const newMsg = payload.new as Message;
        const translatedText = language !== "en" ? await t(newMsg.text, language) : newMsg.text;
        setMessages((prev) => [...prev, { ...newMsg, text: translatedText }]);
        if (newMsg.receiver_id === user.id) {
          supabase.from("chat_messages").update({ read: true }).eq("id", newMsg.id);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeConvId, user, language]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConv = conversations.find((c) => c.conversation_id === activeConvId);

  const handleSend = async () => {
    if (!text.trim() || sending || !activeConv || !user) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");
    await supabase.from("chat_messages").insert({
      conversation_id: activeConvId,
      sender_id: user.id,
      sender_name: user.fullName || "Me",
      sender_email: user.primaryEmailAddress?.emailAddress || "",
      receiver_id: activeConv.otherUserId,
      receiver_name: activeConv.otherUserName,
      receiver_email: activeConv.otherUserEmail,
      item_id: activeConv.isAdminConv ? "admin-support" : activeConv.conversation_id.split("_")[0],
      item_title: activeConv.isAdminConv ? "Admin Support" : activeConv.item_title,
      text: trimmed,
      read: false,
    });
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Close chat pane on mobile and return to sidebar
  const handleBack = () => {
    setActiveConvId(null);
    setReportingUser(false);
  };

if (!banChecked || !isLoaded || !user || !isReady) return <LoadingSpinner />;

  return (
    <div className="messages-layout">

      {/* ── Sidebar ── */}
      <div className="messages-sidebar">
        <div className="messages-sidebar__header">
          <h2 className="messages-sidebar__title">{uiMessagesTitle}</h2>
        </div>

        <div className="messages-sidebar__admin-btn-wrap">
          <button className="messages-sidebar__admin-btn" onClick={handleOpenAdminModal}>
            <FaShieldHalved className="messages-sidebar__admin-icon" />
            Contact an Admin
          </button>
        </div>

        <div
          className="messages-sidebar__list"
          aria-live="polite"
          aria-relevant="additions"
          role="log"
        >
          {conversations.length === 0 && (
            <div className="messages-sidebar__empty">
              <div className="messages-sidebar__empty-icon">💬</div>
              {uiNoConversations}
            </div>
          )}
          {conversations.map((conv) => (
            <button
              key={conv.conversation_id}
              className={`messages-conv-row${activeConvId === conv.conversation_id ? " messages-conv-row--active" : ""}`}
              onClick={() => { setActiveConvId(conv.conversation_id); setReportingUser(false); }}
            >
              <div className={`messages-conv-avatar${conv.isAdminConv ? " messages-conv-avatar--admin" : ""}`}>
                {conv.isAdminConv
                  ? <FaShieldHalved style={{ fontSize: 14 }} />
                  : (conv.otherUserName?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div className="messages-conv-info">
                <div className="messages-conv-top">
                  <span className={`messages-conv-name${conv.unread ? " messages-conv-name--unread" : ""}`}>
                    {conv.otherUserName}
                    {conv.isAdminConv && (
                      <span className="messages-conv-admin-badge">Admin</span>
                    )}
                  </span>
                  {conv.unread && <span className="messages-conv-unread-dot" />}
                </div>
                <div className="messages-conv-item">{conv.item_title}</div>
                <div className={`messages-conv-preview${conv.unread ? " messages-conv-preview--unread" : ""}`}>
                  {conv.lastMessage || "Start the conversation"}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* ── Chat area ──
          On mobile: slides over sidebar when activeConvId is set (.messages-chat--open)
      ── */}
      <div className={`messages-chat${activeConvId ? " messages-chat--open" : ""}`}>
        {!activeConvId ? (
          <div className="messages-chat__empty">
            <div className="messages-chat__empty-icon">💬</div>
            <p>{uiSelectConversation}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="messages-chat__header">
              {/* Back button — only visible on mobile via CSS */}
              <button className="messages-chat__back" onClick={handleBack} aria-label="Back to conversations">
                ←
              </button>

              <div className={`messages-conv-avatar${activeConv?.isAdminConv ? " messages-conv-avatar--admin" : ""}`}>
                {activeConv?.isAdminConv
                  ? <FaShieldHalved style={{ fontSize: 14 }} />
                  : (activeConv?.otherUserName?.[0]?.toUpperCase() ?? "?")}
              </div>
              <div className="messages-chat__header-info">
                <div className="messages-chat__header-name">
                  {activeConv?.otherUserName}
                  {activeConv?.isAdminConv && (
                    <span className="messages-chat__header-badge">Admin</span>
                  )}
                </div>
                <div className="messages-chat__header-sub">{activeConv?.item_title}</div>
              </div>
              {!activeConv?.isAdminConv && (
                <button className="msg-report-btn" onClick={() => setReportingUser(true)}>
                  <FaFlag style={{ fontSize: 11 }} />
                  Report User
                </button>
              )}
            </div>

            {/* Bubbles */}
            <div className="messages-chat__bubbles">
              {messages.length === 0 && (
                <div className="messages-chat__conv-empty">
                  {activeConv?.isAdminConv ? (
                    <>
                      <FaShieldHalved className="messages-chat__admin-empty-icon" />
                      <p>You're chatting with an admin. Ask anything — they're here to help.</p>
                    </>
                  ) : (
                    <>
                      <span style={{ fontSize: 32 }}>👋</span>
                      <p>{uiStartConversation}</p>
                    </>
                  )}
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                const time = new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit", minute: "2-digit",
                });
                return (
                  <div
                    key={msg.id}
                    className={`msg-row${isOwn ? " msg-row--own" : " msg-row--other"}`}
                  >
                    <div className={`msg-bubble${isOwn ? " msg-bubble--own" : " msg-bubble--other"}`}>
                      {msg.text}
                    </div>
                    <span className="msg-time">{time}</span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="messages-chat__input-row">
              <textarea
                rows={1}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={uiTypePlaceholder}
                className="messages-chat__textarea"
              />
              <button
                onClick={handleSend}
                disabled={!text.trim() || sending}
                className={`messages-chat__send${text.trim() ? " messages-chat__send--active" : " messages-chat__send--inactive"}`}
              >
                ↑
              </button>
            </div>
          </>
        )}
      </div>

      {/* Report User Modal */}
      {reportingUser && activeConv && user && (
        <ReportUserModal
          reportedUserId={activeConv.otherUserId}
          reportedUserName={activeConv.otherUserName}
          reportedUserEmail={activeConv.otherUserEmail}
          currentUser={{
            id: user.id,
            fullName: user.fullName,
            email: user.primaryEmailAddress?.emailAddress || "",
          }}
          onClose={() => setReportingUser(false)}
        />
      )}

      {/* Contact Admin Modal */}
      {showAdminModal && (
        <ContactAdminModal
          admins={admins}
          loading={adminsLoading}
          onSelect={handleSelectAdmin}
          onClose={() => setShowAdminModal(false)}
        />
      )}
    </div>
  );
}