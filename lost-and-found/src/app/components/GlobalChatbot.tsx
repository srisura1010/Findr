"use client";

import { useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useGlobalChat } from "@/context/GlobalChatContext";
import "./GlobalChatbot.css";

const SYSTEM_PROMPT = `You are the helpful support assistant for Findr, a school lost & found web app.
Keep answers short, friendly, and focused on Findr. Here's what you know:

- Users post found items (name, description, photo) on the dashboard
- AI reads item photos and auto-tags them with keywords for better search
- Users search items using natural language in the search bar
- Clicking "Retrieve" sends an email to the finder and marks it "pending"
- Finder clicks "Confirm Claimed" once they hand the item back — it's deleted
- "Message Finder" opens a real-time chat between finder and claimer
- "Become an Admin" lets staff submit a request; approved admins get a password and can delete items
- Settings page has language switching (AI translation) and text-to-speech accessibility
- Built with Next.js, Clerk auth, Supabase, Groq AI, EmailJS

If you don't know something, say so and suggest contacting the school admin.`;

const HIDDEN_PREFIXES = ["/help", "/banned", "/sign-in", "/sign-up"];

export default function GlobalChatbot() {
  const pathname = usePathname();
  const { messages, setMessages, isOpen, setIsOpen } = useGlobalChat();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          role: "assistant",
          content:
            "Hey! I'm Findr's support assistant. Ask me anything about how to use the app",
        },
      ]);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const sendMessage = async () => {
    const input = inputRef.current;
    if (!input || !input.value.trim() || loadingRef.current) return;
    const userMsg = { role: "user" as const, content: input.value.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    input.value = "";
    loadingRef.current = true;
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/groq-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            ...updated.map((m) => ({ role: m.role, content: m.content })),
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong");
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = { role: "assistant", content: data.reply };
        return copy;
      });
    } catch (err: any) {
      setMessages((prev) => {
        const copy = [...prev];
        copy[copy.length - 1] = {
          role: "assistant",
          content: `Error: ${err.message}`,
        };
        return copy;
      });
    } finally {
      loadingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      <button
        className="global-chat-fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Toggle support chat"
      >
        F
      </button>

      {isOpen && (
        <div className="global-chat-panel">
          <div className="global-chat-header">
            <div className="global-chat-header-dot" />
            <span>Findr AI Support</span>
            <button
              className="global-chat-close"
              onClick={() => setIsOpen(false)}
            >
              ×
            </button>
          </div>
          <div className="global-chat-messages">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`global-chat-bubble-wrap${msg.role === "user" ? " global-chat-bubble-wrap--user" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="global-chat-avatar">F</div>
                )}
                <div
                  className={`global-chat-bubble global-chat-bubble--${msg.role}`}
                >
                  {msg.content ||
                    (loadingRef.current && i === messages.length - 1
                      ? "…"
                      : "")}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
          <div className="global-chat-input-row">
            <textarea
              ref={inputRef}
              rows={1}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything about Findr..."
              className="global-chat-textarea"
            />
            <button onClick={sendMessage} className="global-chat-send">
              ↑
            </button>
          </div>
        </div>
      )}
    </>
  );
}
