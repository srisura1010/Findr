import { themes, ThemeId } from "./themes";

export type PresetThemeId = Exclude<ThemeId, "custom-1" | "custom-2" | "custom-3" | "custom-4">;

//shape of a user-created custom theme stored in localStorage
export interface CustomThemeConfig {
  name: string;
  accent: string;
  base: PresetThemeId;
}

//reads a custom theme config from localStorage, returns null on SSR or missing
export function loadCustomConfig(id: string): CustomThemeConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`customTheme_${id}`);
    return raw ? (JSON.parse(raw) as CustomThemeConfig) : null;
  } catch {
    return null;
  }
}

//writes or removes a custom theme config in localStorage
export function saveCustomConfig(id: string, config: CustomThemeConfig | null): void {
  if (config === null) {
    localStorage.removeItem(`customTheme_${id}`);
  } else {
    localStorage.setItem(`customTheme_${id}`, JSON.stringify(config));
  }
}

//converts a hex color string to [h, s, l] degrees/percent
function hexToHSL(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

//returns a clamped hsl() string
function hsl(h: number, s: number, l: number): string {
  return `hsl(${Math.round(h)},${Math.round(Math.max(0, Math.min(100, s)))}%,${Math.round(Math.max(0, Math.min(100, l)))}%)`;
}

//returns a clamped hsla() string with alpha
function hsla(h: number, s: number, l: number, a: number): string {
  return `hsla(${Math.round(h)},${Math.round(Math.max(0, Math.min(100, s)))}%,${Math.round(Math.max(0, Math.min(100, l)))}%,${a})`;
}

//returns true if the preset theme id belongs to a dark group
function isDarkBase(id: PresetThemeId): boolean {
  const group = themes[id].group;
  return group === "dark-variants" || id === "dark" || id === "high-contrast";
}

//returns simplified colors used to render the theme preview swatch
export function getPreviewColors(config: CustomThemeConfig) {
  const baseVars = themes[config.base]?.vars ?? {};
  const [h, s, l] = hexToHSL(config.accent);
  const dark = isDarkBase(config.base);
  const stroke = dark
    ? hsl(h, Math.min(s * 0.6, 58), Math.max(l - 22, 14))
    : hsl(h, Math.min(s, 60), 73);
  return {
    sky:      baseVars["--bg-page"]   || (dark ? "#0b1120" : "#f5f3ff"),
    ground:   baseVars["--bg-input"]  || (dark ? "#1a2540" : "#ede9fe"),
    mountain: baseVars["--bg-active"] || (dark ? "#1e1545" : "#ddd6fe"),
    sun:    config.accent,
    stroke,
  };
}

//generates the full set of CSS variable overrides for a custom theme based on its accent color and base preset
export function generateThemeVars(config: CustomThemeConfig): Record<string, string> {
  const { accent, base } = config;
  const [h, s, l] = hexToHSL(accent);
  const sat = Math.max(40, s);
  const dark = isDarkBase(base);

  const baseVars = { ...themes[base].vars };

  let accentHover: string;
  let accentLight: string;
  let accentBorder: string;
  let textActive: string;
  let bgActive: string;

  if (dark) {
    accentHover  = hsl(h, sat, Math.max(l - 9, 18));
    accentLight  = hsl(h, Math.min(sat * 0.4, 38), 13);
    accentBorder = hsl(h, Math.min(sat * 0.6, 58), Math.max(l - 22, 14));
    textActive   = hsl(h, Math.min(sat * 0.55, 75), Math.min(l + 18, 82));
    bgActive     = hsl(h, Math.min(sat * 0.4, 38), 13);
  } else {
    accentHover  = hsl(h, sat, Math.max(l - 9, 18));
    accentLight  = hsl(h, Math.min(sat, 55), 87);
    accentBorder = hsl(h, Math.min(sat, 60), 73);
    textActive   = hsl(h, Math.min(sat, 65), 33);
    bgActive     = hsl(h, Math.min(sat * 0.54, 50), 86);
  }

  const overrides: Record<string, string> = {
    "--border-focus":          accent,
    "--text-active":           textActive,
    "--text-active-tab":       textActive,
    "--accent":                accent,
    "--accent-hover":          accentHover,
    "--accent-light":          accentLight,
    "--accent-border":         accentBorder,
    "--card-shadow":           dark ? `0 2px 16px ${hsla(h, s, l, 0.15)}` : `0 2px 12px ${hsla(h, s, l, 0.08)}`,
    "--card-hover-shadow":     dark ? `0 0 20px ${hsla(h, s, l, 0.35)},0 0 40px ${hsla(h, s, l, 0.15)}` : `0 12px 32px ${hsla(h, s, l, 0.16)}`,
    "--toggle-on":             accent,
    "--scrollbar-thumb":       accentBorder,
    "--bg-active":             bgActive,
    "--bg-active-tab":         bgActive,
    "--chip-hover-bg":         bgActive,
    "--chip-hover-border":     accentBorder,
    "--glass-border":          dark ? "rgba(255,255,255,0.08)" : hsla(h, s, l, 0.20),
    "--glass-shadow":          dark ? "0 8px 32px rgba(0,0,0,0.45)" : `0 8px 32px ${hsla(h, s, l, 0.10)}`,
    "--help-accent":           accent,
    "--help-accent-light":     accentLight,
    "--help-accent-text":      textActive,
    "--help-active-bg":        accent,
    "--help-active-border":    accent,
    "--help-dot":              accent,
    "--help-arrow":            accent,
    "--help-send-active":      accent,
    "--help-shadow":           dark ? "0 20px 40px rgba(0,0,0,0.35)" : `0 20px 40px ${hsla(h, s, l, 0.10)}`,
    "--sa-accent":             accent,
    "--sa-accent-light":       accentLight,
    "--sa-link":               textActive,
    "--sa-shadow":             dark ? "0 20px 40px rgba(0,0,0,0.35)" : `0 20px 40px ${hsla(h, s, l, 0.10)}`,
    "--msg-bg-active":         bgActive,
    "--msg-bg-bubble-own":     accent,
    "--msg-border-active":     accent,
    "--msg-text-active":       textActive,
    "--msg-accent":            accent,
    "--msg-accent-light":      accentLight,
    "--msg-accent-blue":       accentHover,
    "--msg-accent-blue-light": accentLight,
    "--msg-unread-dot":        accent,
    "--msg-admin-grad":        `linear-gradient(135deg,${accentHover},${accent})`,
    "--msg-avatar-bg":         accent,
    "--msg-send-active":       accent,
    "--msg-shadow-bubble":     dark ? `0 2px 8px ${hsla(h, s, l, 0.35)}` : `0 2px 8px ${hsla(h, s, l, 0.20)}`,
  };

  return { ...baseVars, ...overrides };
}
