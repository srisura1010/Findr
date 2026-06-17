"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FaShieldHalved } from "react-icons/fa6";
import { BsMailbox } from "react-icons/bs";

// AdminInboxPanel
//
// This component provides a simple admin-facing messaging inbox.
// It:
// - fetches conversations involving the current admin (sent + received)
// - creates a conversation summary list (last message + unread indicator)
// - fetches the active conversation's messages
// - subscribes to Supabase realtime INSERT events so new messages appear live
// - marks messages as read when the admin opens a conversation
//
// It is intentionally self-contained and uses inline styles to keep layout
// predictable across admin pages.

// Row shape from the `chat_messages` table.
// This mirrors the database schema, not the UI-facing shape.
interface DBMessage {
  id: number;
  conversation_id: string;
  sender_id: string;
  sender_name: string | null;
  sender_email: string | null;
  receiver_id: string;
  receiver_name: string | null;
  receiver_email: string | null;
  item_id: string;
  item_title: string | null;
  text: string;
  created_at: string;
  read: boolean;
}

// Aggregated summary shown in the left sidebar for each conversation.
// This is derived from the most recent message per `conversation_id`.
interface ConvSummary {
  conversation_id: string;
  otherUserId: string;
  otherUserName: string;
  lastMessage: string;
  lastMessageAt: string;
  unread: boolean;
}

