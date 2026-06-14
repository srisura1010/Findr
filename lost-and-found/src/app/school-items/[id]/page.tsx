"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import {
  FaFlag,
  FaMessage,
  FaTrash,
  FaArrowLeft,
  FaCalendar,
  FaMapPin,
  FaTag,
} from "react-icons/fa6";
import ImageGallery from "@/app/components/ImageGallery";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import LocationMap from "@/app/components/LocationMap";
import { getConversationId } from "@/app/components/MessagingSystem";
import "./school-item-detail.css";

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

export default function SchoolItemDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, isLoaded } = useUser();

  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSchoolAdmin, setIsSchoolAdmin] = useState(false);

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

  // Related items
  const [relatedItems, setRelatedItems] = useState<any[]>([]);
  const [relatedLoading, setRelatedLoading] = useState(false);

  // Fetch from school_items table
  useEffect(() => {
    if (!isLoaded) return;

    const idNum = parseInt(id, 10);

    const fetchItem = async () => {
      const { data } = await supabase
        .from("school_items")
        .select("*")
        .eq("id", idNum)
        .maybeSingle();

      if (data) {
        const imageArray = normalizeImages(data.image_urls || data.image_url);
        setItem({
          id: data.id,
          name: data.name,
          description: data.description,
          image: imageArray[0] || "",
          images: imageArray,
          authorName: data.author_name,
          authorAvatar: data.author_avatar,
          authorId: data.author_id,
          authorEmail: data.author_email,
          status: data.status,
          aiKeywords: data.ai_keywords,
          category: data.category ?? null,
          date_found: data.date_found,
          location: data.location ?? null,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
          school_id: data.school_id,
        });

        // Check if the current user is a school admin for this school
        if (typeof window !== "undefined") {
          setIsSchoolAdmin(
            localStorage.getItem(`findr_school_admin_${data.school_id}`) === "true"
          );
        }
      }

      setLoading(false);
    };

    fetchItem();
  }, [id, isLoaded]);

  // Chat subscription
  useEffect(() => {
    if (!showChat || !item || !user) return;
    const convId = getConversationId(
      { id: String(item.id) + "_school", title: item.name },
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
  }, [showChat, item, user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const conversationId =
    item && user
      ? getConversationId(
          { id: String(item.id) + "_school", title: item.name },
          { uid: user.id, displayName: user.fullName || "Me" },
          { uid: item.authorId, displayName: item.authorName || "Owner" },
        )
      : "";

  const handleRetrieve = async () => {
    if (!user || !item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("school_items")
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

      setItem((prev: any) => ({ ...prev, status: "pending" }));
      setActionMsg("Request sent! The owner has been notified.");
    }
    setActionLoading(false);
  };

  const handleConfirmClaimed = async () => {
    if (!item) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("school_items")
      .delete()
      .eq("id", item.id);
    if (!error) {
      setActionMsg("Item marked as claimed!");
      setTimeout(() => router.back(), 1200);
    }
    setActionLoading(false);
  };

  const handleDelete = async () => {
    if (!item || !confirm("Delete this item permanently?")) return;
    setActionLoading(true);
    const { error } = await supabase
      .from("school_items")
      .delete()
      .eq("id", item.id);
    if (!error) {
      router.back();
    }
    setActionLoading(false);
  };

  // Reports now go to school_reports, scoped to the school
  const handleReportSubmit = async () => {
    if (!reportReason || !user || !item) return;
    setReportSubmitting(true);
    await supabase.from("school_reports").insert({
      school_id: item.school_id,
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

  // Auto-fetch related items when the item loads
  useEffect(() => {
    if (!item?.category || !item?.school_id) return;
    const fetch = async () => {
      setRelatedLoading(true);
      try {
        const { data } = await supabase
          .from("school_items")
          .select("id, name, image_url, image_urls, category, status")
          .eq("school_id", item.school_id)
          .eq("category", item.category)
          .neq("id", item.id)
          .neq("status", "claimed")
          .limit(6);
        setRelatedItems(data || []);
      } catch {
        setRelatedItems([]);
      } finally {
        setRelatedLoading(false);
      }
    };
    fetch();
  }, [item]);

  if (!isLoaded || loading) return <LoadingSpinner />;
  if (!item)
    return (
      <div className="detail-not-found">
        <p>Item not found.</p>
        <button onClick={() => router.back()} className="detail-back-btn">
          ← Back
        </button>
      </div>
    );

  const isItemOwner = user?.id === item.authorId;
  const canDelete = isItemOwner || isSchoolAdmin;
  const currentStatus = item.status || "waiting";

  const dateLabel = item.date_found
    ? new Date(item.date_found).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  const hasLocation =
    item.latitude != null &&
    item.longitude != null &&
    !isNaN(Number(item.latitude)) &&
    !isNaN(Number(item.longitude));

  return (
    <div className="detail-page">
      {/* Back nav */}
      <div className="detail-breadcrumb">
        <button className="detail-back-btn" onClick={() => router.back()}>
          <FaArrowLeft />
          <span>Back</span>
        </button>
        <span className="detail-breadcrumb__sep">/</span>
        <span className="detail-breadcrumb__label">School Items</span>
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
            {currentStatus === "waiting"
              ? "✓ Available"
              : currentStatus === "pending"
                ? "⏳ Claim Pending"
                : "✓ Claimed"}
          </div>
        </div>

        {/* RIGHT: Info + Actions */}
        <div className="detail-info-col">
          {/* Type pill */}
          <div className="detail-type-pill">School Found Item</div>

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
              {canDelete && (
                <button
                  className="detail-secondary-btn detail-secondary-btn--danger"
                  onClick={handleDelete}
                >
                  <FaTrash style={{ marginRight: 6 }} />
                  {isSchoolAdmin && !isItemOwner
                    ? "Delete (School Admin)"
                    : "Delete My Post"}
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
              <span className="detail-poster__label">Found by</span>
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
                <span>Found {dateLabel}</span>
              </div>
            )}
            {item.location && (
              <div className="detail-meta-chip">
                <FaMapPin className="detail-meta-chip__icon" />
                <span>{item.location}</span>
              </div>
            )}
            {item.category && (
              <div className="detail-meta-chip">
                <FaTag className="detail-meta-chip__icon" />
                <span>{item.category}</span>
              </div>
            )}
          </div>

          {/* AI keyword chips */}
          {item.aiKeywords && (
            <div className="detail-tags-row">
              {item.aiKeywords
                .split(",")
                .map((kw: string) => kw.trim())
                .filter(Boolean)
                .slice(0, 8)
                .map((kw: string) => (
                  <span key={kw} className="detail-tag-chip">
                    {kw}
                  </span>
                ))}
            </div>
          )}

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
                Found location
              </p>
              <LocationMap
                lat={Number(item.latitude)}
                lng={Number(item.longitude)}
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
            {!isItemOwner && currentStatus === "waiting" && (
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

            {!isItemOwner && currentStatus === "pending" && (
              <button className="detail-btn detail-btn--disabled" disabled>
                ⏳ Claim Pending Confirmation
              </button>
            )}

            {isItemOwner && currentStatus === "pending" && (
              <button
                className="detail-btn detail-btn--success"
                onClick={handleConfirmClaimed}
                disabled={actionLoading}
              >
                {actionLoading ? "Confirming..." : "✓ Confirm Item is Claimed"}
              </button>
            )}

            {!isItemOwner && (
              <button
                className="detail-btn detail-btn--secondary"
                onClick={() => setShowChat(true)}
              >
                <FaMessage style={{ marginRight: 8 }} />
                Message Finder
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Related items */}
      {(relatedLoading || relatedItems.length > 0) && (
        <div className="related-section">
          <div className="related-section__header">
            <p className="related-section__title">Similar items</p>
          </div>
          <div className="related-grid">
            {relatedLoading ? (
              <p className="related-loading">Finding similar items...</p>
            ) : (
              relatedItems.map((ri: any) => {
                const img = Array.isArray(ri.image_urls)
                  ? ri.image_urls[0]
                  : ri.image_url || null;
                return (
                  <a
                    key={ri.id}
                    href={`/school-items/${ri.id}`}
                    className="related-card"
                  >
                    {img ? (
                      <img
                        src={img}
                        alt={ri.name}
                        className="related-card__img"
                      />
                    ) : (
                      <div className="related-card__img-placeholder">📦</div>
                    )}
                    <div className="related-card__body">
                      <p className="related-card__name">{ri.name}</p>
                      {ri.category && (
                        <p className="related-card__cat">{ri.category}</p>
                      )}
                    </div>
                  </a>
                );
              })
            )}
          </div>
        </div>
      )}

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