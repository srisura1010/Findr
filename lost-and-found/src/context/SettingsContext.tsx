"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { ThemeId } from "@/lib/themes";
import { applyTheme } from "@/lib/applyTheme";
import { useUser } from "@clerk/nextjs";
type FontSize = "sm" | "md" | "lg" | "xl";
type FontFamily =
  | "sans"
  | "serif"
  | "mono"
  | "inter"
  | "poppins"
  | "ubuntu"
  | "playfair"
  | "lora"
  | "nunito"
  | "roboto";
type Language =
  | "en"
  | "es"
  | "fr"
  | "de"
  | "zh"
  | "hi"
  | "ar"
  | "pt"
  | "bn"
  | "ru"
  | "ja"
  | "ko"
  | "it"
  | "tr"
  | "vi"
  | "pl"
  | "nl"
  | "uk"
  | "fa"
  | "sw";

interface SettingsContextType {
  theme: ThemeId;
  fontSize: FontSize;
  fontFamily: FontFamily;
  language: Language;
  hydrated: boolean;
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
  return (localStorage.getItem(key) as T) ?? fallback;
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [theme, setTheme] = useState<ThemeId>("light");
  const [fontSize, setFontSize] = useState<FontSize>("md");
  const [fontFamily, setFontFamily] = useState<FontFamily>("sans");
  const [language, setLanguage] = useState<Language>("en");
  // Prevents the persist effect from writing defaults before settings are loaded.
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (!isLoaded) return;
    // Clerk metadata travels with the account across devices; localStorage is the fallback.
    const meta = (user?.unsafeMetadata ?? {}) as Record<string, string>;
    const get = <T extends string>(k: string, fallback: T): T =>
      (meta[k] as T) ?? getInitial(k, fallback);
    setTheme(get<ThemeId>("theme", "light"));
    setFontSize(get("fontSize", "md"));
    setFontFamily(get("fontFamily", "sans"));
    setLanguage(get("language", "en"));
    setHydrated(true);
  }, [isLoaded, user?.id]);

  const fontMap: Record<string, string> = {
    sans: '"DM Sans", sans-serif',
    inter: '"Inter", sans-serif',
    poppins: '"Poppins", sans-serif',
    ubuntu: '"Ubuntu", sans-serif',
    serif: '"Merriweather", serif',
    playfair: '"Playfair Display", serif',
    lora: '"Lora", serif',
    mono: '"Source Code Pro", monospace',
    nunito: '"Nunito", sans-serif',
    roboto: '"Roboto Slab", serif',
  };

  useEffect(() => {
    applyTheme(theme);
    document.documentElement.dataset.fontSize = fontSize;
    document.documentElement.dataset.fontFamily = fontFamily;
    document.documentElement.style.setProperty(
      "--font-body",
      fontMap[fontFamily] ?? '"DM Sans", sans-serif',
    );
  }, [theme, fontSize, fontFamily]);

  // Persist changes to localStorage and (when signed in) to Clerk metadata so
  // settings follow the user across devices and browsers.
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem("theme", theme);
    localStorage.setItem("fontSize", fontSize);
    localStorage.setItem("fontFamily", fontFamily);
    localStorage.setItem("language", language);
    if (user) {
      user.update({ unsafeMetadata: { theme, fontSize, fontFamily, language } }).catch(() => {});
    }
  }, [theme, fontSize, fontFamily, language, hydrated]);

  return (
    <SettingsContext.Provider
      value={{
        theme,
        fontSize,
        fontFamily,
        language,
        hydrated,
        setTheme,
        setFontSize,
        setFontFamily,
        setLanguage,
      }}
    >
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
