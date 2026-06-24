"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useSettings } from "@/context/SettingsContext";
import { FaArrowLeft, FaCalendar, FaMapPin, FaTag, FaMessage, FaTrash } from "react-icons/fa6";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import "@/app/school-items/[id]/school-item-detail.css";

// ── strings ────────────────────────────────────────────────────────────────────
interface SLostStrings {
  itemNotFound: string; backBtn: string; back: string; schoolItems: string;
  schoolLostItem: string; lostBy: string; lostDate: string; lostLocation: string;
  description: string; deleteBtn: string; markFoundBtn: string; messageOwner: string;
  stillLooking: string; noImage: string; similarItems: string; noSimilarItems: string;
  cancel: string; viewItem: string; loading: string;
}

const DEFAULT_SLOST: SLostStrings = {
  itemNotFound: "Item not found.", backBtn: "← Back", back: "Back",
  schoolItems: "School Items", schoolLostItem: "School Lost Item",
  lostBy: "Lost by", lostDate: "Lost", lostLocation: "Last seen",
  description: "Description", deleteBtn: "Delete Report",
  markFoundBtn: "Mark as Found", messageOwner: "Message Owner",
  stillLooking: "Still Looking", noImage: "No image",
  similarItems: "Similar items", noSimilarItems: "No similar items",
  cancel: "Cancel", viewItem: "View Item", loading: "Loading...",
};

async function translateSLost(language: string): Promise<SLostStrings> {
  if (language === "en") return DEFAULT_SLOST;
  const pairs: [keyof SLostStrings, string][] = [
    ["itemNotFound", "Item not found."], ["backBtn", "← Back"], ["back", "Back"],
    ["schoolItems", "School Items"], ["schoolLostItem", "School Lost Item"],
    ["lostBy", "Lost by"], ["lostDate", "Lost"], ["lostLocation", "Last seen"],
    ["description", "Description"], ["deleteBtn", "Delete Report"],
    ["markFoundBtn", "Mark as Found"], ["messageOwner", "Message Owner"],
    ["stillLooking", "Still Looking"], ["noImage", "No image"],
    ["similarItems", "Similar items"], ["noSimilarItems", "No similar items"],
    ["cancel", "Cancel"], ["viewItem", "View Item"], ["loading", "Loading..."],
  ];
  const result = { ...DEFAULT_SLOST };
  await Promise.all(pairs.map(async ([field, text]) => {
    const cacheKey = `sl_${field}_${language}`;
    const cached = localStorage.getItem(cacheKey);
    if (cached) { result[field] = cached; return; }
    try {
      const res = await fetch("/api/translate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: language }),
      });
      if (res.ok) {
        const data = await res.json();
        const t = (data.translatedText as string | undefined)?.trim() || text;
        result[field] = t;
        localStorage.setItem(cacheKey, t);
      }
    } catch {}
  }));
  return result;
}

// ── helpers ────────────────────────────────────────────────────────────────────
function normalizeImages(imageData: any): string[] {
  if (Array.isArray(imageData)) return imageData.filter((u) => u && typeof u === "string");
  if (typeof imageData === "string" && imageData) return [imageData];
  return [];
}

interface ChatMessage {
  id: number; conversation_id: string; sender_id: string; sender_name: string;
  receiver_id: string; item_id: string; item_title: string; text: string; created_at: string;
}

