"use client";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

type Theme = "light" | "dark" | "high-contrast" | "colorblind";

interface ThemeContextProps {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: "light",
  setTheme: () => {},
});

const THEME_STYLES: Record<Theme, { spinner: string; track: string }> = {
  light: { spinner: "#7c3aed", track: "#e8eaf0" },
  dark: { spinner: "#7c3aed", track: "#1e2d45" },
  "high-contrast": { spinner: "#ffff00", track: "#333300" },
  colorblind: { spinner: "#003366", track: "#bfdbfe" },
};

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("theme") as Theme) || "light";
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Read localStorage synchronously — no flash, no re-render needed
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    document.body.classList.remove(
      "light",
      "dark",
      "high-contrast",
      "colorblind",
    );
    document.body.classList.add(theme);
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.classList.remove(
      "light",
      "dark",
      "high-contrast",
      "colorblind",
    );
    document.documentElement.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* Show themed spinner only before mount, then render children */}
      {children}
    </ThemeContext.Provider>
  );
};

function ThemedLoader({ theme }: { theme: Theme }) {
  const { spinner, track } = THEME_STYLES[theme] ?? THEME_STYLES["light"];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `3px solid ${track}`,
          borderTopColor: spinner,
          animation: "spin 0.65s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export const useTheme = () => useContext(ThemeContext);
