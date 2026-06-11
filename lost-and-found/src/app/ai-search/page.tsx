"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { HiSparkles } from "react-icons/hi2";

// ── types ────────────────────────────────────────────────────────────
interface CircleItem {
  id: number;
  name: string;
  image: string | null;
  category: string | null;
  location: string | null;
  description: string | null;
  status: string;
  score: number;
}

interface SelectedItem extends CircleItem { index: number; }

// ── constants ─────────────────────────────────────────────────────────
const STAGE      = 620;
const CX         = STAGE / 2;
const CY         = STAGE / 2;
const ORBIT_R    = 248;
const SPIN_SPEED = 0.00016; // rad/ms

export default function AISearchPage() {
  const router   = useRouter();
  const { user } = useUser();

  // ── identical to doc-9 feature state ────────────────────────────
  const rafRef      = useRef<number | null>(null);
  const lastTsRef   = useRef<number>(0);
  const anglesRef   = useRef<number[]>([]);
  const pausedRef   = useRef(false);

  // master copy — loaded once, never removed
  const masterRef   = useRef<CircleItem[]>([]);

  const [items,         setItems]         = useState<CircleItem[]>([]);
  const [selected,      setSelected]      = useState<SelectedItem | null>(null);
  const [query,         setQuery]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [initialLoad,   setInitialLoad]   = useState(true);
  const [searched,      setSearched]      = useState(false);
  const [chipPositions, setChipPositions] = useState<{x:number;y:number}[]>([]);
  const [hoveredId,     setHoveredId]     = useState<number | null>(null);
  const [trayItems,     setTrayItems]     = useState<CircleItem[]>([]);

  // ── animation loop — identical to doc-9 ─────────────────────────
  const tick = useCallback((ts: number) => {
    const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 50) : 16;
    lastTsRef.current = ts;
    if (!pausedRef.current && anglesRef.current.length > 0) {
      anglesRef.current = anglesRef.current.map((a) => a + SPIN_SPEED * dt);
      setChipPositions(
        anglesRef.current.map((angle) => ({
          x: CX + ORBIT_R * Math.cos(angle),
          y: CY + ORBIT_R * Math.sin(angle),
        }))
      );
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [tick]);

  // ── helpers — identical to doc-9 ────────────────────────────────
  const startItems = (newItems: CircleItem[]) => {
    anglesRef.current = newItems.map(
      (_, i) => (2 * Math.PI * i) / newItems.length - Math.PI / 2
    );
    pausedRef.current = false;
    setItems(newItems);
    setSelected(null);
    setChipPositions(
      anglesRef.current.map((angle) => ({
        x: CX + ORBIT_R * Math.cos(angle),
        y: CY + ORBIT_R * Math.sin(angle),
      }))
    );
  };

  // ── initial load — direct Supabase, no Gemini call ───────────────
  useEffect(() => {
    (async () => {
      try {
        const res  = await fetch("/api/recent-items");
        const data = await res.json();
        const loaded = (data.items ?? []).slice(0, 15) as CircleItem[];
        masterRef.current = loaded;
        startItems(loaded);
      } catch {}
      setInitialLoad(false);
    })();
  }, []);

  // ── search — identical logic to doc-9 ───────────────────────────
  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);
    setSelected(null);
    pausedRef.current = false;
    try {
      const res  = await fetch("/api/circle-search", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ query: q }),
      });
      const data = await res.json();
      startItems(data.items ?? []);
    } catch {
      startItems([]);
    }
    setLoading(false);
  };

  const handleReset = () => {
    startItems(masterRef.current);
    setSearched(false);
    setQuery("");
  };

  const handleChipClick = (item: CircleItem, index: number) => {
    pausedRef.current = true;
    setSelected({ ...item, index });
    // also add to tray if not already there and room exists
    setTrayItems((prev) => {
      if (prev.find((s) => s.id === item.id)) return prev;
      if (prev.length >= 5) return prev;
      return [...prev, item];
    });
  };

  const handleDeselect = () => {
    pausedRef.current = false;
    setSelected(null);
  };

  const removeTray = (id: number) =>
    setTrayItems((prev) => prev.filter((s) => s.id !== id));

  const popupBelow = (angle: number) => {
    const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return a < Math.PI;
  };

  const profileImage = user?.imageUrl;

  return (
    <>
      <style>{`
        .aisp-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding-top: 28px;
          padding-bottom: 110px;
          min-height: calc(100vh - 54px);
          box-sizing: border-box;
          font-family: Poppins, sans-serif;
        }

        /* ── Stage ── */
        .aisp-stage {
          position: relative;
          width: ${STAGE}px;
          height: ${STAGE}px;
          flex-shrink: 0;
        }
        .aisp-glow {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: 340px; height: 340px;
          border-radius: 50%;
          background: radial-gradient(circle at 38% 36%,
            rgba(170,150,255,0.50) 0%,
            rgba(100,130,255,0.28) 38%,
            rgba(47,128,237,0.08) 62%,
            transparent 76%);
          filter: blur(22px);
          pointer-events: none; z-index: 1;
        }
        .aisp-ring {
          position: absolute;
          top: 50%; left: 50%;
          width: ${ORBIT_R * 2}px; height: ${ORBIT_R * 2}px;
          transform: translate(-50%,-50%);
          border-radius: 50%;
          border: 1px dashed rgba(0,0,0,0.07);
          pointer-events: none; z-index: 2;
        }
        .aisp-hub {
          position: absolute;
          top: 50%; left: 50%;
          transform: translate(-50%,-50%);
          width: 96px; height: 96px;
          border-radius: 50%;
          background: var(--bg-card,#fff);
          border: 3px solid rgba(255,255,255,0.95);
          overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          z-index: 5;
          box-shadow: 0 0 0 10px rgba(140,110,255,0.08), 0 4px 28px rgba(0,0,0,0.11);
        }
        .aisp-hub img { width:100%; height:100%; object-fit:cover; }
        .aisp-hub-fallback { font-size:34px; font-weight:700; color:var(--text-muted,#9ca3af); }
        .aisp-hub-loading {
          width:28px; height:28px;
          border:2.5px solid rgba(0,0,0,0.08);
          border-top-color:var(--accent,#2f80ed);
          border-radius:50%;
          animation:aisp-spin 0.8s linear infinite;
        }
        .aisp-stage-label {
          position:absolute;
          top:calc(50% + 56px); left:50%;
          transform:translateX(-50%);
          font-size:11px; font-weight:600;
          color:var(--accent,#7c6fe0);
          letter-spacing:0.02em; white-space:nowrap;
          z-index:6; pointer-events:none;
        }

        /* ── Chips ── */
        .aisp-chip {
          position:absolute;
          transform:translate(-50%,-50%);
          background:none; border:none; padding:0;
          cursor:pointer; z-index:3;
          display:flex; flex-direction:column; align-items:center;
        }
        .aisp-chip-img {
          width:80px; height:80px;
          border-radius:20px; object-fit:cover;
          border:3px solid rgba(255,255,255,0.95);
          box-shadow:0 4px 20px rgba(0,0,0,0.15);
          display:block;
          transition:transform 0.18s, box-shadow 0.18s;
        }
        .aisp-chip-ph {
          width:80px; height:80px;
          border-radius:20px;
          background:var(--bg-input,#f3f4f6);
          border:3px solid rgba(255,255,255,0.95);
          box-shadow:0 4px 20px rgba(0,0,0,0.10);
          display:flex; align-items:center; justify-content:center;
          font-size:28px; font-weight:700; color:var(--text-muted,#9ca3af);
          transition:transform 0.18s;
        }
        .aisp-chip--active .aisp-chip-img,
        .aisp-chip--active .aisp-chip-ph {
          border-color:var(--accent,#2f80ed);
          box-shadow:0 0 0 4px rgba(47,128,237,0.22),0 4px 20px rgba(0,0,0,0.15);
          transform:scale(1.1);
        }
        .aisp-chip:hover .aisp-chip-img,
        .aisp-chip:hover .aisp-chip-ph {
          transform:scale(1.08);
          box-shadow:0 8px 28px rgba(47,128,237,0.26);
        }

        /* ── Hover popup ── */
        .aisp-popup {
          position:absolute; left:50%;
          transform:translateX(-50%);
          width:224px;
          background:var(--bg-card,#fff);
          border:1px solid var(--border-default,#e5e7eb);
          border-radius:16px; padding:13px 14px 11px;
          box-shadow:0 12px 40px rgba(0,0,0,0.14);
          z-index:20; pointer-events:none;
          animation:aisp-pop 0.13s ease; text-align:left;
        }
        .aisp-popup--above { bottom:calc(100% + 12px); }
        .aisp-popup--below { top:calc(100% + 12px); }
        @keyframes aisp-pop {
          from { opacity:0; transform:translateX(-50%) scale(0.94); }
          to   { opacity:1; transform:translateX(-50%) scale(1); }
        }
        .aisp-popup-name {
          font-size:13px; font-weight:700; color:var(--text-primary,#1a1f2e);
          margin:0 0 5px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;
        }
        .aisp-popup-tags { display:flex; flex-wrap:wrap; gap:5px; margin-bottom:7px; align-items:center; }
        .aisp-popup-cat {
          font-size:10px; font-weight:600; padding:2px 8px; border-radius:99px;
          background:var(--accent,#2f80ed); color:#fff;
        }
        .aisp-popup-loc { font-size:10px; font-weight:500; color:var(--text-muted,#6b7280); }
        .aisp-popup-desc {
          font-size:11px; line-height:1.5; color:var(--text-secondary,#4b5563);
          margin:0 0 8px;
          display:-webkit-box; -webkit-line-clamp:3; -webkit-box-orient:vertical; overflow:hidden;
        }
        .aisp-popup-cta { font-size:11px; font-weight:700; color:var(--accent,#2f80ed); }

        /* ── Tray ── */
        .aisp-tray {
          position: fixed;
          right: 20px;
          top: 50%;
          transform: translateY(-50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          z-index: 40;
        }
        .aisp-tray-label {
          font-size: 9px; font-weight: 700;
          color: var(--text-muted,#9ca3af);
          text-transform: uppercase; letter-spacing: 0.06em;
          writing-mode: vertical-rl;
          margin-bottom: 2px;
        }
        .aisp-tray-slot {
          width: 52px; height: 52px;
          border-radius: 14px;
          border: 1.5px dashed var(--border-default,#d1d5db);
          background: var(--bg-input,#f9fafb);
          flex-shrink: 0;
        }
        .aisp-tray-item {
          position: relative; width: 52px; height: 52px; flex-shrink: 0;
        }
        .aisp-tray-img {
          width: 52px; height: 52px;
          border-radius: 14px; object-fit: cover;
          border: 2.5px solid var(--accent,#2f80ed);
          box-shadow: 0 2px 10px rgba(47,128,237,0.22);
          display: block;
        }
        .aisp-tray-ph {
          width: 52px; height: 52px;
          border-radius: 14px;
          background: var(--bg-input,#f3f4f6);
          border: 2.5px solid var(--accent,#2f80ed);
          display: flex; align-items: center; justify-content: center;
          font-size: 18px; font-weight: 700; color: var(--text-muted,#9ca3af);
        }
        .aisp-tray-x {
          position: absolute; top: -5px; right: -5px;
          width: 17px; height: 17px;
          border-radius: 50%; border: none;
          background: #ef4444; color: #fff;
          font-size: 10px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 1px 4px rgba(0,0,0,0.18);
          padding: 0; z-index: 2;
        }
        .aisp-tray-view {
          width: 52px; padding: 6px 0;
          border-radius: 10px; border: none;
          background: var(--accent,#2f80ed); color: #fff;
          font-family: Poppins,sans-serif; font-size: 10px; font-weight: 700;
          cursor: pointer; text-align: center;
          box-shadow: 0 2px 8px rgba(47,128,237,0.28);
        }

        /* ── Bottom bar ── */
        .aisp-bar {
          position: fixed;
          bottom: 0; left: 68px; right: 0;
          display: flex; justify-content: center;
          padding: 12px 40px 18px;
          background: var(--bg-page,#f0f2f8);
          border-top: 1px solid var(--border-default,#e5e7eb);
          z-index: 50; box-sizing: border-box;
        }
        .aisp-bar-inner {
          display: flex; gap: 10px; align-items: center;
          width: 100%; max-width: 560px;
        }
        .aisp-bar-input {
          flex: 1; padding: 12px 18px;
          border-radius: 14px;
          border: 1.5px solid var(--border-input,#d1d5db);
          background: var(--bg-input,#ffffff);
          color: var(--text-primary,#1a1f2e);
          font-family: Poppins,sans-serif; font-size: 13px; font-weight: 500;
          outline: none; transition: border-color 0.15s;
          box-shadow: 0 1px 6px rgba(0,0,0,0.06);
        }
        .aisp-bar-input:focus { border-color: var(--accent,#2f80ed); }
        .aisp-bar-btn {
          display: flex; align-items: center; justify-content: center; gap: 6px;
          padding: 12px 22px; border-radius: 14px; border: none;
          background: var(--accent,#2f80ed); color: #fff;
          font-family: Poppins,sans-serif; font-size: 13px; font-weight: 700;
          cursor: pointer; white-space: nowrap; transition: opacity 0.15s;
          box-shadow: 0 2px 10px rgba(47,128,237,0.28);
        }
        .aisp-bar-btn:disabled { opacity: 0.65; cursor: not-allowed; }
        .aisp-bar-reset {
          padding: 12px 16px; border-radius: 14px;
          border: 1.5px solid var(--border-default,#e5e7eb);
          background: var(--bg-input,#fff);
          color: var(--text-secondary,#4b5563);
          font-family: Poppins,sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; white-space: nowrap; transition: border-color 0.15s;
        }
        .aisp-bar-reset:hover { border-color:var(--accent,#2f80ed); color:var(--accent,#2f80ed); }
        .aisp-spinner {
          width:15px; height:15px;
          border:2px solid rgba(255,255,255,0.35); border-top-color:#fff;
          border-radius:50%; animation:aisp-spin 0.65s linear infinite; display:inline-block;
        }

        @keyframes aisp-spin { to { transform: rotate(360deg); } }

        @media (max-width: 680px) {
          .aisp-bar  { left: 0; padding: 12px 16px 18px; }
          .aisp-tray { right: 6px; }
        }
      `}</style>

      <div className="aisp-page">
        <div
          className="aisp-stage"
          onClick={selected ? handleDeselect : undefined}
        >
          <div className="aisp-glow" />
          <div className="aisp-ring" />

          {/* Hub */}
          <div className="aisp-hub">
            {initialLoad ? (
              <div className="aisp-hub-loading" />
            ) : profileImage ? (
              <img src={profileImage} alt="You" />
            ) : (
              <span className="aisp-hub-fallback">
                {user?.firstName?.[0]?.toUpperCase() ?? "?"}
              </span>
            )}
          </div>

          <div className="aisp-stage-label">
            {initialLoad
              ? "Loading items…"
              : loading
              ? "AI is thinking…"
              : searched && items.length === 0
              ? "No matches found"
              : searched
              ? `${items.length} match${items.length !== 1 ? "es" : ""} found`
              : `${items.length} items in orbit`}
          </div>

          {/* Chips */}
          {items.map((item, i) => {
            const pos      = chipPositions[i];
            if (!pos) return null;
            const isActive  = selected?.id === item.id;
            const isHovered = hoveredId === item.id;
            const below     = popupBelow(anglesRef.current[i] ?? 0);

            return (
              <button
                key={item.id}
                className={`aisp-chip${isActive ? " aisp-chip--active" : ""}`}
                style={{ left: pos.x, top: pos.y }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={(e) => {
                  e.stopPropagation();
                  isActive ? handleDeselect() : handleChipClick(item, i);
                }}
                aria-label={item.name}
              >
                {item.image ? (
                  <img src={item.image} alt={item.name} className="aisp-chip-img" draggable={false} />
                ) : (
                  <div className="aisp-chip-ph">{item.name?.[0]?.toUpperCase() ?? "?"}</div>
                )}

                {isHovered && !isActive && (
                  <div className={`aisp-popup aisp-popup--${below ? "below" : "above"}`}>
                    <p className="aisp-popup-name">{item.name}</p>
                    <div className="aisp-popup-tags">
                      {item.category && <span className="aisp-popup-cat">{item.category}</span>}
                      {item.location  && <span className="aisp-popup-loc">📍 {item.location}</span>}
                    </div>
                    {item.description && (
                      <p className="aisp-popup-desc">{item.description}</p>
                    )}
                    <span className="aisp-popup-cta">Click to add to tray →</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selection tray */}
      <div className="aisp-tray">
        <span className="aisp-tray-label">My Items</span>
        {Array.from({ length: 5 }).map((_, i) => {
          const item = trayItems[i];
          return item ? (
            <div key={item.id} className="aisp-tray-item">
              {item.image
                ? <img src={item.image} alt={item.name} className="aisp-tray-img" />
                : <div className="aisp-tray-ph">{item.name?.[0]?.toUpperCase() ?? "?"}</div>
              }
              <button className="aisp-tray-x" onClick={() => removeTray(item.id)} aria-label={`Remove ${item.name}`}>✕</button>
            </div>
          ) : (
            <div key={i} className="aisp-tray-slot" />
          );
        })}
        {trayItems.length > 0 && (
          <button className="aisp-tray-view" onClick={() => router.push(`/items/${trayItems[0].id}`)}>
            View
          </button>
        )}
      </div>

      {/* Bottom bar */}
      <div className="aisp-bar">
        <div className="aisp-bar-inner">
          <input
            type="text"
            className="aisp-bar-input"
            placeholder="Describe what you lost… e.g. blue phone, keys, red jacket"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          {searched && (
            <button className="aisp-bar-reset" onClick={handleReset}>Reset</button>
          )}
          <button
            className="aisp-bar-btn"
            onClick={handleSearch}
            disabled={loading || initialLoad}
          >
            {loading
              ? <span className="aisp-spinner" />
              : <><HiSparkles size={15} /> Search</>
            }
          </button>
        </div>
      </div>
    </>
  );
}