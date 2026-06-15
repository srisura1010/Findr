import { themes, ThemeId } from "./themes";
import { generateThemeVars, loadCustomConfig } from "./generateTheme";

export function applyTheme(id: ThemeId) {
  const root = document.documentElement;

  if (id.startsWith("custom-")) {
    const config = loadCustomConfig(id);
    if (config) {
      const vars = generateThemeVars(config);
      Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val));
    }
    document.body.className = id;
    return;
  }

  const theme = themes[id];
  Object.entries(theme.vars).forEach(([key, val]) => root.style.setProperty(key, val));
  document.body.className = id;
}
