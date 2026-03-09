"use client";
import { createContext, useContext, useEffect, useState, ReactNode } from "react";

// Supported visual themes. These map directly to `class` names placed on the
// <html> and <body> elements, and can be used in CSS selectors.
type Theme = "light" | "dark" | "high-contrast" | "colorblind";

// Theme context props, providing the current theme and a way to update it.
interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

// Create a context for the theme, with default values for server-side rendering.
const ThemeContext = createContext<ThemeContextProps>({
  theme: "light",
  setTheme: () => {}
});

// Colors used by the inline loader (if used).
// Keeping this centralized makes it easy to ensure good contrast per theme.
const THEME_STYLES: Record<Theme, {spinner: string;track: string;}> = {
  "light": { spinner: "#7c3aed", track: "#e8eaf0" },
  "dark": { spinner: "#7c3aed", track: "#1e2d45" },
  "high-contrast": { spinner: "#ffff00", track: "#333300" },
  "colorblind": { spinner: "#003366", track: "#bfdbfe" }
};

// Read the theme from localStorage on the client.
// On the server (or during pre-render), default to `light`.
function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem("theme") as Theme || "light";
}

// ThemeProvider component, managing the theme state and providing it to children.
export const ThemeProvider = ({ children }: {children: ReactNode;}) => {
  
  // The current theme (source of truth).
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  // Used to guard UI that depends on browser-only APIs/values.
  // This helps avoid hydration mismatches when the server rendered `light`
  // but the client has another theme stored.
  const [mounted, setMounted] = useState(false);

  // Set mounted to true when the component is mounted.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Apply theme to the DOM. We use both class names and a data attribute:
  // - classes are convenient for existing CSS
  // - `data-theme` is convenient for attribute selectors
  useEffect(() => {
    // Remove existing theme classes from the body and html elements.
    document.body.classList.remove("light", "dark", "high-contrast", "colorblind");
    document.documentElement.classList.remove("light", "dark", "high-contrast", "colorblind");

    // Add the current theme class to the body and html elements.
    document.body.classList.add(theme);
    document.documentElement.classList.add(theme);

    // Set the data-theme attribute on the html element.
    document.documentElement.setAttribute("data-theme", theme);

    // Store the current theme in localStorage.
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Provide the theme context to children.
  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* `mounted` is intentionally unused here; it can be used by consumers if needed. */}
      {children}
    </ThemeContext.Provider>
  );
};

// ThemedLoader component, displaying a full-screen loader with theme-aware colors.
function ThemedLoader({ theme }: {theme: Theme;}) {
  const { spinner, track } = THEME_STYLES[theme] ?? THEME_STYLES["light"];

  // Full-screen loader that uses theme-aware colors.
  // Note: This component is currently not rendered by ThemeProvider itself.
  return (
    <div style={{
      position: "fixed",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 9999
    }}>
      <div style={{
        width: 40,
        height: 40,
        borderRadius: "50%",
        border: `3px solid ${track}`,
        borderTopColor: spinner,
        animation: "spin 0.65s linear infinite"
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>);

}

export const useTheme = () => useContext(ThemeContext);