export function AdminInboxPanel({
  adminId,
  adminName,
  adminEmail
}: { adminId: string; adminName: string; adminEmail: string }) {
  // List of conversations (left column).
  const [convs, setConvs] = useState<ConvSummary[]>([]);

  // Selected conversation.
  const [activeConvId, setActiveConvId] = useState<string | null>(null);

  // Messages for the selected conversation.
  const [messages, setMessages] = useState<DBMessage[]>([]);

  // Draft text for the reply composer.
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  // Used to auto-scroll the message list when new messages arrive.
  const bottomRef = useRef<HTMLDivElement>(null);

  // Fetch and summarize all conversations involving the admin.
  //
  // We query messages where the admin is sender and where the admin is receiver,
  // merge them, and then keep only the newest message per conversation.
  const fetchConvs = async () => {
    const [{ data: sent }, { data: received }] = await Promise.all([
      supabase.from("chat_messages").select("*").eq("sender_id", adminId).order("created_at", { ascending: false }),
      supabase.from("chat_messages").select("*").eq("receiver_id", adminId).order("created_at", { ascending: false })
    ]);

    const all: DBMessage[] = [...(sent ?? []), ...(received ?? [])];
    all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    const map = new Map<string, ConvSummary>();
    for (const msg of all) {
      // The first time we see a conversation_id in this sorted list is the most
      // recent message for that conversation.
      if (!map.has(msg.conversation_id)) {
        const isOwn = msg.sender_id === adminId;
        map.set(msg.conversation_id, {
          conversation_id: msg.conversation_id,
          otherUserId: isOwn ? msg.receiver_id : msg.sender_id,
          otherUserName: isOwn ?
            msg.receiver_name || msg.receiver_email || msg.receiver_id :
            msg.sender_name || msg.sender_email || msg.sender_id,
          lastMessage: msg.text,
          lastMessageAt: msg.created_at,

          // A conversation is unread if the latest message is addressed to the
          // admin and is still marked unread.
          unread: !msg.read && msg.receiver_id === adminId
        });
      }
    }
    setConvs(Array.from(map.values()));
  };

  useEffect(() => {
    // Initial load + realtime updates for new messages received by this admin.
    fetchConvs();
    const ch = supabase.
      channel("admin-inbox-convos").
      on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `receiver_id=eq.${adminId}`
      }, () => fetchConvs()).
      subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [adminId]);

  useEffect(() => {
    if (!activeConvId) return;

    const fetch = async () => {
      // Fetch the full message history for the active conversation.
      const { data } = await supabase.
        from("chat_messages").select("*").
        eq("conversation_id", activeConvId).
        order("created_at", { ascending: true });
      if (data) setMessages(data);

      // Mark all messages in this conversation as read where the admin is the receiver.
      await supabase.from("chat_messages").update({ read: true }).
        eq("conversation_id", activeConvId).eq("receiver_id", adminId);

      // Update local conversation summary so the unread dot/count disappears immediately.
      setConvs((prev) =>
        prev.map((c) => c.conversation_id === activeConvId ? { ...c, unread: false } : c)
      );
    };
    fetch();

    // Realtime subscription for messages in the active conversation.
    // This ensures the chat panel updates live.
    const ch = supabase.
      channel(`admin-inbox-chat:${activeConvId}`).
      on("postgres_changes", {
        event: "INSERT", schema: "public", table: "chat_messages",
        filter: `conversation_id=eq.${activeConvId}`
      }, (payload) => {
        const m = payload.new as DBMessage;
        setMessages((prev) => prev.some((x) => x.id === m.id) ? prev : [...prev, m]);

        // If the new message is addressed to the admin, mark it read right away
        // since the conversation is currently open.
        if (m.receiver_id === adminId) {
          supabase.from("chat_messages").update({ read: true }).eq("id", m.id);
        }
      }).
      subscribe();

    return () => { supabase.removeChannel(ch); };
  }, [activeConvId, adminId]);

  useEffect(() => {
    // Keep the latest message in view.
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const activeConv = convs.find((c) => c.conversation_id === activeConvId);

  const handleSend = async () => {
    if (!text.trim() || sending || !activeConv) return;
    setSending(true);
    const trimmed = text.trim();
    setText("");

    // Insert a new message row.
    // Conversation metadata is duplicated in each row to simplify querying.
    await supabase.from("chat_messages").insert({
      conversation_id: activeConvId,
      sender_id: adminId,
      sender_name: adminName,
      sender_email: adminEmail,
      receiver_id: activeConv.otherUserId,
      receiver_name: activeConv.otherUserName,
      item_id: "admin-support",
      item_title: "Admin Support",
      text: trimmed,
      read: false
    });
    setSending(false);
  };

  // Enter sends; Shift+Enter inserts newline.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Used for the unread badge in the header.
  const totalUnread = convs.filter((c) => c.unread).length;

  return (
    <div style={{ display: "flex", height: "calc(100vh - 120px)", fontFamily: "var(--font-body)" }}>
      <div style={{
        width: 280, flexShrink: 0, background: "#fff",
        borderRight: "1px solid #e2e8f0", display: "flex", flexDirection: "column",
        overflow: "hidden"
      }}>
        <div style={{ padding: "16px 14px 10px", borderBottom: "1px solid #f1f5f9" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <FaShieldHalved style={{ color: "#2563eb", fontSize: 16 }} />
            <span style={{ fontWeight: 800, fontSize: 16, color: "#0f172a" }}>Admin Inbox</span>
            {totalUnread > 0 &&
            <span style={{
              background: "#ef4444", color: "#fff", fontSize: 11,
              fontWeight: 700, borderRadius: 99, padding: "1px 7px", marginLeft: "auto"
            }}>{totalUnread}</span>
            }
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {convs.length === 0 &&
          <div style={{ padding: 28, textAlign: "center", color: "#94a3b8", fontSize: 13 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}><BsMailbox /></div>
              No messages yet
            </div>
          }
          {convs.map((conv) =>
          <button
            key={conv.conversation_id}
            onClick={() => setActiveConvId(conv.conversation_id)}
            style={{
              width: "100%", padding: "12px 14px",
              background: activeConvId === conv.conversation_id ? "#eff6ff" : "transparent",
              border: "none",
              borderLeft: activeConvId === conv.conversation_id ? "3px solid #2563eb" : "3px solid transparent",
              borderBottom: "1px solid #f8fafc",
              cursor: "pointer", textAlign: "left", fontFamily: "inherit",
              display: "flex", alignItems: "flex-start", gap: 10
            }}>
            
              <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#7c3aed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 13, flexShrink: 0
            }}>
                {conv.otherUserName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                fontWeight: conv.unread ? 700 : 600, fontSize: 13, color: "#0f172a"
              }}>
                  <span style={{
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 150
                }}>{conv.otherUserName}</span>
                  {conv.unread &&
                <span style={{
                  width: 8, height: 8, borderRadius: "50%",
                  background: "#2563eb", flexShrink: 0
                }} />
                }
                </div>
                <div style={{
                fontSize: 12, color: "#64748b", marginTop: 2,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontWeight: conv.unread ? 600 : 400
              }}>
                  {conv.lastMessage}
                </div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                  {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </button>
          )}
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: "#f8fafc" }}>
        {!activeConvId ?
        <div style={{
          flex: 1, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", color: "#94a3b8"
        }}>
            <FaShieldHalved style={{ fontSize: 40, color: "#c7d2fe", marginBottom: 10 }} />
            <p style={{ fontSize: 14 }}>Select a conversation to reply</p>
          </div> :

        <>
            <div style={{
            padding: "12px 16px", borderBottom: "1px solid #e2e8f0",
            background: "#fff", display: "flex", alignItems: "center", gap: 10
          }}>
              <div style={{
              width: 36, height: 36, borderRadius: "50%", background: "#7c3aed",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontWeight: 700, fontSize: 13
            }}>
                {activeConv?.otherUserName?.[0]?.toUpperCase() ?? "?"}
              </div>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: "#0f172a" }}>{activeConv?.otherUserName}</div>
                <div style={{ fontSize: 11, color: "#94a3b8" }}>User · Admin Support</div>
              </div>
            </div>

            <div style={{
            flex: 1, overflowY: "auto", padding: 16,
            display: "flex", flexDirection: "column", gap: 4
          }}>
              {messages.length === 0 &&
            <div style={{
              flex: 1, display: "flex", alignItems: "center",
              justifyContent: "center", color: "#94a3b8", fontSize: 13
            }}>No messages yet — they'll appear here in real time</div>
            }
              {messages.map((msg) => {
              const isOwn = msg.sender_id === adminId;
              return (
                <div key={msg.id} style={{
                  display: "flex", flexDirection: "column",
                  alignItems: isOwn ? "flex-end" : "flex-start", marginBottom: 6
                }}>
                    <div style={{
                    maxWidth: "72%", padding: "9px 13px",
                    borderRadius: isOwn ? "16px 16px 3px 16px" : "16px 16px 16px 3px",
                    background: isOwn ? "#2563eb" : "#fff",
                    color: isOwn ? "#fff" : "#0f172a",
                    fontSize: 14, lineHeight: 1.5, wordBreak: "break-word",
                    boxShadow: isOwn ? "0 2px 8px rgba(37,99,235,0.2)" : "0 1px 4px rgba(0,0,0,0.08)"
                  }}>
                      {msg.text}
                    </div>
                    <span style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>);

            })}
              <div ref={bottomRef} />
            </div>

            <div style={{
            display: "flex", gap: 8, padding: "12px 16px",
            borderTop: "1px solid #e2e8f0", background: "#fff", alignItems: "flex-end"
          }}>
              <textarea
              rows={1}
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Reply as admin…"
              style={{
                flex: 1, border: "1.5px solid #e2e8f0", borderRadius: 20,
                padding: "9px 14px", fontSize: 14, resize: "none",
                fontFamily: "inherit", outline: "none", lineHeight: 1.5,
                background: "#f8fafc", color: "#0f172a"
              }} />
            
              <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              style={{
                width: 38, height: 38, borderRadius: "50%",
                background: text.trim() ? "#2563eb" : "#e2e8f0",
                color: text.trim() ? "#fff" : "#94a3b8",
                border: "none", fontSize: 18, cursor: text.trim() ? "pointer" : "default",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, transition: "background 0.15s"
              }}>
              ↑</button>
            </div>
          </>
        }
      </div>
    </div>);

}
