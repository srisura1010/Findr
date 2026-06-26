"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useSettings } from "@/context/SettingsContext";

async function tx(text: string, language: string): Promise<string> {
  const key = `t:${language}:${text}`;
  const cached = localStorage.getItem(key);
  if (cached) return cached;
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, target: language }),
    });
    const d = await res.json();
    const result = d.translatedText || text;
    localStorage.setItem(key, result);
    return result;
  } catch {
    return text;
  }
}

export default function BannedPage() {
  const router = useRouter();
  const { language, hydrated } = useSettings();
  const [titleText, setTitleText] = useState("Account Suspended");
  const [bodyText, setBodyText] = useState(
    "Your account has been banned or suspended from Finder. If you believe this is a mistake, please contact your school administrator."
  );
  const [btnText, setBtnText] = useState("Go Home");

  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") {
      setTitleText("Account Suspended");
      setBodyText("Your account has been banned or suspended from Finder. If you believe this is a mistake, please contact your school administrator.");
      setBtnText("Go Home");
      return;
    }
    Promise.all([
      tx("Account Suspended", language),
      tx("Your account has been banned or suspended from Finder. If you believe this is a mistake, please contact your school administrator.", language),
      tx("Go Home", language),
    ]).then(([t1, t2, t3]) => {
      setTitleText(t1);
      setBodyText(t2);
      setBtnText(t3);
    });
  }, [language, hydrated]);

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg, #0f0f0f)",
      color: "var(--text, #fff)",
      textAlign: "center",
      padding: "2rem"
    }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚫</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        {titleText}
      </h1>
      <p style={{ color: "var(--text-muted, #888)", maxWidth: "400px", lineHeight: 1.6 }}>
        {bodyText}
      </p>
      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: "2rem",
          padding: "10px 24px",
          borderRadius: "8px",
          background: "var(--accent, #6366f1)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: "0.9rem"
        }}>
        {btnText}
      </button>
    </div>
  );
}
