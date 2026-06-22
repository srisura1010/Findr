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

interface SpawningChip {
  item: CircleItem;
  index: number;
  total: number;
  startTime: number;
}

// ── constants ─────────────────────────────────────────────────────────
const STAGE = 620;
const CX = STAGE / 2;
const CY = STAGE / 2;
const ORBIT_R = 248;
const SPIN_SPEED = 0.00016;       // rad/ms — normal cruise
const EXIT_SPIN_SPEED = 0.00048;  // rad/ms — slightly faster during exit
const SPAWN_DURATION = 700;       // ms per chip to travel center → orbit
const SPAWN_STAGGER = 90;         // ms between each chip spawning

export default function AISearchPage() {
  const router = useRouter();
  const { user } = useUser();

  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number>(0);
  const anglesRef = useRef<number[]>([]);
  const masterRef = useRef<CircleItem[]>([]);
  const transitionPhaseRef = useRef<"idle" | "exit" | "spawning">("idle");
  const nowRef = useRef<number>(0); // updated every RAF tick

  const [items, setItems] = useState<CircleItem[]>([]);
  const [exitItems, setExitItems] = useState<CircleItem[]>([]);
  const [exitAngles, setExitAngles] = useState<number[]>([]);
  const [spawningChips, setSpawningChips] = useState<SpawningChip[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [searched, setSearched] = useState(false);
  const [chipPositions, setChipPositions] = useState<{ x: number; y: number }[]>([]);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [transitionPhase, setTransitionPhase] = useState<"idle" | "exit" | "spawning">("idle");
  const [, forceRender] = useState(0); // used to trigger re-renders during spawn animation

  // ── animation loop ───────────────────────────────────────────────
  const tick = useCallback((ts: number) => {
    const dt = lastTsRef.current ? Math.min(ts - lastTsRef.current, 50) : 16;
    lastTsRef.current = ts;
    nowRef.current = ts;

    const speed =
      transitionPhaseRef.current === "exit" ? EXIT_SPIN_SPEED : SPIN_SPEED;

    if (anglesRef.current.length > 0) {
      anglesRef.current = anglesRef.current.map((a) => a + speed * dt);
      setChipPositions(
        anglesRef.current.map((angle) => ({
          x: CX + ORBIT_R * Math.cos(angle),
          y: CY + ORBIT_R * Math.sin(angle),
        })),
      );
    }

    // Keep re-rendering during spawn phase for smooth animation
    if (transitionPhaseRef.current === "spawning") {
      forceRender((n) => n + 1);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    transitionPhaseRef.current = transitionPhase;
  }, [transitionPhase]);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [tick]);

  // ── helpers ──────────────────────────────────────────────────────
  const startItems = (newItems: CircleItem[]) => {
    anglesRef.current = newItems.map(
      (_, i) => (2 * Math.PI * i) / newItems.length - Math.PI / 2,
    );
    setItems(newItems);
    setChipPositions(
      anglesRef.current.map((angle) => ({
        x: CX + ORBIT_R * Math.cos(angle),
        y: CY + ORBIT_R * Math.sin(angle),
      })),
    );
  };

  // ── initial load ─────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/recent-items");
        const data = await res.json();
        const loaded = (data.items ?? []).slice(0, 15) as CircleItem[];
        masterRef.current = loaded;
        startItems(loaded);
      } catch {}
      setInitialLoad(false);
    })();
  }, []);

  // ── spawn new items from center outward ───────────────────────────
  const spawnItems = useCallback((newItems: CircleItem[]) => {
    if (newItems.length === 0) {
      startItems([]);
      setSpawningChips([]);
      setTransitionPhase("idle");
      transitionPhaseRef.current = "idle";
      return;
    }

    // Pre-set the final angles so the orbit is already spinning correctly
    const finalAngles = newItems.map(
      (_, i) => (2 * Math.PI * i) / newItems.length - Math.PI / 2,
    );
    anglesRef.current = finalAngles;
    setItems(newItems);
    setChipPositions(
      finalAngles.map((angle) => ({
        x: CX + ORBIT_R * Math.cos(angle),
        y: CY + ORBIT_R * Math.sin(angle),
      })),
    );

    const now = nowRef.current;
    const chips: SpawningChip[] = newItems.map((item, i) => ({
      item,
      index: i,
      total: newItems.length,
      startTime: now + i * SPAWN_STAGGER,
    }));

    setSpawningChips(chips);
    setTransitionPhase("spawning");
    transitionPhaseRef.current = "spawning";

    // Clear spawning state after all chips have finished traveling
    const totalDuration = SPAWN_DURATION + (newItems.length - 1) * SPAWN_STAGGER + 100;
    setTimeout(() => {
      setSpawningChips([]);
      setTransitionPhase("idle");
      transitionPhaseRef.current = "idle";
    }, totalDuration);
  }, []);

  // ── search ───────────────────────────────────────────────────────
  const handleSearch = async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setSearched(true);

    // Capture current items + angles for the exit animation
    const currentItems = [...items];
    const currentAngles = [...anglesRef.current];
    setExitItems(currentItems);
    setExitAngles(currentAngles);
    setItems([]);
    setChipPositions([]);
    anglesRef.current = [];
    setTransitionPhase("exit");
    transitionPhaseRef.current = "exit";

    try {
      const res = await fetch("/api/circle-search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q }),
      });
      const data = await res.json();

      // Exit animation runs for 600ms, then spawn new items
      setTimeout(() => {
        setExitItems([]);
        setExitAngles([]);
        spawnItems(data.items ?? []);
      }, 600);
    } catch {
      setTimeout(() => {
        setExitItems([]);
        setExitAngles([]);
        spawnItems([]);
      }, 600);
    }

    setLoading(false);
  };

  const handleReset = () => {
    const currentItems = [...items];
    const currentAngles = [...anglesRef.current];
    setExitItems(currentItems);
    setExitAngles(currentAngles);
    setItems([]);
    setChipPositions([]);
    anglesRef.current = [];
    setTransitionPhase("exit");
    transitionPhaseRef.current = "exit";

    setTimeout(() => {
      setExitItems([]);
      setExitAngles([]);
      setSearched(false);
      setQuery("");
      spawnItems(masterRef.current);
    }, 600);
  };

  const handleChipClick = (item: CircleItem) => {
    router.push(`/items/${item.id}`);
  };

  const popupBelow = (angle: number) => {
    const a = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    return a < Math.PI;
  };

  // ── easing ───────────────────────────────────────────────────────
  // Cubic ease-out for the outward travel
  const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

  const profileImage = user?.imageUrl;

  // Scale the fixed-size stage down on small viewports
  const [stageScale, setStageScale] = useState(1);
  useEffect(() => {
    const update = () => {
      const avail = window.innerWidth - 24; // 12px padding each side
      setStageScale(avail < STAGE ? avail / STAGE : 1);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

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
          overflow-x: hidden;
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
          transition: opacity 0.3s ease;
        }
        .aisp-stage[data-phase="exit"] .aisp-glow { opacity: 0.4; }
        .aisp-stage[data-phase="spawning"] .aisp-glow { opacity: 0.85; }

        .aisp-ring {
          position: absolute;
          top: 50%; left: 50%;
          width: ${ORBIT_R * 2}px; height: ${ORBIT_R * 2}px;
          transform: translate(-50%,-50%);
          border-radius: 50%;
          border: 1px dashed rgba(0,0,0,0.07);
          pointer-events: none; z-index: 2;
          transition: border-color 0.3s ease, opacity 0.3s ease;
        }
        .aisp-stage[data-phase="exit"] .aisp-ring {
          border-color: rgba(140,110,255,0.4);
          animation: aisp-ring-exit 0.6s ease-in forwards;
        }
        @keyframes aisp-ring-exit {
          0%   { border-color: rgba(0,0,0,0.07); }
          50%  { border-color: rgba(140,110,255,0.5); }
          100% { border-color: rgba(140,110,255,0.1); opacity: 0.3; }
        }
        .aisp-stage[data-phase="spawning"] .aisp-ring {
          border-color: rgba(47,128,237,0.25);
          animation: aisp-ring-spawn 1s ease-out forwards;
        }
        @keyframes aisp-ring-spawn {
          0%   { border-color: rgba(47,128,237,0.5); }
          100% { border-color: rgba(0,0,0,0.07); }
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
          transition: box-shadow 0.4s ease;
        }
        .aisp-stage[data-phase="spawning"] .aisp-hub {
          box-shadow: 0 0 0 18px rgba(47,128,237,0.1), 0 4px 28px rgba(0,0,0,0.14);
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
          transition: opacity 0.2s ease;
        }
        .aisp-stage[data-phase="exit"] .aisp-stage-label { opacity: 0; }

        /* ── Idle chips (normal orbit) ── */
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
        .aisp-chip:hover .aisp-chip-img,
        .aisp-chip:hover .aisp-chip-ph {
          transform:scale(1.08);
          box-shadow:0 8px 28px rgba(47,128,237,0.26);
        }

        /* ── Exit chips — staggered, deliberate one-by-one dismissal ── */
        .aisp-chip-exit {
          position:absolute;
          background:none; border:none; padding:0;
          pointer-events:none; z-index:3;
          display:flex; flex-direction:column; align-items:center;
        }
        .aisp-chip-exit .aisp-chip-img,
        .aisp-chip-exit .aisp-chip-ph {
          animation: aisp-chip-dismiss var(--exit-dur, 0.28s) var(--exit-delay, 0s) ease-in both;
        }
        @keyframes aisp-chip-dismiss {
          0%   { opacity:1; transform: translate(-50%,-50%) scale(1);    filter: blur(0px); }
          30%  { opacity:1; transform: translate(-50%,-50%) scale(0.92); filter: blur(0px); }
          70%  { opacity:0.4; transform: translate(-50%,-50%) scale(1.08); filter: blur(2px); }
          100% { opacity:0;   transform: translate(-50%,-50%) scale(0.6); filter: blur(6px); }
        }

        /* ── Spawning chips — travel center → orbit ── */
        .aisp-chip-spawning {
          position:absolute;
          background:none; border:none; padding:0;
          pointer-events:none; z-index:4;
          display:flex; flex-direction:column; align-items:center;
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

        /* Push the GlobalChatbot FAB above the fixed search bar */
        .global-chat-fab { bottom: 82px; }
        .global-chat-panel { bottom: 148px; }

        @media (max-width: 680px) {
          .aisp-bar { left: 0; padding: 12px 16px 18px; }
        }
      `}</style>

      <div className="aisp-page">
        {/* Scale wrapper keeps the layout footprint == visual size */}
        <div style={{
          width: STAGE * stageScale,
          height: STAGE * stageScale,
          flexShrink: 0,
          overflow: "hidden",
        }}>
        <div className="aisp-stage" data-phase={transitionPhase}
          style={{ transform: `scale(${stageScale})`, transformOrigin: "top left" }}
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
                : searched && items.length === 0 && transitionPhase === "idle"
                  ? "No matches found"
                  : searched && transitionPhase === "idle"
                    ? `${items.length} match${items.length !== 1 ? "es" : ""} found`
                    : transitionPhase === "idle"
                      ? `${items.length} items in orbit`
                      : ""}
          </div>

          {/* ── Exit chips — rendered at their last known positions ── */}
          {exitItems.map((item, i) => {
            const angle = exitAngles[i] ?? 0;
            const x = CX + ORBIT_R * Math.cos(angle);
            const y = CY + ORBIT_R * Math.sin(angle);
            // Stagger: each chip exits ~50ms after the previous one
            const delay = i * 0.045;
            const dur = 0.28;

            return (
              <div
                key={`exit-${item.id}`}
                className="aisp-chip-exit"
                style={{
                  left: x,
                  top: y,
                  ["--exit-delay" as string]: `${delay}s`,
                  ["--exit-dur" as string]: `${dur}s`,
                }}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="aisp-chip-img"
                    draggable={false}
                  />
                ) : (
                  <div className="aisp-chip-ph">
                    {item.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
              </div>
            );
          })}

          {/* ── Spawning chips — travel from center to orbit position ── */}
          {spawningChips.map((chip) => {
            const now = nowRef.current;
            const elapsed = now - chip.startTime;

            // Not started yet — render invisible at center
            if (elapsed < 0) {
              return (
                <div
                  key={`spawn-${chip.item.id}`}
                  className="aisp-chip-spawning"
                  style={{ left: CX, top: CY, opacity: 0 }}
                >
                  {chip.item.image ? (
                    <img src={chip.item.image} alt={chip.item.name} className="aisp-chip-img" draggable={false} />
                  ) : (
                    <div className="aisp-chip-ph">{chip.item.name?.[0]?.toUpperCase() ?? "?"}</div>
                  )}
                </div>
              );
            }

            const rawT = Math.min(elapsed / SPAWN_DURATION, 1);
            const t = easeOutCubic(rawT);

            // Current angle from the orbit (already spinning in anglesRef)
            const finalAngle = anglesRef.current[chip.index] ?? (
              (2 * Math.PI * chip.index) / chip.total - Math.PI / 2
            );

            // Interpolate from center (r=0) to orbit (r=ORBIT_R)
            const r = t * ORBIT_R;
            const x = CX + r * Math.cos(finalAngle);
            const y = CY + r * Math.sin(finalAngle);

            // Scale: starts tiny (0.2), grows to full (1) with slight overshoot
            const scale = rawT < 1
              ? 0.2 + t * 0.85 + (rawT > 0.7 ? Math.sin((rawT - 0.7) / 0.3 * Math.PI) * 0.08 : 0)
              : 1;

            // Blur: dissipates as it reaches orbit
            const blur = (1 - t) * 6;

            // Opacity: fades in quickly then holds
            const opacity = Math.min(rawT * 3, 1);

            // Done traveling — don't render (the idle chip will take over)
            if (rawT >= 1) return null;

            return (
              <div
                key={`spawn-${chip.item.id}`}
                className="aisp-chip-spawning"
                style={{
                  left: x,
                  top: y,
                  opacity,
                  filter: `blur(${blur}px)`,
                  transform: `translate(-50%, -50%) scale(${scale})`,
                }}
              >
                {chip.item.image ? (
                  <img src={chip.item.image} alt={chip.item.name} className="aisp-chip-img" draggable={false} />
                ) : (
                  <div className="aisp-chip-ph">{chip.item.name?.[0]?.toUpperCase() ?? "?"}</div>
                )}
              </div>
            );
          })}

          {/* ── Idle/orbit chips — hidden while spawning (spawning chip covers) ── */}
          {items.map((item, i) => {
            const pos = chipPositions[i];
            if (!pos) return null;

            // Check if this item is still spawning — hide the orbit chip until done
            const spawning = spawningChips.find((s) => s.index === i);
            if (spawning) {
              const elapsed = nowRef.current - spawning.startTime;
              if (elapsed < SPAWN_DURATION) return null;
            }

            const isHovered = hoveredId === item.id;
            const below = popupBelow(anglesRef.current[i] ?? 0);

            return (
              <button
                key={item.id}
                className="aisp-chip"
                style={{ left: pos.x, top: pos.y }}
                onMouseEnter={() => setHoveredId(item.id)}
                onMouseLeave={() => setHoveredId(null)}
                onClick={() => handleChipClick(item)}
                aria-label={item.name}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="aisp-chip-img"
                    draggable={false}
                  />
                ) : (
                  <div className="aisp-chip-ph">
                    {item.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}

                {isHovered && transitionPhase === "idle" && (
                  <div
                    className={`aisp-popup aisp-popup--${below ? "below" : "above"}`}
                  >
                    <p className="aisp-popup-name">{item.name}</p>
                    <div className="aisp-popup-tags">
                      {item.category && (
                        <span className="aisp-popup-cat">{item.category}</span>
                      )}
                      {item.location && (
                        <span className="aisp-popup-loc">
                          📍 {item.location}
                        </span>
                      )}
                    </div>
                    {item.description && (
                      <p className="aisp-popup-desc">{item.description}</p>
                    )}
                    <span className="aisp-popup-cta">Click to view item →</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
        </div>{/* end scale wrapper */}
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
            <button className="aisp-bar-reset" onClick={handleReset}>
              Reset
            </button>
          )}
          <button
            className="aisp-bar-btn"
            onClick={handleSearch}
            disabled={loading || initialLoad || transitionPhase !== "idle"}
          >
            {loading ? (
              <span className="aisp-spinner" />
            ) : (
              <>
                <HiSparkles size={15} /> Search
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}