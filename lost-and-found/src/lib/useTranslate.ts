"use client";

import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";

//hook that translates a string to the current UI language, with localStorage caching
export function useTranslate() {
  const { language } = useSettings();
  const [loading, setLoading] = useState(false); //true while a translation request is in flight

  const translate = async (text: string) => {
    if (language === "en") return text;

    // Check localStorage first — instant return for anything already seen.
    const lsKey = `t:${language}:${text}`;
    const cached = typeof window !== "undefined" ? localStorage.getItem(lsKey) : null;
    if (cached) return cached;

    setLoading(true);
    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: language }),
      });

      if (!res.ok) {
        setLoading(false);
        return text;
      }

      const data = await res.json();
      const result: string = data.translatedText || text;

      // Persist so future page loads are instant.
      if (typeof window !== "undefined") localStorage.setItem(lsKey, result);

      setLoading(false);
      return result;
    } catch (error) {
      console.error("Translation error:", error);
      setLoading(false);
      return text;
    }
  };

  return { translate, loading };
}
