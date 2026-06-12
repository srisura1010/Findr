"use client";

import React, { useEffect, useState } from "react";
import { useSettings } from "@/context/SettingsContext";
import { useTTS } from "@/context/TTSContext";
import { useUser } from "@clerk/nextjs";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import "./settings.css";
import LoadingSpinner from "@/app/components/LoadingSpinner";

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

  // ── Ban check ──
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

  // ── Translations ──
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
        { key: "Midnight", setter: setMidnightText, cacheKey: "settings_midnight" },
        { key: "Ocean", setter: setOceanText, cacheKey: "settings_ocean" },
        { key: "Forest", setter: setForestText, cacheKey: "settings_forest" },
        { key: "Sunset", setter: setSunsetText, cacheKey: "settings_sunset" },
        { key: "High Contrast", setter: setHighContrastText, cacheKey: "settings_highContrast" },
        { key: "Protanope", setter: setProtanopeText, cacheKey: "settings_protanope" },
        { key: "Deuteranope", setter: setDeuteranopeText, cacheKey: "settings_deuteranope" },
        { key: "Tritanope", setter: setTritanopeText, cacheKey: "settings_tritanope" },
        { key: "Standard", setter: setStandardGroupText, cacheKey: "settings_standard" },
        { key: "Dark Variants", setter: setDarkVariantsGroupText, cacheKey: "settings_darkVariants" },
        { key: "Accessibility", setter: setAccessibilityGroupText, cacheKey: "settings_accessibility" },
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

  return (
    <div className="settings-page" id="settings-page">
      <div className="settings-card">
        <h1>{settingsTitleText}</h1>

        <section className="settings-section">
          <h3>{appearanceText}</h3>
          <p className="settings-description">{standardGroupText}</p>
          <div className="theme-options">
            <button
              className={theme === "light" ? "active" : ""}
              onClick={() => setTheme("light")}
            >
              {lightText}
            </button>
            <button
              className={theme === "dark" ? "active" : ""}
              onClick={() => setTheme("dark")}
            >
              {darkText}
            </button>
          </div>
          <p className="settings-description" style={{ marginTop: "14px" }}>{darkVariantsGroupText}</p>
          <div className="theme-options">
            <button
              className={theme === "midnight" ? "active" : ""}
              onClick={() => setTheme("midnight")}
            >
              {midnightText}
            </button>
            <button
              className={theme === "ocean" ? "active" : ""}
              onClick={() => setTheme("ocean")}
            >
              {oceanText}
            </button>
            <button
              className={theme === "forest" ? "active" : ""}
              onClick={() => setTheme("forest")}
            >
              {forestText}
            </button>
            <button
              className={theme === "sunset" ? "active" : ""}
              onClick={() => setTheme("sunset")}
            >
              {sunsetText}
            </button>
          </div>
          <p className="settings-description" style={{ marginTop: "14px" }}>{accessibilityGroupText}</p>
          <div className="theme-options">
            <button
              className={theme === "high-contrast" ? "active" : ""}
              onClick={() => setTheme("high-contrast")}
            >
              {highContrastText}
            </button>
            <button
              className={theme === "protanope" ? "active" : ""}
              onClick={() => setTheme("protanope")}
            >
              {protanopeText}
            </button>
            <button
              className={theme === "deuteranope" ? "active" : ""}
              onClick={() => setTheme("deuteranope")}
            >
              {deuteranopeText}
            </button>
            <button
              className={theme === "tritanope" ? "active" : ""}
              onClick={() => setTheme("tritanope")}
            >
              {tritanopeText}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>{fontText}</h3>
          <div className="theme-options">
            <button
              className={fontFamily === "sans" ? "active" : ""}
              onClick={() => setFontFamily("sans")}
            >
              Sans-serif
            </button>
            <button
              className={fontFamily === "serif" ? "active" : ""}
              onClick={() => setFontFamily("serif")}
            >
              Serif
            </button>
            <button
              className={fontFamily === "mono" ? "active" : ""}
              onClick={() => setFontFamily("mono")}
            >
              Monospace
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>{fontSizeText}</h3>
          <div className="theme-options">
            <button
              className={fontSize === "sm" ? "active" : ""}
              onClick={() => setFontSize("sm")}
            >
              {smallText}
            </button>
            <button
              className={fontSize === "md" ? "active" : ""}
              onClick={() => setFontSize("md")}
            >
              {mediumText}
            </button>
            <button
              className={fontSize === "lg" ? "active" : ""}
              onClick={() => setFontSize("lg")}
            >
              {largeText}
            </button>
            <button
              className={fontSize === "xl" ? "active" : ""}
              onClick={() => setFontSize("xl")}
            >
              {extraLargeText}
            </button>
          </div>
        </section>

        <section className="settings-section">
          <h3>{languageText}</h3>
          <div className="theme-options">
            <button
              className={language === "en" ? "active" : ""}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
            <button
              className={language === "es" ? "active" : ""}
              onClick={() => setLanguage("es")}
            >
              Español
            </button>
            <button
              className={language === "fr" ? "active" : ""}
              onClick={() => setLanguage("fr")}
            >
              Français
            </button>
            <button
              className={language === "de" ? "active" : ""}
              onClick={() => setLanguage("de")}
            >
              Deutsch
            </button>
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
