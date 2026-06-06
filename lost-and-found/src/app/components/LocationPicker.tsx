"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

interface LocationPickerProps {
  value: LocationData | null;
  onChange: (location: LocationData | null) => void;
  required?: boolean;
}

// Debounce helper
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

export default function LocationPicker({
  value,
  onChange,
  required = false,
}: LocationPickerProps) {
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    { displayName: string; shortName: string; lat: number; lng: number }[]
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  // Init Leaflet map once
  useEffect(() => {
    if (mapRef.current || !mapContainerRef.current) return;

    // Dynamically import leaflet (it's client-only)
    import("leaflet").then((L) => {
      // Fix default icon path issue in Next.js
      delete (L.Icon.Default.prototype as any)._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl:
          "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      const initialCenter: [number, number] = value
        ? [value.lat, value.lng]
        : [40.7128, -74.006]; // Default: NYC

      const map = L.map(mapContainerRef.current!, {
        center: initialCenter,
        zoom: value ? 15 : 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      // Custom pin icon
      const pinIcon = L.divIcon({
        className: "",
        html: `<div style="
          width:32px;height:40px;position:relative;
          filter: drop-shadow(0 2px 6px rgba(0,0,0,0.35));
        ">
          <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14.667 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="var(--accent, #285ebb)"/>
            <circle cx="16" cy="16" r="7" fill="white"/>
          </svg>
        </div>`,
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });

      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current.getLatLng();
          const addr = await reverseGeocode(pos.lat, pos.lng);
          onChange({ lat: pos.lat, lng: pos.lng, address: addr });
        });
      }

      // Click to place/move marker
      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;

        if (markerRef.current) {
          markerRef.current.setLatLng([lat, lng]);
        } else {
          markerRef.current = L.marker([lat, lng], {
            icon: pinIcon,
            draggable: true,
          }).addTo(map);

          markerRef.current.on("dragend", async () => {
            const pos = markerRef.current.getLatLng();
            const addr = await reverseGeocode(pos.lat, pos.lng);
            onChange({ lat: pos.lat, lng: pos.lng, address: addr });
          });
        }

        const addr = await reverseGeocode(lat, lng);
        onChange({ lat, lng, address: addr });
      });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerRef.current = null;
      }
    };
  }, []);

  // Sync external value change to marker
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then((L) => {
      if (!value) {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
        return;
      }

      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        const pinIcon = L.divIcon({
          className: "",
          html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">
            <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
              <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14.667 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z" fill="var(--accent, #285ebb)"/>
              <circle cx="16" cy="16" r="7" fill="white"/>
            </svg>
          </div>`,
          iconSize: [32, 40],
          iconAnchor: [16, 40],
        });
        markerRef.current = L.marker([value.lat, value.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(mapRef.current);
        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current.getLatLng();
          const addr = await reverseGeocode(pos.lat, pos.lng);
          onChange({ lat: pos.lat, lng: pos.lng, address: addr });
        });
      }
      mapRef.current.setView([value.lat, value.lng], 15);
    });
  }, [value, mapReady]);

  async function reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const res = await fetch("/api/reverse-geocode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng }),
      });
      if (res.ok) {
        const data = await res.json();
        return (
          data.shortAddress ||
          data.displayName ||
          `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        );
      }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch("/api/geocode", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
          setShowDropdown(true);
        }
      } finally {
        setIsSearching(false);
      }
    }, 600),
    [],
  );

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    doSearch(e.target.value);
  };

  const handleSelectResult = (result: {
    lat: number;
    lng: number;
    shortName: string;
    displayName: string;
  }) => {
    setSearchQuery(result.shortName);
    setShowDropdown(false);
    onChange({ lat: result.lat, lng: result.lng, address: result.shortName });
    if (mapRef.current) {
      mapRef.current.setView([result.lat, result.lng], 16);
    }
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        const addr = await reverseGeocode(lat, lng);
        onChange({ lat, lng, address: addr });
        setSearchQuery(addr);
        if (mapRef.current) {
          mapRef.current.setView([lat, lng], 16);
        }
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { timeout: 10000 },
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Leaflet CSS */}
      <link
        rel="stylesheet"
        href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      />

      {/* Search bar */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="text"
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
              placeholder="Search for a location..."
              required={required && !value}
              className="panel-form__input"
              style={{ margin: 0, paddingRight: "36px" }}
            />
            {isSearching && (
              <div
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "14px",
                  height: "14px",
                  border: "2px solid var(--accent)",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 0.7s linear infinite",
                }}
              />
            )}
          </div>
          <button
            type="button"
            onClick={handleUseMyLocation}
            disabled={isLocating}
            title="Use my current location"
            style={{
              flexShrink: 0,
              height: "42px",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1.5px solid var(--border-input)",
              background: "var(--bg-input)",
              color: "var(--text-primary)",
              cursor: isLocating ? "wait" : "pointer",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            {isLocating ? "…" : "📍"}
          </button>
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: "var(--bg-card)",
              border: "1px solid var(--border-default)",
              borderRadius: "10px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
              zIndex: 1000,
              overflow: "hidden",
            }}
          >
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={() => handleSelectResult(r)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  textAlign: "left",
                  background: "transparent",
                  border: "none",
                  borderBottom:
                    i < searchResults.length - 1
                      ? "1px solid var(--border-default)"
                      : "none",
                  cursor: "pointer",
                  fontFamily: "Poppins, sans-serif",
                  fontSize: "0.82rem",
                  color: "var(--text-primary)",
                  transition: "background 0.12s",
                  lineHeight: 1.4,
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--bg-input)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "transparent")
                }
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: "0.83rem",
                    color: "var(--text-primary)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {r.shortName}
                </div>
                <div
                  style={{
                    fontSize: "0.73rem",
                    color: "var(--text-muted)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    marginTop: "2px",
                  }}
                >
                  {r.displayName}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Map */}
      <div
        style={{
          position: "relative",
          borderRadius: "12px",
          overflow: "hidden",
          border: "1.5px solid var(--border-input)",
          height: "220px",
        }}
      >
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
              fontFamily: "Poppins, sans-serif",
            }}
          >
            Loading map…
          </div>
        )}
        {/* Hint overlay shown only when no value yet */}
        {mapReady && !value && (
          <div
            style={{
              position: "absolute",
              bottom: "10px",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(0,0,0,0.62)",
              color: "#fff",
              padding: "5px 12px",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontFamily: "Poppins, sans-serif",
              fontWeight: 500,
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            Click map to drop a pin
          </div>
        )}
      </div>

      {/* Selected address confirmation */}
      {value && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "rgba(var(--accent-rgb, 40,94,187), 0.08)",
            border: "1px solid rgba(var(--accent-rgb, 40,94,187), 0.2)",
          }}
        >
          <span style={{ fontSize: "16px" }}>📍</span>
          <span
            style={{
              fontFamily: "Poppins, sans-serif",
              fontSize: "0.8rem",
              color: "var(--text-primary)",
              fontWeight: 500,
              flex: 1,
            }}
          >
            {value.address}
          </span>
          <button
            type="button"
            onClick={() => {
              onChange(null);
              setSearchQuery("");
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--text-muted)",
              fontSize: "16px",
              padding: "0",
              lineHeight: 1,
            }}
          >
            ×
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: translateY(-50%) rotate(360deg); } }
        .leaflet-control-zoom { border: none !important; }
        .leaflet-control-zoom a {
          background: var(--bg-card) !important;
          color: var(--text-primary) !important;
          border-color: var(--border-default) !important;
          font-family: Poppins, sans-serif !important;
        }
      `}</style>
    </div>
  );
}
