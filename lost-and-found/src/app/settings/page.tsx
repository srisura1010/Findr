"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useTTS } from "@/context/TTSContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import "./settings.css";
import LoadingSpinner from "@/app/components/LoadingSpinner";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "zh", label: "中文" },
  { code: "hi", label: "हिन्दी" },
  { code: "ar", label: "العربية" },
  { code: "pt", label: "Português" },
  { code: "bn", label: "বাংলা" },
  { code: "ru", label: "Русский" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "it", label: "Italiano" },
  { code: "tr", label: "Türkçe" },
  { code: "vi", label: "Tiếng Việt" },
  { code: "pl", label: "Polski" },
  { code: "nl", label: "Nederlands" },
  { code: "uk", label: "Українська" },
  { code: "fa", label: "فارسی" },
  { code: "sw", label: "Kiswahili" },
] as const;

const THEME_PREVIEWS: Record<
  string,
  { sky: string; ground: string; mountain: string; sun: string; stroke: string; label: string }
> = {
  light:           { sky: "#dbeafe", ground: "#e0f2fe", mountain: "#bfdbfe", sun: "#fde68a", stroke: "#93c5fd",  label: "Light" },
  dark:            { sky: "#1e293b", ground: "#0f172a", mountain: "#334155", sun: "#f59e0b", stroke: "#475569",  label: "Dark" },
  midnight:        { sky: "#0f0c29", ground: "#1a1040", mountain: "#2d1f6e", sun: "#c084fc", stroke: "#4c1d95",  label: "Midnight" },
  ocean:           { sky: "#0c4a6e", ground: "#075985", mountain: "#0369a1", sun: "#38bdf8", stroke: "#0284c7",  label: "Ocean" },
  forest:          { sky: "#14532d", ground: "#166534", mountain: "#15803d", sun: "#fbbf24", stroke: "#16a34a",  label: "Forest" },
  sunset:          { sky: "#7c2d12", ground: "#9a3412", mountain: "#c2410c", sun: "#fb923c", stroke: "#ea580c",  label: "Sunset" },
  "high-contrast": { sky: "#000000", ground: "#111111", mountain: "#ffffff", sun: "#ffff00", stroke: "#ffffff",  label: "High Contrast" },
  protanope:       { sky: "#1e3a5f", ground: "#162d47", mountain: "#2c5282", sun: "#ecc94b", stroke: "#3182ce",  label: "Protanope" },
  deuteranope:     { sky: "#1a365d", ground: "#153e75", mountain: "#2b6cb0", sun: "#f6e05e", stroke: "#3182ce",  label: "Deuteranope" },
  tritanope:       { sky: "#322659", ground: "#44337a", mountain: "#553c9a", sun: "#f687b3", stroke: "#6b46c1",  label: "Tritanope" },
};

