import { themes, ThemeId } from "./themes";

export function applyTheme(id: ThemeId) {
  const theme = themes[id];
  const root = document.documentElement;
  Object.entries(theme.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });
  document.body.className = id;
}
