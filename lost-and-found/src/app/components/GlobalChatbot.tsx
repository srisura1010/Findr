"use client";

import { useRef, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useGlobalChat } from "@/context/GlobalChatContext";
import { useSettings } from "@/context/SettingsContext";
import "./GlobalChatbot.css";

const BASE_SYSTEM_PROMPT = `You are the helpful support assistant for Findr, a school lost & found web app.
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

If you don't know something, say so and suggest contacting the school admin.
Always reply in the user's preferred language.`;

const LANGUAGE_NAMES: Record<string, string> = {
  en: "English", es: "Spanish", fr: "French", de: "German", zh: "Chinese",
  hi: "Hindi", ar: "Arabic", pt: "Portuguese", bn: "Bengali", ru: "Russian",
  ja: "Japanese", ko: "Korean", it: "Italian", tr: "Turkish", vi: "Vietnamese",
  pl: "Polish", nl: "Dutch", uk: "Ukrainian", fa: "Persian", sw: "Swahili",
};

const HIDDEN_PREFIXES = ["/help", "/banned", "/sign-in", "/sign-up", "/messages"];

async function t(text: string, language: string): Promise<string> {
  if (language === "en") return text;
  const cacheKey = `chatbot_ui_${language}_${text.slice(0, 40)}`;
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
  } catch {}
  return text;
}

export default function GlobalChatbot() {
  const pathname = usePathname();
  const { messages, setMessages, isOpen, setIsOpen } = useGlobalChat();
  const { language, hydrated } = useSettings();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const loadingRef = useRef(false);

  const [uiTitle, setUiTitle] = useState("Findr AI Support");
  const [uiPlaceholder, setUiPlaceholder] = useState("Ask anything about Findr...");
  const [uiGreeting, setUiGreeting] = useState(
    "Hey! I'm Findr's support assistant. Ask me anything about how to use the app",
  );

  useEffect(() => {
    if (!hydrated) return;
    const translate = async () => {
      const [title, placeholder, greeting] = await Promise.all([
        t("Findr AI Support", language),
        t("Ask anything about Findr...", language),
        t("Hey! I'm Findr's support assistant. Ask me anything about how to use the app", language),
      ]);
      setUiTitle(title);
      setUiPlaceholder(placeholder);
      setUiGreeting(greeting);
    };
    translate();
  }, [language, hydrated]);

  // Keep the greeting message in sync with the current language
  useEffect(() => {
    setMessages((prev) => {
      // Only update if it's still just the greeting (no conversation yet)
      if (prev.length === 0) return [{ role: "assistant", content: uiGreeting }];
      if (prev.length === 1 && prev[0].role === "assistant") {
        return [{ role: "assistant", content: uiGreeting }];
      }
      return prev;
    });
  }, [uiGreeting]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  const systemPrompt = `${BASE_SYSTEM_PROMPT}\nThe user's preferred language is ${LANGUAGE_NAMES[language] ?? language}. Always respond in that language.`;

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
            { role: "system", content: systemPrompt },
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
        className="global-cat-fab"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Toggle support chat"
      >
        <img src="/logo/Findr_logo.png" alt="Findr" style={{ width: "50px", height: "50px", objectFit: "contain", display: "block", margin: "0 auto" }} />
      </button>

      {isOpen && (
        <div className="global-chat-panel">
          <div className="global-chat-header">
            <div className="global-chat-header-dot" />
            <span>{uiTitle}</span>
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
                  <div className="global-chat-avatar"><img src="/logo/Findr_logo.png" alt="Findr" style={{ width: "16px", height: "16px", objectFit: "contain", display: "block" }} /></div>
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
              placeholder={uiPlaceholder}
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
