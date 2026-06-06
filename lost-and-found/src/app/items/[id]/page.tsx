"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useItems } from "@/context/ItemsContext";
import {
  FaFlag,
  FaMessage,
  FaTrash,
  FaArrowLeft,
  FaCalendar,
  FaMapPin,
} from "react-icons/fa6";
import ImageGallery from "@/app/components/ImageGallery";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LocationMap from "@/app/components/LocationMap";
import { getConversationId } from "@/app/components/MessagingSystem";
import "./item-detail.css";

const REPORT_REASONS = [
  "Inappropriate content",
  "Spam or duplicate",
  "Misleading information",
  "Already claimed / resolved",
  "Other",
];

function normalizeImages(imageData: any): string[] {
  if (Array.isArray(imageData))
    return imageData.filter((url) => url && typeof url === "string");
  if (typeof imageData === "string" && imageData) return [imageData];
  return [];
}

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

export default function ItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const { items, lostItems, updateItemStatus, removeLostItem } = useItems();

  const [item, setItem] = useState<any>(null);
  const [isLost, setIsLost] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isAdmin] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem("findr_is_admin") === "true"
      : false,
  );

  // Report modal
  const [showReport, setShowReport] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportDone, setReportDone] = useState(false);

  // Chat
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatText, setChatText] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Action states
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMsg, setActionMsg] = useState("");

  // Resolve item from context or fetch from DB
  useEffect(() => {
    if (!isLoaded) return;

    const idNum = parseInt(id, 10);

    const found = items?.find((i) => i.id === idNum);
    if (found) {
      setItem({ ...found });
      setIsLost(false);
      setLoading(false);
      return;
    }

    const lost = lostItems?.find((i) => i.id === idNum);
    if (lost) {
      setItem({ ...lost });
      setIsLost(true);
      setLoading(false);
      return;
    }

    const fetchItem = async () => {
      const { data: foundData } = await supabase
        .from("items")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (foundData) {
        const imageArray = normalizeImages(
          foundData.image_urls || foundData.image_url,
        );
        setItem({
          id: foundData.id,
          name: foundData.name,
          description: foundData.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: foundData.author_name,
          authorAvatar: foundData.author_avatar,
          authorId: foundData.author_id,
          authorEmail: foundData.author_email,
          status: foundData.status,
          aiKeywords: foundData.ai_keywords,
          date_found: foundData.date_found,
          location: foundData.location ?? null,
          latitude: foundData.latitude ?? null,
          longitude: foundData.longitude ?? null,
        });
        setIsLost(false);
        setLoading(false);
        return;
      }

      const { data: lostData } = await supabase
        .from("lost_items")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (lostData) {
        const imageArray = normalizeImages(
          lostData.image_urls || lostData.image_url,
        );
        setItem({
          id: lostData.id,
          name: lostData.name,
          description: lostData.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: lostData.author_name,
          authorAvatar: lostData.author_avatar,
          authorId: lostData.author_id,
          authorEmail: lostData.author_email,
          status: lostData.status,
          date_found: lostData.created_at,
          location: lostData.location ?? null,
          latitude: lostData.latitude ?? null,
          longitude: lostData.longitude ?? null,
        });
        setIsLost(true);
      }

      setLoading(false);
    };

    fetchItem();
  }, [id, items, lostItems, isLoaded]);

  // Chat subscription
  useEffect(() => {
    if (!showChat || !item || !user) return;
    const convId = getConversationId(
      { id: String(item.id) + (isLost ? "_lost" : ""), title: item.name },
      { uid: user.id, displayName: user.fullName || "Me" },
      { uid: item.authorId, displayName: item.authorName || "Owner" },
    );

    const fetchMsgs = async () => {
      const { data } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("conversation_id", convId)
        .order("created_at", { ascending: true });
      if (data) setMessages(data);
    };
    fetchMsgs();

    const channel = supabase
      .channel(`chat:${convId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `conversation_id=eq.${convId}`,
        },
        (payload) =>
          setMessages((prev) =>
            prev.some((m) => m.id === (payload.new as Message).id)
              ? prev
              : [...prev, payload.new as Message],
          ),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [showChat, item, user, isLost]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversationId =
    item && user
      ? getConversationId(
          { id: String(item.id) + (isLost ? "_lost" : ""), title: item.name },
          { uid: user.id, displayName: user.fullName || "Me" },
          { uid: item.authorId, displayName: item.authorName || "Owner" },
        )
      : "";

  const handleRetrieve = async () => {
    if (!user || !item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("items")
      .update({
        status: "pending",
        claimer_email: user.primaryEmailAddress?.emailAddress,
      })
      .eq("id", item.id);

    if (!error) {
      fetch("/api/emails/item-retrieval", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          author_name: item.authorName || "Owner",
          author_email: item.authorEmail,
          item_name: item.name,
          retriever_name: user.fullName || "A user",
          retriever_email: user.primaryEmailAddress?.emailAddress,
        }),
      }).catch(console.error);

      updateItemStatus(
        item.id,
        "pending",
        user.primaryEmailAddress?.emailAddress,
      );
      setItem((prev: any) => ({ ...prev, status: "pending" }));
      setActionMsg("Request sent! The owner has been notified.");
    }
    setActionLoading(false);
  };

  const handleConfirmClaimed = async () => {
    if (!item) return;
    setActionLoading(true);
    const { error } = await supabase.from("items").delete().eq("id", item.id);
    if (!error) {
      updateItemStatus(item.id, "claimed");
      setActionMsg("Item marked as claimed!");
      setTimeout(() => router.push("/dashboard"), 1200);
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!item || !confirm("Delete this item permanently?")) return;
    setActionLoading(true);
    const table = isLost ? "lost_items" : "items";
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (!error) {
      if (isLost) removeLostItem(item.id);
      else updateItemStatus(item.id, "claimed");
      router.push("/dashboard");
    }
    setActionLoading(false);
  };

  const handleMarkFound = async () => {
    if (!item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("lost_items")
      .delete()
      .eq("id", item.id);
    if (!error) {
      removeLostItem(item.id);
      setActionMsg("Marked as found!");
      setTimeout(() => router.push("/dashboard"), 1200);
    }
    setActionLoading(false);
  };

  const handleReportSubmit = async () => {
    if (!reportReason || !user || !item) return;
    setReportSubmitting(true);
    await supabase.from("reports").insert({
      item_id: item.id,
      item_name: item.name,
      item_image: item.image || null,
      reporter_id: user.id,
      reporter_name: user.fullName || "Me",
      reporter_email: user.primaryEmailAddress?.emailAddress,
      reason: reportReason,
    });
    setReportDone(true);
    setReportSubmitting(false);
    setTimeout(() => {
      setShowReport(false);
      setReportDone(false);
      setReportReason("");
    }, 1500);
  };

  const handleSendChat = async () => {
    if (!chatText.trim() || chatSending || !user || !item) return;
    setChatSending(true);
    const trimmed = chatText.trim();
    setChatText("");
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now(),
        conversation_id: conversationId,
        sender_id: user.id,
        sender_name: user.fullName || "Me",
        receiver_id: item.authorId,
        item_id: String(item.id),
        item_title: item.name,
        text: trimmed,
        created_at: new Date().toISOString(),
      },
    ]);
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      sender_name: user.fullName || "Me",
      receiver_id: item.authorId,
      receiver_name: item.authorName,
      item_id: String(item.id),
      item_title: item.name,
      text: trimmed,
      read: false,
    });
    setChatSending(false);
  };

  if (!isLoaded || loading) return <LoadingSpinner />;
  if (!item)
    return (
      <div className="detail-not-found">
        <p>Item not found.</p>
        <button
          onClick={() => router.push("/dashboard")}
          className="detail-back-btn"
        >
          ← Back to Dashboard
        </button>
      </div>
    );

  const isItemOwner = user?.id === item.authorId;
  const currentStatus = item.status || "waiting";

  const dateLabel = item.date_found
    ? new Date(item.date_found).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const hasLocation =
    typeof item.latitude === "number" && typeof item.longitude === "number";

  return (
    <div className="detail-page">
      {/* Back nav */}
      <div className="detail-breadcrumb">
        <button className="detail-back-btn" onClick={() => router.back()}>
          <FaArrowLeft />
          <span>Back</span>
        </button>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__label">
          {isLost ? "Lost Items" : "Found Items"}
        </span>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__current">{item.name}</span>
      </div>

      {/* Main layout */}
      <div className="detail-layout">
        {/* LEFT: Image */}
        <div className="detail-image-col">
          <ImageGallery
            images={item.images || [item.image].filter(Boolean)}
            title={item.name}
          />
          <div
            className={`detail-status-badge detail-status-badge--${currentStatus}`}
          >
            {isLost
              ? "🔍 Still Looking"
              : currentStatus === "waiting"
                ? "✓ Available"
                : currentStatus === "pending"
                  ? "⏳ Claim Pending"
                  : "✓ Claimed"}
          </div>
        </div>

        {/* RIGHT: Info + Actions */}
        <div className="detail-info-col">
          {/* Type pill */}
          <div className="detail-type-pill">
            {isLost ? "Lost Item" : "Found Item"}
          </div>

          {/* Title */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <h1 className="detail-title">{item.name}</h1>
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {!isItemOwner && (
                <button
                  className="detail-secondary-btn detail-secondary-btn--danger"
                  onClick={() => setShowReport(true)}
                  style={{ whiteSpace: "nowrap" }}
                >
                  <FaFlag style={{ marginRight: 6 }} />
                  Report
                </button>
              )}
              {isItemOwner && (
                <button
                  className="detail-secondary-btn detail-secondary-btn--danger"
                  onClick={handleDelete}
                >
                  <FaTrash style={{ marginRight: 6 }} />
                  Delete My Post
                </button>
              )}
            </div>
          </div>

          {/* Posted by */}
          <div className="detail-poster">
            {item.authorAvatar && (
              <img
                src={item.authorAvatar}
                alt={item.authorName}
                className="detail-poster__avatar"
              />
            )}
            <div className="detail-poster__info">
              <span className="detail-poster__label">
                {isLost ? "Lost by" : "Found by"}
              </span>
              <span className="detail-poster__name">
                {item.authorName || "Anonymous"}
              </span>
            </div>
          </div>

          <div className="detail-divider" />

          {/* Meta chips */}
          <div className="detail-meta-row">
            {dateLabel && (
              <div className="detail-meta-chip">
                <FaCalendar className="detail-meta-chip__icon" />
                <span>
                  {isLost ? "Reported" : "Found"} {dateLabel}
                </span>
              </div>
            )}
            {item.location && (
              <div className="detail-meta-chip">
                <FaMapPin className="detail-meta-chip__icon" />
                <span>{item.location}</span>
              </div>
            )}
          </div>

          {/* Description */}
          <div className="detail-description-box">
            <p className="detail-description-label">Description</p>
            <p className="detail-description-text">{item.description}</p>
          </div>

          {/* Location map */}
          {hasLocation && (
            <div style={{ marginTop: "4px" }}>
              <p
                style={{
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  color: "var(--text-muted)",
                  margin: "0 0 8px",
                }}
              >
                {isLost ? "Last seen location" : "Found location"}
              </p>
              <LocationMap
                lat={item.latitude}
                lng={item.longitude}
                address={item.location ?? undefined}
              />
            </div>
          )}

          {/* Action success message */}
          {actionMsg && (
            <div className="detail-action-msg">
              <span>✓</span> {actionMsg}
            </div>
          )}

          {/* PRIMARY ACTIONS */}
          <div className="detail-actions">
            {!isLost && !isItemOwner && currentStatus === "waiting" && (
              <button
                className="detail-btn detail-btn--primary"
                onClick={handleRetrieve}
                disabled={actionLoading}
              >
                {actionLoading
                  ? "Sending..."
                  : "This is Mine — Request to Retrieve"}
              </button>
            )}

            {!isLost && !isItemOwner && currentStatus === "pending" && (
              <button className="detail-btn detail-btn--disabled" disabled>
                ⏳ Claim Pending Confirmation
              </button>
            )}

            {!isLost && isItemOwner && currentStatus === "pending" && (
              <button
                className="detail-btn detail-btn--success"
                onClick={handleConfirmClaimed}
                disabled={actionLoading}
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Item is Claimed"}
              </button>
            )}

            {isLost && !isItemOwner && (
              <button
                className="detail-btn detail-btn--primary"
                onClick={() => setShowChat(true)}
                disabled={actionLoading}
              >
                I Found This! — Message Owner
              </button>
            )}

            {isLost && isItemOwner && (
              <button
                className="detail-btn detail-btn--success"
                onClick={handleMarkFound}
                disabled={actionLoading}
              >
                {actionLoading ? "Updating..." : "✓ Mark as Found"}
              </button>
            )}

            {!isLost && !isItemOwner && (
              <button
                className="detail-btn detail-btn--secondary"
                onClick={() => setShowChat(true)}
              >
                <FaMessage style={{ marginRight: 8 }} />
                Message Finder
              </button>
            )}
          </div>

          {/* SECONDARY ACTIONS */}
          <div className="detail-secondary-actions">
            {isAdmin && (
              <button
                className="detail-secondary-btn detail-secondary-btn--danger"
                onClick={handleDelete}
              >
                <FaTrash style={{ marginRight: 6 }} />
                Delete (Admin)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── REPORT MODAL ── */}
      {showReport && (
        <div className="detail-overlay" onClick={() => setShowReport(false)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            {reportDone ? (
              <div className="panel-success">
                <span className="panel-success__icon">✓</span>
                <p>Report submitted</p>
              </div>
            ) : (
              <>
                <p className="detail-modal__title">Report "{item.name}"</p>
                <p className="detail-modal__subtitle">
                  Why are you reporting this item?
                </p>
                <div className="detail-modal__reasons">
                  {REPORT_REASONS.map((r) => (
                    <button
                      key={r}
                      className={`detail-modal__reason${reportReason === r ? " detail-modal__reason--selected" : ""}`}
                      onClick={() => setReportReason(r)}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                <div className="detail-modal__actions">
                  <button
                    className="detail-modal__cancel"
                    onClick={() => setShowReport(false)}
                  >
                    Cancel
                  </button>
                  <button
                    className="detail-modal__submit"
                    onClick={handleReportSubmit}
                    disabled={!reportReason || reportSubmitting}
                  >
                    {reportSubmitting ? "Submitting..." : "Submit Report"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHAT PANEL ── */}
      {showChat && user && (
        <div className="detail-overlay" onClick={() => setShowChat(false)}>
          <div className="detail-chat" onClick={(e) => e.stopPropagation()}>
            <div className="detail-chat__header">
              <div className="chat-modal__avatar">
                {item.authorName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div className="chat-modal__header-info">
                <div className="chat-modal__name">{item.authorName}</div>
                <div className="chat-modal__item">{item.name}</div>
              </div>
              <button
                className="chat-modal__close"
                onClick={() => setShowChat(false)}
              >
                ×
              </button>
            </div>
            <div className="chat-modal__messages">
              {messages.length === 0 && (
                <div className="chat-modal__empty">
                  <p>
                    Say hi about <strong>{item.name}</strong>
                  </p>
                </div>
              )}
              {messages.map((msg) => {
                const isOwn = msg.sender_id === user.id;
                return (
                  <div
                    key={msg.id}
                    className={`chat-bubble-wrapper${isOwn ? " chat-bubble-wrapper--own" : ""}`}
                  >
                    <div
                      className={`chat-bubble${isOwn ? " chat-bubble--own" : " chat-bubble--other"}`}
                    >
                      {msg.text}
                    </div>
                    <span className="chat-bubble__time">
                      {new Date(msg.created_at).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
            <div className="chat-modal__input-row">
              <textarea
                rows={1}
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendChat();
                  }
                }}
                placeholder="Type a message..."
                className="chat-modal__textarea"
              />
              <button
                onClick={handleSendChat}
                disabled={!chatText.trim() || chatSending}
                className={`chat-modal__send${chatText.trim() ? " chat-modal__send--active" : ""}`}
              >
                ↑
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
