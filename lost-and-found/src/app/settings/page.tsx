"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useTTS } from "@/context/TTSContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import "./settings.css";
import LoadingSpinner from "@/app/components/LoadingSpinner";
import {
  CustomThemeConfig,
  PresetThemeId,
  loadCustomConfig,
  saveCustomConfig,
  getPreviewColors,
} from "@/lib/generateTheme";
import { applyTheme } from "@/lib/applyTheme";
import { ThemeId } from "@/lib/themes";

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
  {
    sky: string;
    ground: string;
    mountain: string;
    sun: string;
    stroke: string;
    label: string;
  }
> = {
  light: {
    sky: "#dbeafe",
    ground: "#e0f2fe",
    mountain: "#bfdbfe",
    sun: "#fde68a",
    stroke: "#93c5fd",
    label: "Light",
  },
  dark: {
    sky: "#1e293b",
    ground: "#0f172a",
    mountain: "#334155",
    sun: "#f59e0b",
    stroke: "#475569",
    label: "Dark",
  },
  midnight: {
    sky: "#0f0c29",
    ground: "#1a1040",
    mountain: "#2d1f6e",
    sun: "#c084fc",
    stroke: "#4c1d95",
    label: "Midnight",
  },
  ocean: {
    sky: "#0c4a6e",
    ground: "#075985",
    mountain: "#0369a1",
    sun: "#38bdf8",
    stroke: "#0284c7",
    label: "Ocean",
  },
  forest: {
    sky: "#14532d",
    ground: "#166534",
    mountain: "#15803d",
    sun: "#fbbf24",
    stroke: "#16a34a",
    label: "Forest",
  },
  sunset: {
    sky: "#7c2d12",
    ground: "#9a3412",
    mountain: "#c2410c",
    sun: "#fb923c",
    stroke: "#ea580c",
    label: "Sunset",
  },
  dawn: {
    sky: "#ede9fe",
    ground: "#ddd6fe",
    mountain: "#a5b4fc",
    sun: "#fde68a",
    stroke: "#818cf8",
    label: "Dawn",
  },
  lagoon: {
    sky: "#cffafe",
    ground: "#a5f3fc",
    mountain: "#67e8f9",
    sun: "#fde68a",
    stroke: "#22d3ee",
    label: "Lagoon",
  },
  meadow: {
    sky: "#dcfce7",
    ground: "#bbf7d0",
    mountain: "#86efac",
    sun: "#fde68a",
    stroke: "#4ade80",
    label: "Meadow",
  },
  sunrise: {
    sky: "#fff7ed",
    ground: "#ffedd5",
    mountain: "#fed7aa",
    sun: "#f97316",
    stroke: "#fdba74",
    label: "Sunrise",
  },
  "high-contrast": {
    sky: "#000000",
    ground: "#111111",
    mountain: "#ffffff",
    sun: "#ffff00",
    stroke: "#ffffff",
    label: "High Contrast",
  },
  protanope: {
    sky: "#1e3a5f",
    ground: "#162d47",
    mountain: "#2c5282",
    sun: "#ecc94b",
    stroke: "#3182ce",
    label: "Protanope",
  },
  deuteranope: {
    sky: "#1a365d",
    ground: "#153e75",
    mountain: "#2b6cb0",
    sun: "#f6e05e",
    stroke: "#3182ce",
    label: "Deuteranope",
  },
  tritanope: {
    sky: "#322659",
    ground: "#44337a",
    mountain: "#553c9a",
    sun: "#f687b3",
    stroke: "#6b46c1",
    label: "Tritanope",
  },
};

