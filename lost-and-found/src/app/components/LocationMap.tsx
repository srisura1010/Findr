"use client";

import { useEffect, useRef, useState } from "react";
import { useSettings } from "@/context/SettingsContext";

interface LocationMapProps {
  lat: number;
  lng: number;
  address?: string;
  zoom?: number;
}

export default function LocationMap({
  lat,
  lng,
  address,
  zoom = 15,
}: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [mapReady, setMapReady] = useState(false);
  const { language, hydrated } = useSettings();
  const [loadingText, setLoadingText] = useState("Loading map…");
  const [openText, setOpenText] = useState("Open ↗");

  useEffect(() => {
    if (!hydrated) return;
    if (language === "en") { setLoadingText("Loading map…"); setOpenText("Open ↗"); return; }
    const strings = [
      { key: "Loading map…", setter: setLoadingText },
      { key: "Open ↗", setter: setOpenText },
    ];
    for (const { key, setter } of strings) {
      const cached = localStorage.getItem(`t:${language}:${key}`);
      if (cached) setter(cached);
    }
    (async () => {
      for (const { key, setter } of strings) {
        if (localStorage.getItem(`t:${language}:${key}`)) continue;
        try {
          const res = await fetch("/api/translate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: key, target: language }),
          });
          const d = await res.json();
          const v = d.translatedText || key;
          setter(v);
          localStorage.setItem(`t:${language}:${key}`, v);
        } catch {}
      }
    })();
  }, [language, hydrated]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    let cancelled = false;

    // Hard-reset stale Leaflet state (fixes double-init in StrictMode / HMR / page refresh)
    const container = mapContainerRef.current;
    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }
    container.innerHTML = "";

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    setMapReady(false);

    import("leaflet").then((L) => {
      // If cleanup already ran (StrictMode unmount), bail out
      if (cancelled || !mapContainerRef.current) return;

      // Re-check: another effect cycle may have already set _leaflet_id
      const c = mapContainerRef.current;
      if ((c as any)._leaflet_id) {
        delete (c as any)._leaflet_id;
        c.innerHTML = "";
      }

      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const map = L.map(mapContainerRef.current, {
        center: [lat, lng],
        zoom,
        zoomControl: true,
        attributionControl: false,
        dragging: true,
        scrollWheelZoom: false,
        doubleClickZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:36px;height:44px;
          filter:drop-shadow(0 3px 8px rgba(0,0,0,0.4));
        ">
          <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14.667 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="var(--accent, #285ebb)"/>
            <circle cx="16" cy="16" r="7" fill="white"/>
          </svg>
        </div>`,
        iconSize: [36, 44],
        iconAnchor: [18, 44],
        popupAnchor: [0, -46],
      });

      const marker = L.marker([lat, lng], { icon: pinIcon }).addTo(map);

      if (address) {
        marker
          .bindPopup(
            `<div style="
              font-family: Poppins, sans-serif;
              font-size: 0.8rem;
              font-weight: 500;
              color: #111;
              max-width: 200px;
              line-height: 1.4;
            ">${address}</div>`,
            { maxWidth: 220 },
          )
          .openPopup();
      }

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      setMapReady(false);
    };
  }, [lat, lng, address, zoom]);

  const handleOpenInMaps = () => {
    window.open(
      `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`,
      "_blank",
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
        borderRadius: "14px",
        overflow: "hidden",
        border: "1.5px solid var(--border-default)",
        background: "var(--bg-card)",
      }}
    >
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {address && (
        <div
          style={{
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            borderBottom: "1px solid var(--border-default)",
          }}
        >
          <span style={{ fontSize: "16px", flexShrink: 0 }}>📍</span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.82rem",
              fontWeight: 500,
              color: "var(--text-primary)",
              flex: 1,
              lineHeight: 1.4,
            }}
          >
            {address}
          </span>
          <button
            onClick={handleOpenInMaps}
            style={{
              flexShrink: 0,
              padding: "4px 10px",
              borderRadius: "6px",
              border: "1px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-secondary)",
              fontSize: "0.72rem",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--accent)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--bg-input)")
            }
          >
            {openText}
          </button>
        </div>
      )}

      <div style={{ position: "relative", height: "260px" }}>
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        {!mapReady && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "var(--bg-input)",
              color: "var(--text-muted)",
              fontSize: "0.82rem",
              fontFamily: "var(--font-body)",
            }}
          >
            {loadingText}
          </div>
        )}
      </div>

      <style>{`
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-default) !important;
          font-family: Poppins, sans-serif !important;
        }
        .leaflet-popup-content-wrapper {
          border-radius: 10px !important;
          box-shadow: 0 4px 16px rgba(0,0,0,0.15) !important;
        }
        .leaflet-popup-tip { display: none; }
      `}</style>
    </div>
  );
}
