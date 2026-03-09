"use client";

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark" | "high-contrast" | "colorblind";
type FontSize = "sm" | "md" | "lg" | "xl";
type FontFamily = "sans" | "serif" | "mono";
type Language = "en" | "es" | "fr" | "de";

interface SettingsContextType {
  theme: Theme;
  fontSize: FontSize;
  fontFamily: FontFamily;
  language: Language;
  setTheme: (t: Theme) => void;
  setFontSize: (s: FontSize) => void;
  setFontFamily: (f: FontFamily) => void;
  setLanguage: (l: Language) => void;
}

const SettingsContext = createContext<SettingsContextType | null>(null);

function getInitial<T extends string>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  return localStorage.getItem(key) as T ?? fallback;
}

export function SettingsProvider({ children }: {children: React.ReactNode;}) {
  const [theme, setTheme] = useState<Theme>("light");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [language, setLanguage] = useState<Language>("en");

  useEffect(() => {
    setTheme(getInitial("theme", "light"));
    setFontSize(getInitial("fontSize", "md"));
    setFontFamily(getInitial("fontFamily", "sans"));
    setLanguage(getInitial("language", "en"));
  }, []);

  useEffect(() => {
    document.body.classList.remove("light", "dark", "high-contrast", "colorblind");
    document.body.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.fontFamily = fontFamily;
  }, [theme, fontSize, fontFamily]);

  useEffect(() => {
    localStorage.setItem("theme", theme);
    localStorage.setItem("fontSize", fontSize);
    localStorage.setItem("fontFamily", fontFamily);
    localStorage.setItem("language", language);
  }, [theme, fontSize, fontFamily, language]);

  return (
    <SettingsContext.Provider value={{ theme, fontSize, fontFamily, language, setTheme, setFontSize, setFontFamily, setLanguage }}>
      {children}
    </SettingsContext.Provider>);

}

export const useSettings = () => {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
};
