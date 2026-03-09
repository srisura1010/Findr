"use client";

import { useState } from "react";
import { useSettings } from "@/context/SettingsContext";

// Small helper hook to translate short UI strings based on the user's selected
// language.
//
// This delegates translation to the `/api/translate` route (server-side), which
// keeps API keys off the client.
export function useTranslate() {
  const { language } = useSettings();
  const [loading, setLoading] = useState(false);

  // Translate a string to the current `language`.
  // If `language` is English, this is a no-op.
  const translate = async (text: string) => {
    if (language === "en") return text;

    setLoading(true);

    try {
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, target: language })
      });


      // If the API returns a non-2xx response, we log and fall back to the
      // original text rather than breaking the UI.
      if (!res.ok) {
        console.error(`Translation API error: ${res.status} ${res.statusText}`);
        setLoading(false);
        return text;
      }


      const contentType = res.headers.get("content-type");
      // Defensive check: ensure the response is JSON before parsing.
      if (!contentType || !contentType.includes("application/json")) {
        console.error("Translation API did not return JSON");
        setLoading(false);
        return text;
      }

      const data = await res.json();
      setLoading(false);

      return data.translatedText || text;
    } catch (error) {
      console.error("Translation error:", error);
      setLoading(false);
      return text;
    }
  };

  return { translate, loading };
}
