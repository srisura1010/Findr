"use client";
import {
  createContext,
  useContext,
  useState,
  ReactNode,
} from "react";
import { ThemeId } from "@/lib/themes";

interface ThemeContextProps {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  theme: "light",
  setTheme: () => {},
});

const THEME_STYLES: Record<ThemeId, { spinner: string; track: string }> = {
  light:          { spinner: "#2f80ed", track: "#e8eaf0" },
  dark:           { spinner: "#7c3aed", track: "#1e2d45" },
  midnight:       { spinner: "#6366f1", track: "#1e2d45" },
  ocean:          { spinner: "#06b6d4", track: "#1a3040" },
  forest:         { spinner: "#22c55e", track: "#1a3828" },
  sunset:         { spinner: "#f97316", track: "#3a2210" },
  dawn:           { spinner: "#6366f1", track: "#ddd6fe" },
  lagoon:         { spinner: "#06b6d4", track: "#a5f3fc" },
  meadow:         { spinner: "#22c55e", track: "#bbf7d0" },
  sunrise:        { spinner: "#f97316", track: "#fed7aa" },
  "high-contrast":{ spinner: "#ffff00", track: "#333300" },
  protanope:      { spinner: "#0050cc", track: "#a8bcd8" },
  deuteranope:    { spinner: "#003366", track: "#bfdbfe" },
  tritanope:      { spinner: "#ec4899", track: "#f9a8d4" },
  "custom-1":     { spinner: "#2f80ed", track: "#e8eaf0" },
  "custom-2":     { spinner: "#2f80ed", track: "#e8eaf0" },
  "custom-3":     { spinner: "#2f80ed", track: "#e8eaf0" },
  "custom-4":     { spinner: "#2f80ed", track: "#e8eaf0" },
};

function getInitialTheme(): ThemeId {
  if (typeof window === "undefined") return "light";
  return (localStorage.getItem("theme") as ThemeId) || "light";
}

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<ThemeId>(getInitialTheme);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {/* Show themed spinner only before mount, then render children */}
      {children}
    </ThemeContext.Provider>
  );
};

function ThemedLoader({ theme }: { theme: ThemeId }) {
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
