"use client";

import { useRouter } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";

export default function AISearchButton() {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/ai-search")}
      title="AI Search"
      aria-label="AI Search"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 13px",
        borderRadius: 10,
        border: "1.5px solid var(--border-input)",
        background: "var(--bg-input)",
        color: "var(--text-primary)",
        fontFamily: "Poppins, sans-serif",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--accent)";
        btn.style.color = "var(--accent)";
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget as HTMLButtonElement;
        btn.style.borderColor = "var(--border-input)";
        btn.style.color = "var(--text-primary)";
      }}
    >
      <HiSparkles size={16} />
      <span>AI Search</span>
    </button>
  );
}