// ── page ───────────────────────────────────────────────────────────────────────
export default function SchoolLostItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { language } = useSettings();

  const [s, setS] = useState<SLostStrings>(DEFAULT_SLOST);
  const [isReady, setIsReady] = useState(false);
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // chat state
  const [activeChatPartnerId, setActiveChatPartnerId] = useState<string | null>(null);
  const [activeChatPartnerName, setActiveChatPartnerName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [translatedCategory, setTranslatedCategory] = useState<string>("");
  const [translatedName, setTranslatedName] = useState<string>("");
  const [translatedDescription, setTranslatedDescription] = useState<string>("");
  const [translatedLocation, setTranslatedLocation] = useState<string>("");

  // translations
  useEffect(() => {
    translateSLost(language).then((r) => { setS(r); setIsReady(true); });
  }, [language]);

  // translate user content (name, description, location, category) when item loads
  useEffect(() => {
    if (!item) return;
    if (language === "en") {
      setTranslatedName(item.name || "");
      setTranslatedDescription(item.description || "");
      setTranslatedLocation(item.location || "");
      setTranslatedCategory(item.category || "");
      return;
    }
    const tx = async (text: string, field: string, prefix: string) => {
      if (!text) return text;
      const cacheKey = `${prefix}_${item.id}_${field}_${language}`;
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
    const catKey = item.category ? `sc_cat_${item.category.replace(/\s+/g, "_")}_${language}` : "";
    const cachedCat = catKey ? localStorage.getItem(catKey) : null;
    Promise.all([
      tx(item.name, "name", "sl_c"),
      tx(item.description, "desc", "sl_c"),
      tx(item.location, "loc", "sl_c"),
      cachedCat ? Promise.resolve(cachedCat) : (item.category ? tx(item.category, "cat", "sl_c").then((t) => { if (catKey) localStorage.setItem(catKey, t); return t; }) : Promise.resolve("")),
    ]).then(([name, desc, loc, cat]) => {
      setTranslatedName(name);
      setTranslatedDescription(desc);
      setTranslatedLocation(loc);
      setTranslatedCategory(cat);
    });
  }, [item, language]); // eslint-disable-line react-hooks/exhaustive-deps

  // fetch item
  useEffect(() => {
    if (!isLoaded) return;
    const idNum = parseInt(id, 10);
    supabase.from("school_lost_items").select("*").eq("id", idNum).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const imgs = normalizeImages(data.image_urls || data.image_url);
          setItem({
            id: data.id, name: data.name, description: data.description,
            image: imgs[0] || "", images: imgs,
            authorName: data.author_name, authorAvatar: data.author_avatar,
            authorId: data.author_id, authorEmail: data.author_email,
            status: data.status ?? "looking",
            category: data.category ?? null, location: data.location ?? null,
            created_at: data.created_at, school_id: data.school_id,
          });
        }
        setLoading(false);
      });
  }, [id, isLoaded]);

  // chat subscription
  const conversationId = item && user && activeChatPartnerId
    ? `conv_${[user.id, activeChatPartnerId].sort().join("_")}`
    : "";

  useEffect(() => {
    if (!activeChatPartnerId || !conversationId) return;
    supabase.from("chat_messages").select("*").eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .then(({ data }) => { if (data) setMessages(data as ChatMessage[]); });

    const ch = supabase.channel(`chat:${conversationId}:${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => setMessages((prev) => prev.some((m) => m.id === (payload.new as ChatMessage).id) ? prev : [...prev, payload.new as ChatMessage]))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [activeChatPartnerId, conversationId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const openChatWith = (partnerId: string, partnerName: string) => {
    setActiveChatPartnerId(partnerId); setActiveChatPartnerName(partnerName); setMessages([]);
  };
  const closeChat = () => {
    setActiveChatPartnerId(null); setActiveChatPartnerName(""); setMessages([]); setChatText("");
  };

  const handleSendChat = async () => {
    if (!chatText.trim() || chatSending || !user || !item || !activeChatPartnerId) return;
    setChatSending(true);
    const trimmed = chatText.trim();
    setChatText("");
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId, sender_id: user.id,
      sender_name: user.fullName || "Me",
      sender_email: user.primaryEmailAddress?.emailAddress || "",
      receiver_id: activeChatPartnerId, receiver_name: activeChatPartnerName,
      receiver_email: "", item_id: String(item.id), item_title: item.name,
      text: trimmed, read: false,
    });
    setChatSending(false);
  };

  const handleDelete = async () => {
    if (!item || !confirm("Delete this lost item report?")) return;
    setActionLoading(true);
    await supabase.from("school_lost_items").delete().eq("id", item.id);
    router.back();
    setActionLoading(false);
  };

  const handleMarkFound = async () => {
    if (!item) return;
    setActionLoading(true);
    await supabase.from("school_lost_items").delete().eq("id", item.id);
    router.back();
    setActionLoading(false);
  };

  if (!isLoaded || loading || !isReady) return <LoadingSpinner />;
  if (!item) return (
    <div className="detail-not-found">
      <p>{s.itemNotFound}</p>
      <button onClick={() => router.back()} className="detail-back-btn">{s.backBtn}</button>
    </div>
  );

  const isOwner = user?.id === item.authorId;
  const dateLabel = item.created_at
    ? new Date(item.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="detail-page">
      {/* Breadcrumb */}
      <div className="detail-breadcrumb" style={{ marginLeft: 0, alignSelf: "flex-start" }}>
        <button className="detail-back-btn" onClick={() => router.back()}>
          <FaArrowLeft /><span>{s.back}</span>
        </button>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__label">{s.schoolItems}</span>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__current">{translatedName || item.name}</span>
      </div>

      <div className="detail-layout">
        {/* LEFT: Image */}
        <div className="detail-image-col">
          {item.image ? (
            <img src={item.image} alt={item.name} style={{ width: "100%", borderRadius: 16, objectFit: "cover", aspectRatio: "4/3", display: "block" }} />
          ) : (
            <div style={{ width: "100%", aspectRatio: "4/3", borderRadius: 16, background: "var(--bg-input)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontFamily: "var(--font-body)", fontSize: 14 }}>
              {s.noImage}
            </div>
          )}
          <div className="detail-status-badge detail-status-badge--waiting" style={{ background: "var(--danger)", color: "#fff" }}>
            {s.stillLooking}
          </div>
        </div>

        {/* RIGHT: Info + Actions */}
        <div className="detail-info-col">
          <div className="detail-type-pill" style={{ background: "rgba(239,68,68,0.12)", color: "var(--danger)", border: "1px solid rgba(239,68,68,0.3)" }}>
            {s.schoolLostItem}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <h1 className="detail-title">{translatedName || item.name}</h1>
            {isOwner && (
              <button className="detail-secondary-btn detail-secondary-btn--danger" onClick={handleDelete} disabled={actionLoading}>
                <FaTrash style={{ marginRight: 6 }} />{s.deleteBtn}
              </button>
            )}
          </div>

          {/* Lost by */}
          <div className="detail-poster">
            {item.authorAvatar && (
              <img src={item.authorAvatar} alt={item.authorName} className="detail-poster__avatar" />
            )}
            <div className="detail-poster__info">
              <span className="detail-poster__label">{s.lostBy}</span>
              <span className="detail-poster__name">{item.authorName || "Anonymous"}</span>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Meta chips */}
          <div className="detail-meta-row">
            {dateLabel && (
              <div className="detail-meta-chip">
                <FaCalendar className="detail-meta-chip__icon" />
                <span>{s.lostDate} {dateLabel}</span>
              </div>
            )}
            {item.location && (
              <div className="detail-meta-chip">
                <FaMapPin className="detail-meta-chip__icon" />
                <span>{translatedLocation || item.location}</span>
              </div>
            )}
            {item.category && (
              <div className="detail-meta-chip">
                <FaTag className="detail-meta-chip__icon" />
                <span>{translatedCategory || item.category}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="detail-description-box">
            <p className="detail-description-label">{s.description}</p>
            <p className="detail-description-text">{translatedDescription || item.description}</p>
          </div>

          {/* Actions */}
          <div className="detail-actions">
            {isOwner ? (
              <button className="detail-btn detail-btn--success" onClick={handleMarkFound} disabled={actionLoading}>
                {actionLoading ? "..." : s.markFoundBtn}
              </button>
            ) : (
              <button className="detail-btn detail-btn--secondary" onClick={() => openChatWith(item.authorId, item.authorName || "Owner")}>
                <FaMessage style={{ marginRight: 8 }} />{s.messageOwner}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── CHAT PANEL ── */}
      {activeChatPartnerId && user && (
        <div className="detail-overlay" onClick={closeChat}>
          <div className="detail-chat" onClick={(e) => e.stopPropagation()}>
            <div className="detail-chat__header">
              <div className="chat-modal__avatar">{activeChatPartnerName?.[0]?.toUpperCase() ?? "?"}</div>
              <div className="chat-modal__header-info">
                <div className="chat-modal__name">{activeChatPartnerName}</div>
                <div className="chat-modal__item">{item.name}</div>
              </div>
              <button className="chat-modal__close" onClick={closeChat}>×</button>
            </div>
            <div className="chat-modal__messages">
              {item && (
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", background: "var(--bg-input)", borderRadius: 10, margin: "8px 12px", border: "1px solid var(--border-default)" }}>
                  {item.image && <img src={item.image} alt={item.name} style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />}
                  <p style={{ fontFamily: "var(--font-body)", fontWeight: 700, fontSize: 13, color: "var(--text-primary)", margin: 0, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {item.name}
                  </p>
                  <a href={`/school-lost-items/${item.id}`} target="_blank" rel="noreferrer" style={{ background: "var(--accent)", color: "#fff", fontSize: 11, padding: "3px 10px", borderRadius: 100, textDecoration: "none", fontWeight: 600, fontFamily: "var(--font-body)", whiteSpace: "nowrap", flexShrink: 0 }}>
                    {s.viewItem}
                  </a>
                </div>
              )}
              {messages.length === 0 && (
                <div className="chat-modal__empty">
                  <p>Say hi about <strong>{item.name}</strong></p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
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
            {messages.length === 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", padding: "8px 12px", borderTop: "1px solid var(--border-default)" }}>
                {[
                  "Hi! I think I may have found your item!",
                  "Can you describe it in more detail?",
                  "Where did you last see it?",
                  "Is this still missing?",
                ].map((template) => (
                  <button
                    key={template}
                    onClick={() => setChatText(template)}
                    style={{ padding: "6px 12px", borderRadius: "100px", border: "1.5px solid var(--border-input)", background: "var(--bg-input)", color: "var(--text-secondary)", fontFamily: "var(--font-body)", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "all 0.15s ease", whiteSpace: "nowrap" }}
                    onMouseEnter={(e) => { (e.target as HTMLButtonElement).style.borderColor = "var(--accent)"; (e.target as HTMLButtonElement).style.color = "var(--accent)"; }}
                    onMouseLeave={(e) => { (e.target as HTMLButtonElement).style.borderColor = "var(--border-input)"; (e.target as HTMLButtonElement).style.color = "var(--text-secondary)"; }}
                  >
                    {template}
                  </button>
                ))}
              </div>
            )}
            <div className="chat-modal__input-row">
              <textarea
                rows={1} value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Type a message..."
                className="chat-modal__textarea"
              />
              <button onClick={handleSendChat} disabled={!chatText.trim() || chatSending}
                className={`chat-modal__send${chatText.trim() ? " chat-modal__send--active" : ""}`}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
