"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";
import { IoClose } from "react-icons/io5";
import { ImSearch } from "react-icons/im";

interface CircleItem {
  id: number;
  name: string;
  image: string | null;
  category: string | null;
  location: string | null;
  status: string;
  score: number;
}

interface SelectedItem extends CircleItem {
  index: number;
}

const ORBIT_RADIUS = 160;
const CENTER_X = 210;
const CENTER_Y = 210;
const SPIN_SPEED = 0.003;

function CircleDiscover() {
  const router = useRouter();
  const rafRef = useRef<number | null>(null);
  const anglesRef = useRef<number[]>([]);
  const pausedRef = useRef(false);

  const [items, setItems] = useState<CircleItem[]>([]);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [chipPositions, setChipPositions] = useState<
    { x: number; y: number }[]
  >([]);

  const tick = useCallback(() => {
    if (!pausedRef.current) {
      anglesRef.current = anglesRef.current.map((a) => a + SPIN_SPEED);
    }
    if (anglesRef.current.length > 0) {
      setChipPositions(
        anglesRef.current.map((angle) => ({
          x: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
          y: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
        })),
      );
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  const startItems = (newItems: CircleItem[]) => {
    anglesRef.current = newItems.map(
      (_, i) => (2 * Math.PI * i) / newItems.length - Math.PI / 2,
    );
    pausedRef.current = false;
    setItems(newItems);
    setSelected(null);
  };

  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setSelected(null);
    pausedRef.current = false;
    try {
      const res = await fetch("/api/circle-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();
      startItems(data.items ?? []);
    } catch {
      startItems([]);
    }
    setLoading(false);
  };

  const handleChipClick = (item: CircleItem, index: number) => {
    pausedRef.current = true;
    setSelected({ ...item, index });
  };

  const handleDeselect = () => {
    pausedRef.current = false;
    setSelected(null);
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 20,
        width: "100%",
      }}
    >
      {/* Search input */}
      <div style={{ display: "flex", gap: 10, width: "100%", maxWidth: 500 }}>
        <input
          type="text"
          placeholder="Describe what you lost... e.g. blue phone, keys, red jacket"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          autoFocus
          style={{
            flex: 1,
            padding: "11px 16px",
            borderRadius: 12,
            border: "1.5px solid var(--border-input)",
            background: "var(--bg-input)",
            color: "var(--text-primary)",
            fontFamily: "Poppins, sans-serif",
            fontSize: 13,
            fontWeight: 500,
            outline: "none",
          }}
        />
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: "11px 22px",
            borderRadius: 12,
            border: "none",
            background: "var(--accent)",
            color: "#fff",
            fontFamily: "Poppins, sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: loading ? "not-allowed" : "pointer",
            opacity: loading ? 0.7 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 80,
          }}
        >
          {loading ? (
            <span
              style={{
                width: 16,
                height: 16,
                border: "2px solid rgba(255,255,255,0.35)",
                borderTopColor: "#fff",
                borderRadius: "50%",
                animation: "findr-spin 0.65s linear infinite",
                display: "inline-block",
              }}
            />
          ) : (
            "Search"
          )}
        </button>
      </div>

      {/* Circle stage */}
      <div
        style={{
          position: "relative",
          width: 420,
          height: 420,
          flexShrink: 0,
          cursor: "default",
        }}
        onClick={selected ? handleDeselect : undefined}
      >
        {/* Orbit guide ring */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            width: 320,
            height: 320,
            transform: "translate(-50%, -50%)",
            borderRadius: "50%",
            border: "1px dashed var(--border-default, rgba(0,0,0,0.1))",
            pointerEvents: "none",
          }}
        />

        {/* Center hub */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: "var(--bg-card)",
            border: "1.5px solid var(--border-default)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 2,
            pointerEvents: "none",
            zIndex: 2,
          }}
        >
          {loading ? (
            <span
              style={{
                width: 22,
                height: 22,
                border: "2.5px solid var(--border-default)",
                borderTopColor: "var(--accent)",
                borderRadius: "50%",
                animation: "findr-spin 0.7s linear infinite",
                display: "inline-block",
              }}
            />
          ) : searched && items.length === 0 ? (
            <>
              <span style={{ fontSize: 22 }}>😕</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                no matches
              </span>
            </>
          ) : items.length > 0 ? (
            <>
              <span
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  fontFamily: "Poppins, sans-serif",
                  lineHeight: 1.1,
                }}
              >
                {items.length}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "Poppins, sans-serif",
                  textAlign: "center",
                  whiteSpace: "pre-line",
                }}
              >
                {selected ? "click ring\nto resume" : "found"}
              </span>
            </>
          ) : (
            <>
              <span style={{ fontSize: 22 }}>
                <ImSearch />
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                search above
              </span>
            </>
          )}
        </div>

        {/* Orbit chips */}
        {items.map((item, i) => {
          const pos = chipPositions[i];
          if (!pos) return null;
          const isActive = selected?.id === item.id;
          return (
            <button
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                isActive ? handleDeselect() : handleChipClick(item, i);
              }}
              aria-label={item.name}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                transform: "translate(-50%, -50%)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 5,
                background: "none",
                border: "none",
                padding: 0,
                cursor: "pointer",
                zIndex: 3,
              }}
            >
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.name}
                  draggable={false}
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    objectFit: "cover",
                    border: isActive
                      ? "2.5px solid var(--accent)"
                      : "2px solid var(--bg-card)",
                    boxShadow: isActive
                      ? "0 0 0 3px rgba(47,128,237,0.25)"
                      : "0 1px 6px rgba(0,0,0,0.12)",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                    transition:
                      "transform 0.2s, border-color 0.2s, box-shadow 0.2s",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 12,
                    background: "var(--bg-input)",
                    border: isActive
                      ? "2.5px solid var(--accent)"
                      : "2px solid var(--bg-card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    boxShadow: isActive
                      ? "0 0 0 3px rgba(47,128,237,0.25)"
                      : "0 1px 6px rgba(0,0,0,0.08)",
                    transform: isActive ? "scale(1.15)" : "scale(1)",
                    transition: "transform 0.2s, border-color 0.2s",
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {item.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: isActive ? "var(--accent)" : "var(--text-secondary)",
                  textAlign: "center",
                  whiteSpace: "nowrap",
                  maxWidth: 80,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  background: "var(--bg-card)",
                  padding: "2px 6px",
                  borderRadius: 99,
                  border: "0.5px solid var(--border-default)",
                  fontFamily: "Poppins, sans-serif",
                  transition: "color 0.2s",
                }}
              >
                {item.name}
              </span>
            </button>
          );
        })}
      </div>

      {/* Detail card */}
      <div
        style={{
          width: "100%",
          maxWidth: 500,
          minHeight: 96,
          background: "var(--bg-card)",
          border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-default)"}`,
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          gap: 16,
          padding: "14px 16px",
          transition: "border-color 0.2s",
        }}
      >
        {selected ? (
          <>
            <div style={{ position: "relative", flexShrink: 0 }}>
              {selected.image ? (
                <img
                  src={selected.image}
                  alt={selected.name}
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    objectFit: "cover",
                    border: "1.5px solid var(--border-default)",
                    display: "block",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: 12,
                    background: "var(--bg-input)",
                    border: "1.5px solid var(--border-default)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 26,
                    fontWeight: 700,
                    color: "var(--text-muted)",
                    fontFamily: "Poppins, sans-serif",
                  }}
                >
                  {selected.name?.[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <span
                style={{
                  position: "absolute",
                  bottom: -8,
                  left: "50%",
                  transform: "translateX(-50%)",
                  whiteSpace: "nowrap",
                  fontSize: 9,
                  fontWeight: 700,
                  padding: "2px 7px",
                  borderRadius: 99,
                  fontFamily: "Poppins, sans-serif",
                  background:
                    selected.status === "pending" ? "#fef3c7" : "#d1fae5",
                  color: selected.status === "pending" ? "#92400e" : "#065f46",
                }}
              >
                {selected.status === "pending"
                  ? "⏳ Claim pending"
                  : "✓ Available"}
              </span>
            </div>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <h3
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                  fontFamily: "Poppins, sans-serif",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {selected.name}
              </h3>
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 6,
                  alignItems: "center",
                }}
              >
                {selected.category && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      padding: "2px 8px",
                      borderRadius: 99,
                      background: "var(--accent)",
                      color: "#fff",
                      fontFamily: "Poppins, sans-serif",
                    }}
                  >
                    {selected.category}
                  </span>
                )}
                {selected.location && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 500,
                      color: "var(--text-muted)",
                      fontFamily: "Poppins, sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 200,
                    }}
                  >
                    📍 {selected.location}
                  </span>
                )}
              </div>
              <button
                onClick={() => router.push(`/items/${selected.id}`)}
                style={{
                  alignSelf: "flex-start",
                  padding: "7px 14px",
                  borderRadius: 9,
                  border: "none",
                  background: "var(--accent)",
                  color: "#fff",
                  fontFamily: "Poppins, sans-serif",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginTop: 2,
                }}
              >
                View full item →
              </button>
            </div>
          </>
        ) : (
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: 0,
              fontWeight: 500,
              textAlign: "center",
              width: "100%",
              fontFamily: "Poppins, sans-serif",
            }}
          >
            {searched && items.length > 0
              ? "Click any item to see details"
              : "Results will orbit here"}
          </p>
        )}
      </div>

      <style>{`@keyframes findr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ── Modal wrapper that gets placed in the Navbar ──────────────────────────────
export default function AISearchButton() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Button that goes in the topbar */}
      <button
        onClick={() => setOpen(true)}
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
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--accent)";
          (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.borderColor =
            "var(--border-input)";
          (e.currentTarget as HTMLButtonElement).style.color =
            "var(--text-primary)";
        }}
      >
        <HiSparkles size={16} />
        <span>AI Search</span>
      </button>

      {/* Full-screen modal */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "var(--bg-page)",
              borderRadius: 20,
              padding: "28px 28px 24px",
              width: "100%",
              maxWidth: 560,
              maxHeight: "92vh",
              overflowY: "auto",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 4,
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                marginBottom: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <HiSparkles size={20} color="var(--accent)" />
                <span
                  style={{
                    fontFamily: "Poppins, sans-serif",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  AI Search
                </span>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  padding: 4,
                  borderRadius: 6,
                }}
              >
                <IoClose size={22} />
              </button>
            </div>

            <p
              style={{
                fontFamily: "Poppins, sans-serif",
                fontSize: 12,
                color: "var(--text-muted)",
                margin: "0 0 12px",
                textAlign: "center",
              }}
            >
              Describe what you lost — AI will find the closest matches
            </p>

            <CircleDiscover />
          </div>
        </div>
      )}
    </>
  );
}
