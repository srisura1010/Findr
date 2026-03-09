"use client";

import { useRouter } from "next/navigation";

export default function BannedPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      background: "var(--bg, #0f0f0f)",
      color: "var(--text, #fff)",
      textAlign: "center",
      padding: "2rem"
    }}>
      <div style={{ fontSize: "4rem", marginBottom: "1rem" }}>🚫</div>
      <h1 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: "0.5rem" }}>
        Account Suspended
      </h1>
      <p style={{ color: "var(--text-muted, #888)", maxWidth: "400px", lineHeight: 1.6 }}>
        Your account has been banned or suspended from Findr. If you believe
        this is a mistake, please contact your school administrator.
      </p>
      <button
        onClick={() => router.push("/")}
        style={{
          marginTop: "2rem",
          padding: "10px 24px",
          borderRadius: "8px",
          background: "var(--accent, #6366f1)",
          color: "white",
          border: "none",
          cursor: "pointer",
          fontSize: "0.9rem"
        }}>
        
        Go Home
      </button>
    </div>);

}
