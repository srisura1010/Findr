"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ThemeId } from "@/lib/themes";
import { applyTheme } from "@/lib/applyTheme";
type FontSize = "sm" | "md" | "lg" | "xl";
type FontFamily = "sans" | "serif" | "mono";
type Language = "en" | "es" | "fr" | "de";

interface SettingsContextType {
  theme: ThemeId;
  fontSize: FontSize;
  fontFamily: FontFamily;
  language: Language;
  setTheme: (t: ThemeId) => void;
  setFontSize: (s: FontSize) => void;
  setFontFamily: (f: FontFamily) => void;
  setLanguage: (l: Language) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

// Helper for reading initial values from localStorage.
//
// Note: During SSR, `window` does not exist, so we always return the fallback.
function getInitial<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) as T ?? fallback;
}

export function SettingsProvider({ children }: { children: React.ReactNode; }) {
  const [theme, setTheme] = useState<ThemeId>("light");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setTheme(getInitial<ThemeId>("theme", "light"));
    setFontSize(getInitial("fontSize", "md"));
    setFontFamily(getInitial("fontFamily", "sans"));
    setLanguage(getInitial("language", "en"));
  }, []);

  useEffect(() => {
    applyTheme(theme);
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.fontFamily = fontFamily;
  }, [theme, fontSize, fontFamily]);

  // Persist changes.
  useEffect(() => {
    localStorage.setItem("theme", theme);
    localStorage.setItem("fontSize", fontSize);
    localStorage.setItem("fontFamily", fontFamily);
    localStorage.setItem("language", language);
  }, [theme, fontSize, fontFamily, language]);

  return (
    <SettingsContext.Provider value={{ theme, fontSize, fontFamily, language, setTheme, setFontSize, setFontFamily, setLanguage }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  // Guard against using the hook outside of the provider (common React error).
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
};