const ThemePreviewSVG = ({
  sky, ground, mountain, sun, stroke,
}: {
  sky: string; ground: string; mountain: string; sun: string; stroke: string;
}) => (
  <svg
    className="theme-card-preview"
    viewBox="0 0 120 90"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <defs>
      <clipPath id="theme-preview-clip">
        <rect width="120" height="90" rx="8" ry="8" />
      </clipPath>
    </defs>
    <g clipPath="url(#theme-preview-clip)">
      <rect width="120" height="90" fill={sky} />
      <rect y="62" width="120" height="28" fill={ground} />
      <circle cx="94" cy="22" r="11" fill={sun} stroke={stroke} strokeWidth="1.5" />
      <polygon
        points="66,10 111,62 21,62"
        fill={mountain}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <polygon
        points="34,32 68,62 0,62"
        fill={mountain}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

const STANDARD_THEMES = ["light", "dark"];
const DARK_THEMES     = ["midnight", "ocean", "forest", "sunset"];
const A11Y_THEMES     = ["high-contrast", "protanope", "deuteranope", "tritanope"];

const FONT_OPTIONS = [
  { value: "sans",     label: "Aa", name: "DM Sans",     className: "font-btn-sans" },
  { value: "inter",    label: "Aa", name: "Inter",        className: "font-btn-inter" },
  { value: "poppins",  label: "Aa", name: "Poppins",      className: "font-btn-poppins" },
  { value: "ubuntu",   label: "Aa", name: "Ubuntu",       className: "font-btn-ubuntu" },
  { value: "serif",    label: "Aa", name: "Merriweather", className: "font-btn-serif" },
  { value: "playfair", label: "Aa", name: "Playfair",     className: "font-btn-playfair" },
  { value: "lora",     label: "Aa", name: "Lora",         className: "font-btn-lora" },
  { value: "mono",     label: "Aa", name: "Source Code",  className: "font-btn-mono" },
];

const SIZE_OPTIONS = [
  { value: "sm", labelKey: "small",      sizeClass: "size-btn-sm" },
  { value: "md", labelKey: "medium",     sizeClass: "size-btn-md" },
  { value: "lg", labelKey: "large",      sizeClass: "size-btn-lg" },
  { value: "xl", labelKey: "extraLarge", sizeClass: "size-btn-xl" },
];

const SettingsPage = () => {
  const {
    theme,
    language,
    fontFamily,
    fontSize,
    setTheme,
    setLanguage,
    setFontFamily,
    setFontSize,
  } = useSettings();
  const {
    enabled: ttsEnabled,
    setEnabled: setTTSEnabled,
    rate: ttsRate,
    setRate: setTTSRate,
  } = useTTS();
  const { user, isLoaded } = useUser();
  const router = useRouter();

  const [isReady, setIsReady] = useState(false);
  const [banChecked, setBanChecked] = useState(false);

  const [appearanceText, setAppearanceText] = useState("Appearance");
  const [languageText, setLanguageText] = useState("Language");
  const [lightText, setLightText] = useState("Light");
  const [darkText, setDarkText] = useState("Dark");
  const [midnightText, setMidnightText] = useState("Midnight");
  const [oceanText, setOceanText] = useState("Ocean");
  const [forestText, setForestText] = useState("Forest");
  const [sunsetText, setSunsetText] = useState("Sunset");
  const [highContrastText, setHighContrastText] = useState("High Contrast");
  const [protanopeText, setProtanopeText] = useState("Protanope");
  const [deuteranopeText, setDeuteranopeText] = useState("Deuteranope");
  const [tritanopeText, setTritanopeText] = useState("Tritanope");
  const [standardGroupText, setStandardGroupText] = useState("Standard");
  const [darkVariantsGroupText, setDarkVariantsGroupText] = useState("Dark Variants");
  const [accessibilityGroupText, setAccessibilityGroupText] = useState("Accessibility");
  const [ttsText, setTTSText] = useState("Text-to-Speech");
  const [enableTTSText, setEnableTTSText] = useState("Enable TTS");
  const [disableTTSText, setDisableTTSText] = useState("Disable TTS");
  const [settingsTitleText, setSettingsTitleText] = useState("Settings");
  const [ttsSpeedText, setTTSSpeedText] = useState("Speed");
  const [fontText, setFontText] = useState("Font");
  const [fontSizeText, setFontSizeText] = useState("Font Size");
  const [smallText, setSmallText] = useState("Small");
  const [mediumText, setMediumText] = useState("Medium");
  const [largeText, setLargeText] = useState("Large");
  const [extraLargeText, setExtraLargeText] = useState("Extra Large");

  const sizeLabels: Record<string, string> = {
    small: smallText,
    medium: mediumText,
    large: largeText,
    extraLarge: extraLargeText,
  };

  const themeLabels: Record<string, string> = {
    light: lightText,
    dark: darkText,
    midnight: midnightText,
    ocean: oceanText,
    forest: forestText,
    sunset: sunsetText,
    "high-contrast": highContrastText,
    protanope: protanopeText,
    deuteranope: deuteranopeText,
    tritanope: tritanopeText,
  };

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) {
      setBanChecked(true);
      return;
    }
    const checkBan = async () => {
      const { data } = await supabase
        .from("banned_users")
        .select("email, suspended_until")
        .eq("email", user.primaryEmailAddress?.emailAddress)
        .single();
      if (data) {
        const isPermanent = !data.suspended_until;
        const isSuspended =
          data.suspended_until && new Date(data.suspended_until) > new Date();
        if (isPermanent || isSuspended) {
          router.push("/banned");
          return;
        }
      }
      setBanChecked(true);
    };
    checkBan();
  }, [user, isLoaded]);

  useEffect(() => {
    if (language === "en") {
      setSettingsTitleText("Settings");
      setAppearanceText("Appearance");
      setLanguageText("Language");
      setLightText("Light");
      setDarkText("Dark");
      setMidnightText("Midnight");
      setOceanText("Ocean");
      setForestText("Forest");
      setSunsetText("Sunset");
      setHighContrastText("High Contrast");
      setProtanopeText("Protanope");
      setDeuteranopeText("Deuteranope");
      setTritanopeText("Tritanope");
      setStandardGroupText("Standard");
      setDarkVariantsGroupText("Dark Variants");
      setAccessibilityGroupText("Accessibility");
      setTTSText("Text-to-Speech");
      setEnableTTSText("Enable TTS");
      setDisableTTSText("Disable TTS");
      setTTSSpeedText("Speed");
      setFontText("Font");
      setFontSizeText("Font Size");
      setSmallText("Small");
      setMediumText("Medium");
      setLargeText("Large");
      setExtraLargeText("Extra Large");
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        { key: "Settings",       setter: setSettingsTitleText,     cacheKey: "settings_title" },
        { key: "Appearance",     setter: setAppearanceText,        cacheKey: "settings_appearance" },
        { key: "Language",       setter: setLanguageText,          cacheKey: "settings_language" },
        { key: "Light",          setter: setLightText,             cacheKey: "settings_light" },
        { key: "Dark",           setter: setDarkText,              cacheKey: "settings_dark" },
        { key: "Midnight",       setter: setMidnightText,          cacheKey: "settings_midnight" },
        { key: "Ocean",          setter: setOceanText,             cacheKey: "settings_ocean" },
        { key: "Forest",         setter: setForestText,            cacheKey: "settings_forest" },
        { key: "Sunset",         setter: setSunsetText,            cacheKey: "settings_sunset" },
        { key: "High Contrast",  setter: setHighContrastText,      cacheKey: "settings_highContrast" },
        { key: "Protanope",      setter: setProtanopeText,         cacheKey: "settings_protanope" },
        { key: "Deuteranope",    setter: setDeuteranopeText,       cacheKey: "settings_deuteranope" },
        { key: "Tritanope",      setter: setTritanopeText,         cacheKey: "settings_tritanope" },
        { key: "Standard",       setter: setStandardGroupText,     cacheKey: "settings_standard" },
        { key: "Dark Variants",  setter: setDarkVariantsGroupText, cacheKey: "settings_darkVariants" },
        { key: "Accessibility",  setter: setAccessibilityGroupText,cacheKey: "settings_accessibility" },
        { key: "Text-to-Speech", setter: setTTSText,               cacheKey: "settings_tts" },
        { key: "Enable TTS",     setter: setEnableTTSText,         cacheKey: "settings_enableTTS" },
        { key: "Disable TTS",    setter: setDisableTTSText,        cacheKey: "settings_disableTTS" },
        { key: "Speed",          setter: setTTSSpeedText,          cacheKey: "settings_ttsSpeed" },
        { key: "Font",           setter: setFontText,              cacheKey: "settings_font" },
        { key: "Font Size",      setter: setFontSizeText,          cacheKey: "settings_fontSize" },
        { key: "Small",          setter: setSmallText,             cacheKey: "settings_small" },
        { key: "Medium",         setter: setMediumText,            cacheKey: "settings_medium" },
        { key: "Large",          setter: setLargeText,             cacheKey: "settings_large" },
        { key: "Extra Large",    setter: setExtraLargeText,        cacheKey: "settings_extraLarge" },
      ];
      for (const { key, setter, cacheKey } of translations) {
        const cached = localStorage.getItem(`${cacheKey}_${language}`);
        if (cached) {
          setter(cached);
          continue;
        }
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: key, target: language }),
          });
          if (res.ok) {
            const data = await res.json();
            const translated = data.translatedText || key;
            setter(translated);
            localStorage.setItem(`${cacheKey}_${language}`, translated);
          }
        } catch {
          /* keep default */
        }
      }
      setIsReady(true);
    };
    translateAndCache();
  }, [language]);

  if (!isLoaded || !banChecked || !isReady) return <LoadingSpinner />;

  const renderThemeGroup = (keys: string[]) =>
    keys.map((key) => {
      const p = THEME_PREVIEWS[key];
      return (
        <button
          key={key}
          className={`theme-card${theme === key ? " active" : ""}`}
          onClick={() => setTheme(key as Parameters<typeof setTheme>[0])}
          aria-label={themeLabels[key] ?? key}
        >
          <ThemePreviewSVG
            sky={p.sky}
            ground={p.ground}
            mountain={p.mountain}
            sun={p.sun}
            stroke={p.stroke}
          />
          <span className="theme-card-label">{themeLabels[key] ?? p.label}</span>
        </button>
      );
    });

  return (
    <div className="settings-page" id="settings-page">
      <div className="settings-card">
        <h1>{settingsTitleText}</h1>

        <section className="settings-section">
          <h3>{appearanceText}</h3>

          <p className="settings-description">{standardGroupText}</p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>
            {renderThemeGroup(STANDARD_THEMES)}
          </div>

          <p className="settings-description">{darkVariantsGroupText}</p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>
            {renderThemeGroup(DARK_THEMES)}
          </div>

          <p className="settings-description">{accessibilityGroupText}</p>
          <div className="theme-grid">
            {renderThemeGroup(A11Y_THEMES)}
          </div>
        </section>

        <section className="settings-section">
          <h3>{fontText}</h3>
          <div className="font-options">
            {FONT_OPTIONS.map(({ value, label, name, className }) => (
              <button
                key={value}
                className={`font-btn ${className}${fontFamily === value ? " active" : ""}`}
                onClick={() => setFontFamily(value as Parameters<typeof setFontFamily>[0])}
              >
                <span>{label}</span>
                <span className="font-btn-name">{name}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>{fontSizeText}</h3>
          <div className="size-options">
            {SIZE_OPTIONS.map(({ value, labelKey, sizeClass }) => (
              <button
                key={value}
                className={`size-btn ${sizeClass}${fontSize === value ? " active" : ""}`}
                onClick={() => setFontSize(value as Parameters<typeof setFontSize>[0])}
              >
                {sizeLabels[labelKey]}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>{languageText}</h3>
          <div className="theme-options">
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                className={language === code ? "active" : ""}
                onClick={() => setLanguage(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className="settings-section">
          <h3>{ttsText}</h3>
          <label className="tts-toggle">
            <span>{ttsEnabled ? disableTTSText : enableTTSText}</span>
            <div
              className={`toggle-switch ${ttsEnabled ? "active" : ""}`}
              onClick={() => setTTSEnabled(!ttsEnabled)}
            >
              <div className="toggle-knob" />
            </div>
          </label>
          {ttsEnabled && (
            <label className="tts-rate">
              <span>
                {ttsSpeedText}: {ttsRate}x
              </span>
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={ttsRate}
                onChange={(e) => setTTSRate(parseFloat(e.target.value))}
              />
            </label>
          )}
        </section>
      </div>
    </div>
  );
};

export default SettingsPage;