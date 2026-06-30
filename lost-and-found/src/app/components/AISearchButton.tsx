"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";
import { useSettings } from "@/context/SettingsContext";

//button in the top bar that navigates to the AI semantic search page
export default function AISearchButton() {
  const router = useRouter();
  const { language, hydrated } = useSettings();
  const [label, setLabel] = useState("AI Search"); //translated button label

  //translates the button label when the UI language changes
  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setLabel("AI Search"); return; }
    const key = `t:${language}:AI Search`;
    const cached = localStorage.getItem(key);
    if (cached) { setLabel(cached); return; }
    fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "AI Search", target: language }),
    })
      .then((r) => r.json())
      .then((d) => {
        const v = d.translatedText || "AI Search";
        setLabel(v);
        localStorage.setItem(key, v);
      })
      .catch(() => {});
  }, [language, hydrated]);

  return (
    <button
      onClick={() => router.push("/ai-search")}
      title={label}
      aria-label={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px",
        borderRadius: 10,
        border: "1.5px solid var(--border-input)",
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-body)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--accent)";
        btn.style.color = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--border-input)";
        btn.style.color = "var(--text-primary)";
      }}
    >
      <HiSparkles size={16} />
      <span className="ai-search-label">{label}</span>
    </button>
  );
}