const ThemePreviewSVG = ({
  sky,
  ground,
  mountain,
  sun,
  stroke,
}: {
  sky: string;
  ground: string;
  mountain: string;
  sun: string;
  stroke: string;
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
      <circle
        cx="94"
        cy="22"
        r="11"
        fill={sun}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {/* Back mountain — rounded peak via Q bezier */}
      <path
        d="M 21,62 L 62,14 Q 66,10 70,14 L 111,62 Z"
        fill={mountain}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      {/* Front mountain — rounded peak via Q bezier */}
      <path
        d="M 0,62 L 30,36 Q 34,32 38,36 L 68,62 Z"
        fill={mountain}
        stroke={stroke}
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);

const STANDARD_THEMES = ["light", "dark"];
const DARK_THEMES = ["midnight", "ocean", "forest", "sunset"];
const LIGHT_THEMES = ["dawn", "lagoon", "meadow", "sunrise"];
const A11Y_THEMES = ["high-contrast", "protanope", "deuteranope", "tritanope"];
const CUSTOM_SLOTS = ["custom-1", "custom-2", "custom-3", "custom-4"] as const;
const ALL_PRESET_THEMES = [
  ...STANDARD_THEMES, ...LIGHT_THEMES, ...DARK_THEMES, ...A11Y_THEMES,
];

const FONT_OPTIONS = [
  { value: "sans", name: "Sans Serif", fontFamily: "sans-serif" },
  { value: "inter", name: "Inter", fontFamily: '"Inter", sans-serif' },
  { value: "poppins", name: "Poppins", fontFamily: '"Poppins", sans-serif' },
  { value: "ubuntu", name: "Ubuntu", fontFamily: '"Ubuntu", sans-serif' },
  { value: "serif", name: "Merriweather", fontFamily: '"Merriweather", serif' },
  {
    value: "playfair",
    name: "Playfair",
    fontFamily: '"Playfair Display", serif',
  },
  { value: "lora", name: "Lora", fontFamily: '"Lora", serif' },
  {
    value: "mono",
    name: "Source Code",
    fontFamily: '"Source Code Pro", monospace',
  },
  { value: "nunito", name: "Nunito", fontFamily: '"Nunito", sans-serif' },
  { value: "roboto", name: "Roboto Slab", fontFamily: '"Roboto Slab", serif' },
];

const SIZE_OPTIONS = [
  { value: "sm", labelKey: "small", sizeClass: "size-btn-sm" },
  { value: "md", labelKey: "medium", sizeClass: "size-btn-md" },
  { value: "lg", labelKey: "large", sizeClass: "size-btn-lg" },
  { value: "xl", labelKey: "extraLarge", sizeClass: "size-btn-xl" },
];

const SettingsPage = () => {
  const {
    theme,
    language,
    fontFamily,
    fontSize,
    hydrated,
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

  // Custom theme state
  const [customThemes, setCustomThemes] = useState<Record<string, CustomThemeConfig | null>>({
    "custom-1": null, "custom-2": null, "custom-3": null, "custom-4": null,
  });
  const [editingSlot, setEditingSlot] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBase, setEditBase] = useState<PresetThemeId>("light");
  const [editAccent, setEditAccent] = useState("#6366f1");

  const [appearanceText, setAppearanceText] = useState("Appearance");
  const [languageText, setLanguageText] = useState("Language");
  const [lightText, setLightText] = useState("Light");
  const [darkText, setDarkText] = useState("Dark");
  const [midnightText, setMidnightText] = useState("Midnight");
  const [oceanText, setOceanText] = useState("Ocean");
  const [forestText, setForestText] = useState("Forest");
  const [sunsetText, setSunsetText] = useState("Sunset");
  const [dawnText, setDawnText] = useState("Dawn");
  const [lagoonText, setLagoonText] = useState("Lagoon");
  const [meadowText, setMeadowText] = useState("Meadow");
  const [sunriseText, setSunriseText] = useState("Sunrise");
  const [highContrastText, setHighContrastText] = useState("High Contrast");
  const [protanopeText, setProtanopeText] = useState("Protanope");
  const [deuteranopeText, setDeuteranopeText] = useState("Deuteranope");
  const [tritanopeText, setTritanopeText] = useState("Tritanope");
  const [standardGroupText, setStandardGroupText] = useState("Standard");
  const [darkVariantsGroupText, setDarkVariantsGroupText] =
    useState("Dark Variants");
  const [lightVariantsGroupText, setLightVariantsGroupText] =
    useState("Light Variants");
  const [accessibilityGroupText, setAccessibilityGroupText] =
    useState("Accessibility");
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
  const [customGroupText, setCustomGroupText] = useState("Custom");
  const [cteNameLabel, setCteNameLabel] = useState("Name");
  const [cteBaseLabel, setCteBaseLabel] = useState("Base");
  const [cteAccentLabel, setCteAccentLabel] = useState("Accent");
  const [cteSaveBtn, setCteSaveBtn] = useState("Save & Apply");
  const [cteRemoveBtn, setCteRemoveBtn] = useState("Remove");
  const [cteCancelBtn, setCteCancelBtn] = useState("Cancel");

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
    dawn: dawnText,
    lagoon: lagoonText,
    meadow: meadowText,
    sunrise: sunriseText,
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

  // Load custom theme configs from localStorage on mount
  useEffect(() => {
    const loaded: Record<string, CustomThemeConfig | null> = {};
    CUSTOM_SLOTS.forEach((id) => { loaded[id] = loadCustomConfig(id); });
    setCustomThemes(loaded);
  }, []);

  function openEditor(id: string, existing: CustomThemeConfig | null) {
    setEditingSlot(id);
    setEditName(existing?.name ?? `Custom ${id.split("-")[1]}`);
    setEditBase((existing?.base ?? "light") as PresetThemeId);
    setEditAccent(existing?.accent ?? "#6366f1");
  }

  function handleSaveCustom() {
    if (!editingSlot) return;
    const config: CustomThemeConfig = { name: editName || `Custom ${editingSlot.split("-")[1]}`, accent: editAccent, base: editBase };
    saveCustomConfig(editingSlot, config);
    setCustomThemes((prev) => ({ ...prev, [editingSlot]: config }));
    setTheme(editingSlot as ThemeId);
    applyTheme(editingSlot as ThemeId);
    setEditingSlot(null);
  }

  function handleDeleteCustom() {
    if (!editingSlot) return;
    saveCustomConfig(editingSlot, null);
    setCustomThemes((prev) => ({ ...prev, [editingSlot]: null }));
    if (theme === editingSlot) setTheme("light");
    setEditingSlot(null);
  }

  useEffect(() => {
    if (!hydrated) return;
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
      setDawnText("Dawn");
      setLagoonText("Lagoon");
      setMeadowText("Meadow");
      setSunriseText("Sunrise");
      setHighContrastText("High Contrast");
      setProtanopeText("Protanope");
      setDeuteranopeText("Deuteranope");
      setTritanopeText("Tritanope");
      setStandardGroupText("Standard");
      setDarkVariantsGroupText("Dark Variants");
      setLightVariantsGroupText("Light Variants");
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
      setCustomGroupText("Custom");
      setCteNameLabel("Name");
      setCteBaseLabel("Base");
      setCteAccentLabel("Accent");
      setCteSaveBtn("Save & Apply");
      setCteRemoveBtn("Remove");
      setCteCancelBtn("Cancel");
      setIsReady(true);
      return;
    }
    const translateAndCache = async () => {
      const translations = [
        {
          key: "Settings",
          setter: setSettingsTitleText,
          cacheKey: "settings_title",
        },
        {
          key: "Appearance",
          setter: setAppearanceText,
          cacheKey: "settings_appearance",
        },
        {
          key: "Language",
          setter: setLanguageText,
          cacheKey: "settings_language",
        },
        { key: "Light", setter: setLightText, cacheKey: "settings_light" },
        { key: "Dark", setter: setDarkText, cacheKey: "settings_dark" },
        {
          key: "Midnight",
          setter: setMidnightText,
          cacheKey: "settings_midnight",
        },
        { key: "Ocean", setter: setOceanText, cacheKey: "settings_ocean" },
        { key: "Forest", setter: setForestText, cacheKey: "settings_forest" },
        { key: "Sunset", setter: setSunsetText, cacheKey: "settings_sunset" },
        { key: "Dawn", setter: setDawnText, cacheKey: "settings_dawn" },
        { key: "Lagoon", setter: setLagoonText, cacheKey: "settings_lagoon" },
        { key: "Meadow", setter: setMeadowText, cacheKey: "settings_meadow" },
        { key: "Sunrise", setter: setSunriseText, cacheKey: "settings_sunrise" },
        {
          key: "High Contrast",
          setter: setHighContrastText,
          cacheKey: "settings_highContrast",
        },
        {
          key: "Protanope",
          setter: setProtanopeText,
          cacheKey: "settings_protanope",
        },
        {
          key: "Deuteranope",
          setter: setDeuteranopeText,
          cacheKey: "settings_deuteranope",
        },
        {
          key: "Tritanope",
          setter: setTritanopeText,
          cacheKey: "settings_tritanope",
        },
        {
          key: "Standard",
          setter: setStandardGroupText,
          cacheKey: "settings_standard",
        },
        {
          key: "Dark Variants",
          setter: setDarkVariantsGroupText,
          cacheKey: "settings_darkVariants",
        },
        {
          key: "Light Variants",
          setter: setLightVariantsGroupText,
          cacheKey: "settings_lightVariants",
        },
        {
          key: "Accessibility",
          setter: setAccessibilityGroupText,
          cacheKey: "settings_accessibility",
        },
        { key: "Text-to-Speech", setter: setTTSText, cacheKey: "settings_tts" },
        {
          key: "Enable TTS",
          setter: setEnableTTSText,
          cacheKey: "settings_enableTTS",
        },
        {
          key: "Disable TTS",
          setter: setDisableTTSText,
          cacheKey: "settings_disableTTS",
        },
        {
          key: "Speed",
          setter: setTTSSpeedText,
          cacheKey: "settings_ttsSpeed",
        },
        { key: "Font", setter: setFontText, cacheKey: "settings_font" },
        {
          key: "Font Size",
          setter: setFontSizeText,
          cacheKey: "settings_fontSize",
        },
        { key: "Small", setter: setSmallText, cacheKey: "settings_small" },
        { key: "Medium", setter: setMediumText, cacheKey: "settings_medium" },
        { key: "Large", setter: setLargeText, cacheKey: "settings_large" },
        {
          key: "Extra Large",
          setter: setExtraLargeText,
          cacheKey: "settings_extraLarge",
        },
        { key: "Custom", setter: setCustomGroupText, cacheKey: "settings_custom" },
        { key: "Name", setter: setCteNameLabel, cacheKey: "settings_cteName" },
        { key: "Base", setter: setCteBaseLabel, cacheKey: "settings_cteBase" },
        { key: "Accent", setter: setCteAccentLabel, cacheKey: "settings_cteAccent" },
        { key: "Save & Apply", setter: setCteSaveBtn, cacheKey: "settings_cteSave" },
        { key: "Remove", setter: setCteRemoveBtn, cacheKey: "settings_cteRemove" },
        { key: "Cancel", setter: setCteCancelBtn, cacheKey: "settings_cteCancel" },
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
  }, [language, hydrated]);

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
          <span className="theme-card-label">
            {themeLabels[key] ?? p.label}
          </span>
        </button>
      );
    });

  return (
    <div className="settings-page" id="settings-page">
      <div className="settings-card">
        <h1>{settingsTitleText}</h1>

        <section className="settings-section">
          <h3>{appearanceText}</h3>

          <p className="settings-description"><i>{standardGroupText}</i></p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>
            {renderThemeGroup(STANDARD_THEMES)}
          </div>

          <p className="settings-description"><i>{lightVariantsGroupText}</i></p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>
            {renderThemeGroup(LIGHT_THEMES)}
          </div>

          <p className="settings-description"><i>{darkVariantsGroupText}</i></p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>
            {renderThemeGroup(DARK_THEMES)}
          </div>

          <p className="settings-description"><i>{accessibilityGroupText}</i></p>
          <div className="theme-grid" style={{ marginBottom: "18px" }}>{renderThemeGroup(A11Y_THEMES)}</div>

          <p className="settings-description"><i>{customGroupText}</i></p>
          <div className="theme-grid" style={{ marginBottom: "14px" }}>
            {CUSTOM_SLOTS.map((id, i) => {
              const config = customThemes[id];
              const isActive = theme === id;
              const isEditing = editingSlot === id;
              const preview = config ? getPreviewColors(config) : null;
              return (
                <div
                  key={id}
                  className={`theme-card${isActive ? " active" : ""}${isEditing ? " editing" : ""}`}
                  style={{ display: "flex", flexDirection: "column", padding: 0 }}
                >
                  <button
                    style={{ all: "unset", cursor: "pointer", display: "block" }}
                    onClick={() => {
                      if (config) {
                        setTheme(id as ThemeId);
                        applyTheme(id as ThemeId);
                      } else {
                        openEditor(id, null);
                      }
                    }}
                    aria-label={config ? config.name : `${customGroupText} ${i + 1}`}
                  >
                    {preview ? (
                      <ThemePreviewSVG
                        sky={preview.sky}
                        ground={preview.ground}
                        mountain={preview.mountain}
                        sun={preview.sun}
                        stroke={preview.stroke}
                      />
                    ) : (
                      <div className="custom-slot-empty">+</div>
                    )}
                  </button>
                  <div className="custom-slot-footer">
                    <span className="theme-card-label">
                      {config ? config.name : `${customGroupText} ${i + 1}`}
                    </span>
                    <button
                      className="custom-slot-edit-btn"
                      onClick={() => isEditing ? setEditingSlot(null) : openEditor(id, config)}
                      aria-label="Edit"
                    >
                      {isEditing ? "✕" : "✏"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {editingSlot && (
            <div className="custom-theme-editor">
              <div className="cte-row">
                <span className="cte-label">{cteNameLabel}</span>
                <input
                  className="cte-name-input"
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={`Custom ${editingSlot.split("-")[1]}`}
                  maxLength={24}
                />
              </div>
              <div className="cte-row cte-base-row">
                <span className="cte-label">{cteBaseLabel}</span>
                <div className="cte-base-grid">
                  {ALL_PRESET_THEMES.map((id) => {
                    const p = THEME_PREVIEWS[id];
                    return (
                      <button
                        key={id}
                        className={`cte-base-option${editBase === id ? " active" : ""}`}
                        onClick={() => setEditBase(id as PresetThemeId)}
                        title={p?.label ?? id}
                      >
                        <ThemePreviewSVG
                          sky={p.sky}
                          ground={p.ground}
                          mountain={p.mountain}
                          sun={p.sun}
                          stroke={p.stroke}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="cte-row">
                <span className="cte-label">{cteAccentLabel}</span>
                <div className="cte-color-row">
                  <input
                    className="cte-color-input"
                    type="color"
                    value={editAccent}
                    onChange={(e) => setEditAccent(e.target.value)}
                  />
                  <span className="cte-hex">{editAccent.toUpperCase()}</span>
                </div>
              </div>
              <div className="cte-bottom">
                <div className="cte-preview-wrap">
                  <ThemePreviewSVG
                    {...getPreviewColors({ name: editName, accent: editAccent, base: editBase })}
                  />
                </div>
                <div className="cte-actions">
                  <button className="cte-save" onClick={handleSaveCustom}>{cteSaveBtn}</button>
                  {customThemes[editingSlot] && (
                    <button className="cte-delete" onClick={handleDeleteCustom}>{cteRemoveBtn}</button>
                  )}
                  <button className="cte-cancel" onClick={() => setEditingSlot(null)}>{cteCancelBtn}</button>
                </div>
              </div>
            </div>
          )}
        </section>

        <section className="settings-section">
          <h3>{fontText}</h3>
          <div className="font-options">
            {FONT_OPTIONS.map(({ value, name, fontFamily: ff }) => (
              <button
                key={value}
                className={`font-btn${fontFamily === value ? " active" : ""}`}
                onClick={() =>
                  setFontFamily(value as Parameters<typeof setFontFamily>[0])
                }
              >
                <span style={{ fontFamily: ff }}>{"Aa"}</span>
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
                onClick={() =>
                  setFontSize(value as Parameters<typeof setFontSize>[0])
                }
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
