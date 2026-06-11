"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { HiSparkles } from "react-icons/hi2";
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

export default function AISearchPage() {
  const router = useRouter();
  const rafRef = useRef<number | null>(null);
  const anglesRef = useRef<number[]>([]);
  const pausedRef = useRef(false);

  const [items, setItems] = useState<CircleItem[]>([]);
  const [selected, setSelected] = useState<SelectedItem | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [chipPositions, setChipPositions] = useState<{ x: number; y: number }[]>([]);

  const tick = useCallback(() => {
    if (!pausedRef.current) {
      anglesRef.current = anglesRef.current.map((a) => a + SPIN_SPEED);
    }
    if (anglesRef.current.length > 0) {
      setChipPositions(
        anglesRef.current.map((angle) => ({
          x: CENTER_X + ORBIT_RADIUS * Math.cos(angle),
          y: CENTER_Y + ORBIT_RADIUS * Math.sin(angle),
        }))
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
      (_, i) => (2 * Math.PI * i) / newItems.length - Math.PI / 2
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
    <>
      <style>{`
        .ai-search-page {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 20px;
          padding: 32px 24px 48px;
          min-height: 100vh;
          box-sizing: border-box;
        }
        .ai-search-header {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          width: 100%;
          max-width: 560px;
          position: relative;
        }
        .ai-search-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: Poppins, sans-serif;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-primary, #1a1f2e);
        }
        .ai-search-subtitle {
          font-family: Poppins, sans-serif;
          font-size: 12px;
          color: var(--text-muted, #6b7280);
          margin: 0;
          text-align: center;
        }
        .ai-search-input-row {
          display: flex;
          gap: 10px;
          width: 100%;
          max-width: 500px;
        }
        .ai-search-input {
          flex: 1;
          padding: 11px 16px;
          border-radius: 12px;
          border: 1.5px solid var(--border-input, #d1d5db);
          background: var(--bg-input, #ffffff);
          color: var(--text-primary, #1a1f2e);
          font-family: Poppins, sans-serif;
          font-size: 13px;
          font-weight: 500;
          outline: none;
          transition: border-color 0.15s;
        }
        .ai-search-input:focus {
          border-color: var(--accent, #2f80ed);
        }
        .ai-search-btn {
          padding: 11px 22px;
          border-radius: 12px;
          border: none;
          background: var(--accent, #2f80ed);
          color: #fff;
          font-family: Poppins, sans-serif;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          min-width: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: opacity 0.15s;
        }
        .ai-search-btn:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }
        .ai-search-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: ai-spin 0.65s linear infinite;
          display: inline-block;
        }
        .ai-orbit-stage {
          position: relative;
          width: 420px;
          height: 420px;
          flex-shrink: 0;
          cursor: default;
        }
        .ai-orbit-ring {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 320px;
          height: 320px;
          transform: translate(-50%, -50%);
          border-radius: 50%;
          border: 1px dashed var(--border-default, #e5e7eb);
          pointer-events: none;
        }
        .ai-orbit-hub {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: var(--bg-card, #ffffff);
          border: 1.5px solid var(--border-default, #e5e7eb);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          pointer-events: none;
          z-index: 2;
        }
        .ai-hub-spinner {
          width: 22px;
          height: 22px;
          border: 2.5px solid var(--border-default, #e5e7eb);
          border-top-color: var(--accent, #2f80ed);
          border-radius: 50%;
          animation: ai-spin 0.7s linear infinite;
          display: inline-block;
        }
        .ai-hub-emoji {
          font-size: 22px;
        }
        .ai-hub-icon {
          font-size: 22px;
          color: var(--text-muted, #6b7280);
          display: flex;
          align-items: center;
        }
        .ai-hub-count {
          font-size: 20px;
          font-weight: 700;
          color: var(--text-primary, #1a1f2e);
          font-family: Poppins, sans-serif;
          line-height: 1.1;
        }
        .ai-hub-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-muted, #6b7280);
          font-family: Poppins, sans-serif;
          text-align: center;
          white-space: pre-line;
        }
        .ai-chip {
          position: absolute;
          transform: translate(-50%, -50%);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          z-index: 3;
        }
        .ai-chip__img,
        .ai-chip__placeholder {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          border: 2px solid var(--bg-card, #ffffff);
          box-shadow: 0 1px 6px rgba(0, 0, 0, 0.12);
          transform: scale(1);
          transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
          display: block;
        }
        .ai-chip__img {
          object-fit: cover;
        }
        .ai-chip__placeholder {
          background: var(--bg-input, #f3f4f6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 18px;
          font-weight: 700;
          color: var(--text-muted, #6b7280);
          font-family: Poppins, sans-serif;
        }
        .ai-chip--active .ai-chip__img,
        .ai-chip--active .ai-chip__placeholder {
          border: 2.5px solid var(--accent, #2f80ed);
          box-shadow: 0 0 0 3px rgba(47, 128, 237, 0.25);
          transform: scale(1.15);
        }
        .ai-chip__label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-secondary, #4b5563);
          text-align: center;
          white-space: nowrap;
          max-width: 80px;
          overflow: hidden;
          text-overflow: ellipsis;
          background: var(--bg-card, #ffffff);
          padding: 2px 6px;
          border-radius: 99px;
          border: 0.5px solid var(--border-default, #e5e7eb);
          font-family: Poppins, sans-serif;
          transition: color 0.2s;
        }
        .ai-chip--active .ai-chip__label {
          color: var(--accent, #2f80ed);
        }
        .ai-detail-card {
          width: 100%;
          max-width: 500px;
          min-height: 96px;
          background: var(--bg-card, #ffffff);
          border: 1.5px solid var(--border-default, #e5e7eb);
          border-radius: 16px;
          display: flex;
          align-items: center;
          gap: 16px;
          padding: 14px 16px;
          box-sizing: border-box;
          transition: border-color 0.2s;
        }
        .ai-detail-card--active {
          border-color: var(--accent, #2f80ed);
        }
        .ai-detail-empty {
          font-size: 13px;
          color: var(--text-muted, #6b7280);
          margin: 0;
          font-weight: 500;
          text-align: center;
          width: 100%;
          font-family: Poppins, sans-serif;
        }
        .ai-detail-thumb-wrap {
          position: relative;
          flex-shrink: 0;
        }
        .ai-detail-thumb {
          width: 72px;
          height: 72px;
          border-radius: 12px;
          border: 1.5px solid var(--border-default, #e5e7eb);
          display: block;
        }
        img.ai-detail-thumb {
          object-fit: cover;
        }
        .ai-detail-thumb--placeholder {
          background: var(--bg-input, #f3f4f6);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 26px;
          font-weight: 700;
          color: var(--text-muted, #6b7280);
          font-family: Poppins, sans-serif;
        }
        .ai-detail-status {
          position: absolute;
          bottom: -8px;
          left: 50%;
          transform: translateX(-50%);
          white-space: nowrap;
          font-size: 9px;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 99px;
          font-family: Poppins, sans-serif;
        }
        .ai-detail-status--pending {
          background: #fef3c7;
          color: #92400e;
        }
        .ai-detail-status--available {
          background: #d1fae5;
          color: #065f46;
        }
        .ai-detail-info {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .ai-detail-name {
          font-size: 15px;
          font-weight: 700;
          color: var(--text-primary, #1a1f2e);
          margin: 0;
          font-family: Poppins, sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .ai-detail-tags {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          align-items: center;
        }
        .ai-detail-category {
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          border-radius: 99px;
          background: var(--accent, #2f80ed);
          color: #fff;
          font-family: Poppins, sans-serif;
        }
        .ai-detail-location {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-muted, #6b7280);
          font-family: Poppins, sans-serif;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 200px;
        }
        .ai-detail-view-btn {
          align-self: flex-start;
          padding: 7px 14px;
          border-radius: 9px;
          border: none;
          background: var(--accent, #2f80ed);
          color: #fff;
          font-family: Poppins, sans-serif;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          margin-top: 2px;
          transition: opacity 0.15s;
        }
        .ai-detail-view-btn:hover {
          opacity: 0.88;
        }
        @keyframes ai-spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 480px) {
          .ai-orbit-stage {
            width: 340px;
            height: 340px;
          }
          .ai-search-page {
            padding: 24px 16px 40px;
          }
        }
      `}</style>

      <div className="ai-search-page">
        {/* Page header */}
        <div className="ai-search-header">
          <div className="ai-search-title">
            <HiSparkles size={20} color="var(--accent, #2f80ed)" />
            <span>AI Search</span>
          </div>
          <p className="ai-search-subtitle">
            Describe what you lost — AI will find the closest matches
          </p>
        </div>

        {/* Search input */}
        <div className="ai-search-input-row">
          <input
            type="text"
            className="ai-search-input"
            placeholder="e.g. blue phone, keys, red jacket"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            autoFocus
          />
          <button
            className="ai-search-btn"
            onClick={handleSearch}
            disabled={loading}
          >
            {loading ? <span className="ai-search-spinner" /> : "Search"}
          </button>
        </div>

        {/* Orbit stage */}
        <div
          className="ai-orbit-stage"
          onClick={selected ? handleDeselect : undefined}
        >
          <div className="ai-orbit-ring" />

          <div className="ai-orbit-hub">
            {loading ? (
              <span className="ai-hub-spinner" />
            ) : searched && items.length === 0 ? (
              <>
                <span className="ai-hub-emoji">😕</span>
                <span className="ai-hub-label">no matches</span>
              </>
            ) : items.length > 0 ? (
              <>
                <span className="ai-hub-count">{items.length}</span>
                <span className="ai-hub-label">
                  {selected ? "click ring\nto resume" : "found"}
                </span>
              </>
            ) : (
              <>
                <span className="ai-hub-icon">
                  <ImSearch />
                </span>
                <span className="ai-hub-label">search above</span>
              </>
            )}
          </div>

          {items.map((item, i) => {
            const pos = chipPositions[i];
            if (!pos) return null;
            const isActive = selected?.id === item.id;
            return (
              <button
                key={item.id}
                className={`ai-chip${isActive ? " ai-chip--active" : ""}`}
                style={{ left: pos.x, top: pos.y }}
                onClick={(e) => {
                  e.stopPropagation();
                  isActive ? handleDeselect() : handleChipClick(item, i);
                }}
                aria-label={item.name}
              >
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="ai-chip__img"
                    draggable={false}
                  />
                ) : (
                  <div className="ai-chip__placeholder">
                    {item.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span className="ai-chip__label">{item.name}</span>
              </button>
            );
          })}
        </div>

        {/* Detail card */}
        <div className={`ai-detail-card${selected ? " ai-detail-card--active" : ""}`}>
          {selected ? (
            <>
              <div className="ai-detail-thumb-wrap">
                {selected.image ? (
                  <img
                    src={selected.image}
                    alt={selected.name}
                    className="ai-detail-thumb"
                  />
                ) : (
                  <div className="ai-detail-thumb ai-detail-thumb--placeholder">
                    {selected.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                )}
                <span
                  className={`ai-detail-status ${
                    selected.status === "pending"
                      ? "ai-detail-status--pending"
                      : "ai-detail-status--available"
                  }`}
                >
                  {selected.status === "pending" ? "⏳ Claim pending" : "✓ Available"}
                </span>
              </div>
              <div className="ai-detail-info">
                <h3 className="ai-detail-name">{selected.name}</h3>
                <div className="ai-detail-tags">
                  {selected.category && (
                    <span className="ai-detail-category">{selected.category}</span>
                  )}
                  {selected.location && (
                    <span className="ai-detail-location">📍 {selected.location}</span>
                  )}
                </div>
                <button
                  className="ai-detail-view-btn"
                  onClick={() => router.push(`/items/${selected.id}`)}
                >
                  View full item →
                </button>
              </div>
            </>
          ) : (
            <p className="ai-detail-empty">
              {searched && items.length > 0
                ? "Click any item to see details"
                : "Results will orbit here"}
            </p>
          )}
        </div>
      </div>
    </>
  );
}