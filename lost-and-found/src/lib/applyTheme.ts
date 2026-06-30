import { themes, ThemeId } from "./themes";
import { generateThemeVars, loadCustomConfig } from "./generateTheme";

//sets CSS variables and body class for the given theme id
export function applyTheme(id: ThemeId) {
  const root = document.documentElement;

  //custom themes are stored in localStorage and need to be generated at runtime
  if (id.startsWith("custom-")) {
    const config = loadCustomConfig(id);
    if (config) {
      const vars = generateThemeVars(config);
      Object.entries(vars).forEach(([key, val]) => root.style.setProperty(key, val));
    }
    document.body.className = id;
    return;
  }

  //preset themes have their vars baked into the themes map
  const theme = themes[id];
  Object.entries(theme.vars).forEach(([key, val]) => root.style.setProperty(key, val));
  document.body.className = id;
}
