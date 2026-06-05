"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { FaArrowLeft, FaCalendar, FaTrash } from "react-icons/fa6";
import ImageGallery from "@/app/components/ImageGallery";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import "./school-item-detail.css";

function normalizeImages(imageData: any): string[] {
  if (Array.isArray(imageData)) return imageData.filter((u) => u && typeof u === "string");
  if (typeof imageData === "string" && imageData) return [imageData];
  return [];
}

export default function SchoolItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [item, setItem] = useState<any>(null);
  const [isLost, setIsLost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchItem = async () => {
      const rawId = id;
      // IDs are stored as integers in DB
      const numId = parseInt(rawId, 10);

      const { data: foundData } = await supabase
        .from("school_items")
        .select("*")
        .eq("id", numId)
        .maybeSingle();

      if (foundData) {
        const imgs = normalizeImages(foundData.image_urls || foundData.image_url);
        setItem({
          id: foundData.id,
          schoolId: foundData.school_id,
          name: foundData.name,
          description: foundData.description,
          image: imgs[0] || "",
          images: imgs,
          authorName: foundData.author_name,
          authorAvatar: foundData.author_avatar,
          authorId: foundData.author_id,
          authorEmail: foundData.author_email,
          status: foundData.status,
          date_found: foundData.date_found || foundData.created_at,
          created_at: foundData.created_at,
        });
        setIsLost(false);
        setLoading(false);
        return;
      }

      const { data: lostData } = await supabase
        .from("school_lost_items")
        .select("*")
        .eq("id", numId)
        .maybeSingle();

      if (lostData) {
        const imgs = normalizeImages(lostData.image_urls || lostData.image_url);
        setItem({
          id: lostData.id,
          schoolId: lostData.school_id,
          name: lostData.name,
          description: lostData.description,
          image: imgs[0] || "",
          images: imgs,
          authorName: lostData.author_name,
          authorAvatar: lostData.author_avatar,
          authorId: lostData.author_id,
          authorEmail: lostData.author_email,
          status: lostData.status,
          date_found: lostData.created_at,
          created_at: lostData.created_at,
        });
        setIsLost(true);
      }

      setLoading(false);
    };

    if (isLoaded) fetchItem();
  }, [id, isLoaded]);

  // Chat subscription
  const conversationId = item && user
    ? `school_${item.schoolId}_item_${item.id}${isLost ? "_lost" : ""}_${[user.id, item.authorId].sort().join("_")}`
    : "";

  useEffect(() => {
    if (!showChat || !item || !user || !conversationId) return;

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMsgs();

    const channel = supabase
      .channel(`chat:${conversationId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${conversationId}`,
      }, (payload) =>
        setMessages((prev) =>
          prev.some((m) => m.id === (payload.new as any).id)
            ? prev : [...prev, payload.new]
        )
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [showChat, item, user, conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleDeleteFound = async () => {
    if (!item || !confirm("Delete this item permanently?")) return;
    setActionLoading(true);
    await supabase.from("school_items").delete().eq("id", item.id);
    router.back();
  };

  const handleDeleteLost = async () => {
    if (!item || !confirm("Delete this lost item?")) return;
    setActionLoading(true);
    await supabase.from("school_lost_items").delete().eq("id", item.id);
    router.back();
  };

  const handleMarkClaimed = async () => {
    if (!item) return;
    setActionLoading(true);
    await supabase.from("school_items").delete().eq("id", item.id);
    setActionMsg("Item marked as claimed!");
    setTimeout(() => router.back(), 1200);
    setActionLoading(false);
  };

  const handleMarkFound = async () => {
    if (!item) return;
    setActionLoading(true);
    await supabase.from("school_lost_items").delete().eq("id", item.id);
    setActionMsg("Marked as found!");
    setTimeout(() => router.back(), 1200);
    setActionLoading(false);
  };

  const handleSendChat = async () => {
    if (!chatText.trim() || chatSending || !user || !item || !conversationId) return;
    setChatSending(true);
    const trimmed = chatText.trim();
    setChatText("");
    setMessages((prev) => [...prev, {
      id: Date.now(), conversation_id: conversationId,
      sender_id: user.id, sender_name: user.fullName || "Me",
      receiver_id: item.authorId, item_id: String(item.id),
      item_title: item.name, text: trimmed, created_at: new Date().toISOString(),
    }]);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id, sender_name: user.fullName || "Me",
      receiver_id: item.authorId, receiver_name: item.authorName,
      item_id: String(item.id), item_title: item.name, text: trimmed, read: false,
    });
    setChatSending(false);
  };

  if (!isLoaded || loading) return <LoadingSpinner />;
  if (!item) return (
    <div className="sid-not-found">
      <p>Item not found.</p>
      <button onClick={() => router.back()} className="sid-back-btn">← Back</button>
    </div>
  );

  const isItemOwner = user?.id === item.authorId;
  const currentStatus = item.status || "waiting";
  const dateLabel = item.date_found
    ? new Date(item.date_found).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
    : null;

  return (
    <div className="sid-page">
      <div className="sid-breadcrumb">
        <button className="sid-back-btn" onClick={() => router.back()}>
          <FaArrowLeft />
          <span>Back to Board</span>
        </button>
        <span className="sid-breadcrumb__sep">/</span>
        <span className="sid-breadcrumb__label">{isLost ? "Lost Items" : "Found Items"}</span>
        <span className="sid-breadcrumb__sep">/</span>
        <span className="sid-breadcrumb__current">{item.name}</span>
      </div>

      <div className="sid-layout">
        {/* LEFT: Image */}
        <div className="sid-image-col">
          <ImageGallery images={item.images?.length ? item.images : [item.image].filter(Boolean)} title={item.name} />
          <div className={`sid-status-badge sid-status-badge--${isLost ? "lost" : currentStatus}`}>
            {isLost
              ? "🔍 Still Looking"
              : currentStatus === "waiting"
              ? "✓ Available"
              : currentStatus === "pending"
              ? "⏳ Claim Pending"
              : "✓ Claimed"}
          </div>
        </div>

        {/* RIGHT: Info */}
        <div className="sid-info-col">
          <div className="sid-type-pill">
            {isLost ? "Lost Item" : "Found Item"}
          </div>

          <div className="sid-title-row">
            <h1 className="sid-title">{item.name}</h1>
            {(isItemOwner) && (
              <button
                className="sid-danger-btn"
                onClick={isLost ? handleDeleteLost : handleDeleteFound}
                disabled={actionLoading}
              >
                <FaTrash style={{ marginRight: 6 }} />
                Delete My Post
              </button>
            )}
          </div>

          <div className="sid-poster">
            {item.authorAvatar && (
              <img src={item.authorAvatar} alt={item.authorName} className="sid-poster__avatar" />
            )}
            <div className="sid-poster__info">
              <span className="sid-poster__label">{isLost ? "Lost by" : "Found by"}</span>
              <span className="sid-poster__name">{item.authorName || "Anonymous"}</span>
            </div>
          </div>

          <div className="sid-divider" />

          {dateLabel && (
            <div className="sid-meta-chip">
              <FaCalendar className="sid-meta-chip__icon" />
              <span>{isLost ? "Reported" : "Found"} {dateLabel}</span>
            </div>
          )}

          <div className="sid-description-box">
            <p className="sid-description-label">Description</p>
            <p className="sid-description-text">{item.description}</p>
          </div>

          {actionMsg && (
            <div className="sid-action-msg">
              <span>✓</span> {actionMsg}
            </div>
          )}

          <div className="sid-actions">
            {/* Found item actions */}
            {!isLost && !isItemOwner && currentStatus === "waiting" && (
              <button className="sid-btn sid-btn--primary" onClick={() => setShowChat(true)}>
                This is Mine — Message Finder
              </button>
            )}
            {!isLost && !isItemOwner && currentStatus === "pending" && (
              <button className="sid-btn sid-btn--disabled" disabled>
                ⏳ Claim Pending Confirmation
              </button>
            )}
            {!isLost && isItemOwner && currentStatus === "pending" && (
              <button className="sid-btn sid-btn--success" onClick={handleMarkClaimed} disabled={actionLoading}>
                {actionLoading ? "Confirming..." : "✓ Confirm Item is Claimed"}
              </button>
            )}
            {!isLost && !isItemOwner && (
              <button className="sid-btn sid-btn--secondary" onClick={() => setShowChat(true)}>
                Message Finder
              </button>
            )}

            {/* Lost item actions */}
            {isLost && !isItemOwner && (
              <button className="sid-btn sid-btn--primary" onClick={() => setShowChat(true)}>
                I Found This! — Message Owner
              </button>
            )}
            {isLost && isItemOwner && (
              <button className="sid-btn sid-btn--success" onClick={handleMarkFound} disabled={actionLoading}>
                {actionLoading ? "Updating..." : "✓ Mark as Found"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Chat panel */}
      {showChat && user && (
        <div className="sid-overlay" onClick={() => setShowChat(false)}>
          <div className="sid-chat" onClick={(e) => e.stopPropagation()}>
            <div className="sid-chat__header">
              <div className="sid-chat__avatar">
                {item.authorName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="sid-chat__header-info">
                <div className="sid-chat__name">{item.authorName}</div>
                <div className="sid-chat__item">{item.name}</div>
              </div>
              <button className="sid-chat__close" onClick={() => setShowChat(false)}>×</button>
            </div>
            <div className="sid-chat__messages">
              {messages.length === 0 && (
                <div className="sid-chat__empty">
                  <p>Say hi about <strong>{item.name}</strong></p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div key={msg.id} className={`sid-bubble-wrap${isOwn ? " sid-bubble-wrap--own" : ""}`}>
                    <div className={`sid-bubble${isOwn ? " sid-bubble--own" : " sid-bubble--other"}`}>
                      {msg.text}
                    </div>
                    <span className="sid-bubble__time">
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="sid-chat__input-row">
              <textarea
                rows={1}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                placeholder="Type a message..."
                className="sid-chat__textarea"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatText.trim() || chatSending}
                className={`sid-chat__send${chatText.trim() ? " sid-chat__send--active" : ""}`}
              >↑</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}