"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useRef, useState, useCallback } from "react";
import { useSettings } from "@/context/SettingsContext";

//the resolved coordinates and display address for a picked location
export interface LocationData {
  lat: number;
  lng: number;
  address: string;
}

//a single result returned by Nominatim geocoding
interface GeoResult {
  lat: number;
  lng: number;
  shortName: string;
  displayName: string;
  type: string;
  street: string | null;
  city: string;
  state: string | null;
  postcode: string | null;
  primaryName: string | null;
}

interface LocationPickerProps {
  value: LocationData | null;
  onChange: (location: LocationData | null) => void;
  required?: boolean;
}

//delays calling fn until ms have passed since the last call
function debounce<T extends (...args: any[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: any[]) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as T;
}

/** Emoji icon for a Nominatim place type */
function placeIcon(type: string): string {
  const map: Record<string, string> = {
    restaurant: "🍽️",
    fast_food: "🍔",
    cafe: "☕",
    bar: "🍺",
    pub: "🍺",
    school: "🏫",
    university: "🎓",
    college: "🎓",
    hospital: "🏥",
    pharmacy: "💊",
    supermarket: "🛒",
    convenience: "🏪",
    fuel: "⛽",
    parking: "🅿️",
    park: "🌳",
    mall: "🏬",
    hotel: "🏨",
    motel: "🏨",
    bank: "🏦",
    atm: "🏧",
    library: "📚",
    cinema: "🎬",
    gym: "💪",
    airport: "✈️",
    bus_stop: "🚌",
    station: "🚉",
    house: "🏠",
    residential: "🏠",
    road: "🛣️",
    city: "🏙️",
    town: "🏘️",
    suburb: "🏘️",
  };
  return map[type] ?? "📍";
}

//interactive Leaflet map with address autocomplete backed by Nominatim geocoding
export default function LocationPicker({
  value,
  onChange,
  required = false,
}: LocationPickerProps) {
  const mapRef = useRef<any>(null); //holds the Leaflet map instance for cleanup
  const markerRef = useRef<any>(null); //holds the current map marker
  const mapContainerRef = useRef<HTMLDivElement>(null); //DOM node Leaflet attaches to
  const dropdownRef = useRef<HTMLDivElement>(null); //ref to the autocomplete results dropdown
  const inputRef = useRef<HTMLInputElement>(null); //ref to the address search input
  const { language, hydrated } = useSettings();
  const [placeholderText, setPlaceholderText] = useState("Search address, place, or landmark…");
  const [useLocationTitle, setUseLocationTitle] = useState("Use my location");
  const [loadingMapText, setLoadingMapText] = useState("Loading map…");
  const [noResultsText, setNoResultsText] = useState("No results found. Try a more specific address");
  const [attributionText, setAttributionText] = useState("Results from OpenStreetMap");

  useEffect(() => {
    if (!hydrated) return;
    const strings = [
      { key: "Search address, place, or landmark…", setter: setPlaceholderText },
      { key: "Use my location", setter: setUseLocationTitle },
      { key: "Loading map…", setter: setLoadingMapText },
      { key: "No results found. Try a more specific address", setter: setNoResultsText },
      { key: "Results from OpenStreetMap", setter: setAttributionText },
    ];
    if (language === "en") {
      for (const { key, setter } of strings) setter(key);
      return;
    }
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

  const [searchQuery, setSearchQuery] = useState(value?.address ?? ""); //current text in the address search field
  const [searchResults, setSearchResults] = useState<GeoResult[]>([]); //Nominatim results to show in the dropdown
  const [isSearching, setIsSearching] = useState(false); //true while a geocoding request is in flight
  const [showDropdown, setShowDropdown] = useState(false); //whether the results dropdown is visible
  const [mapReady, setMapReady] = useState(false); //true after Leaflet finishes initializing
  const [isLocating, setIsLocating] = useState(false); //true while requesting the browser geolocation
  const [activeIndex, setActiveIndex] = useState(-1); //keyboard-highlighted result index in the dropdown

  // Keep input in sync when value cleared externally
  useEffect(() => {
    if (!value) setSearchQuery("");
  }, [value]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  //initializes the Leaflet map and places a draggable marker at the current value
  useEffect(() => {
    let cancelled = false;
    if (!mapContainerRef.current) return;

    import("leaflet").then((L) => {
      if (cancelled) return;
      const container = mapContainerRef.current!;
      if (!container) return;

      if ((container as any)._leaflet_id) {
        delete (container as any)._leaflet_id;
      }
      container.innerHTML = "";

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
        : [40.7608, -111.891]; // default: Salt Lake City

      const map = L.map(container, {
        center: initialCenter,
        zoom: value ? 15 : 12,
        zoomControl: true,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
      }).addTo(map);

      const pinIcon = makePinIcon(L);

      if (value) {
        markerRef.current = L.marker([value.lat, value.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);

        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current.getLatLng();
          const addr = await reverseGeocode(pos.lat, pos.lng);
          setSearchQuery(addr);
          onChange({ lat: pos.lat, lng: pos.lng, address: addr });
        });
      }

      map.on("click", async (e: any) => {
        const { lat, lng } = e.latlng;
        placeMarker(L, map, lat, lng, pinIcon);
        const addr = await reverseGeocode(lat, lng);
        setSearchQuery(addr);
        onChange({ lat, lng, address: addr });
      });

      mapRef.current = map;
      setMapReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      if (mapContainerRef.current) mapContainerRef.current.innerHTML = "";
      setMapReady(false);
    };
  }, []);

  // ── Sync value → map ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    import("leaflet").then((L) => {
      if (!value) return;
      const map = mapRef.current;
      const pinIcon = makePinIcon(L);
      if (markerRef.current) {
        markerRef.current.setLatLng([value.lat, value.lng]);
      } else {
        markerRef.current = L.marker([value.lat, value.lng], {
          icon: pinIcon,
          draggable: true,
        }).addTo(map);
        markerRef.current.on("dragend", async () => {
          const pos = markerRef.current.getLatLng();
          const addr = await reverseGeocode(pos.lat, pos.lng);
          setSearchQuery(addr);
          onChange({ lat: pos.lat, lng: pos.lng, address: addr });
        });
      }
      map.setView([value.lat, value.lng], 15);
    });
  }, [value, mapReady]);

  function makePinIcon(L: any) {
    return L.divIcon({
      className: "",
      html: `<div style="width:32px;height:40px;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.35))">
        <svg viewBox="0 0 32 40" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%">
          <path d="M16 0C7.163 0 0 7.163 0 16c0 10.667 14.667 24 16 24S32 26.667 32 16C32 7.163 24.837 0 16 0z"
            fill="var(--accent, #285ebb)"/>
          <circle cx="16" cy="16" r="7" fill="white"/>
        </svg>
      </div>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    });
  }

  //places or moves the draggable map marker; wires up a dragend reverse-geocode on first placement
  function placeMarker(
    L: any,
    map: any,
    lat: number,
    lng: number,
    pinIcon: any,
  ) {
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
        setSearchQuery(addr);
        onChange({ lat: pos.lat, lng: pos.lng, address: addr });
      });
    }
  }

  //converts coordinates to a human-readable address via the reverse-geocode API
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
          data.displayName ||
          data.shortAddress ||
          `${lat.toFixed(5)}, ${lng.toFixed(5)}`
        );
      }
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  //debounced geocode search: fires 400ms after the user stops typing
  const doSearch = useCallback(
    debounce(async (q: string) => {
      if (!q.trim() || q.trim().length < 2) {
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
          setSearchResults(data.results ?? []);
          setShowDropdown(true);
          setActiveIndex(-1);
        }
      } finally {
        setIsSearching(false);
      }
    }, 400),
    [],
  );

  const handleSelectResult = (r: GeoResult) => {
    const fullAddress =
      [r.street, r.city, r.state, r.postcode].filter(Boolean).join(", ") ||
      r.shortName;
    setSearchQuery(fullAddress);
    setShowDropdown(false);
    setSearchResults([]);
    onChange({ lat: r.lat, lng: r.lng, address: fullAddress });
    mapRef.current?.setView([r.lat, r.lng], 16);
  };

  const handleUseMyLocation = () => {
    if (!navigator.geolocation) return;
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const addr = await reverseGeocode(lat, lng);
        setSearchQuery(addr);
        onChange({ lat, lng, address: addr });
        mapRef.current?.setView([lat, lng], 16);
        setIsLocating(false);
      },
      () => setIsLocating(false),
      { timeout: 10000 },
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown || searchResults.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, searchResults.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelectResult(searchResults[activeIndex]);
    } else if (e.key === "Escape") {
      setShowDropdown(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {/* Search row */}
      <div style={{ position: "relative" }}>
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
            background: "var(--bg-input)",
            border: "1.5px solid var(--border-input)",
            borderRadius: "10px",
            padding: "0 10px 0 14px",
            transition: "border-color 0.15s",
          }}
        >
          {/* Search icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-muted)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ flexShrink: 0 }}
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              doSearch(e.target.value);
            }}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (searchResults.length > 0) setShowDropdown(true);
            }}
            className="location-picker__input"
            placeholder={placeholderText}
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontFamily: "var(--font-body)",
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--text-primary)",
              padding: "11px 0",
            }}
          />

          {/* Loading spinner */}
          {isSearching && (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ flexShrink: 0, animation: "spin 0.8s linear infinite" }}
            >
              <path d="M12 2a10 10 0 0 1 10 10" />
            </svg>
          )}

          {/* Clear button */}
          {searchQuery && !isSearching && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery("");
                setSearchResults([]);
                setShowDropdown(false);
                onChange(null);
              }}
              style={{
                flexShrink: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "var(--text-muted)",
                fontSize: "18px",
                lineHeight: 1,
                padding: "0 2px",
              }}
            >
              ×
            </button>
          )}

          {/* Location button */}
          <button
            type="button"
            onClick={handleUseMyLocation}
            title={useLocationTitle}
            style={{
              flexShrink: 0,
              background: isLocating ? "var(--accent)" : "var(--bg-card)",
              border: "1px solid var(--border-input)",
              borderRadius: "7px",
              cursor: "pointer",
              padding: "5px 8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.15s",
            }}
          >
            {isLocating ? (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#fff"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ animation: "spin 0.8s linear infinite" }}
              >
                <path d="M12 2a10 10 0 0 1 10 10" />
              </svg>
            ) : (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="3" />
                <path d="M12 1v4M12 19v4M1 12h4M19 12h4" />
              </svg>
            )}
          </button>
        </div>

        {/* Dropdown results */}
        {showDropdown && searchResults.length > 0 && (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "var(--bg-card)",
              border: "1.5px solid var(--border-default)",
              borderRadius: "12px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.22)",
              zIndex: 9999,
              overflow: "hidden",
            }}
          >
            {searchResults.map((r, i) => (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleSelectResult(r);
                }}
                onMouseEnter={() => setActiveIndex(i)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "11px 14px",
                  border: "none",
                  borderBottom:
                    i < searchResults.length - 1
                      ? "1px solid var(--border-default)"
                      : "none",
                  background:
                    i === activeIndex ? "var(--bg-input)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "background 0.1s",
                }}
              >
                {/* Icon */}
                <span
                  style={{
                    fontSize: "18px",
                    flexShrink: 0,
                    marginTop: "1px",
                    width: "24px",
                    textAlign: "center",
                  }}
                >
                  {placeIcon(r.type)}
                </span>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Primary name (e.g. "McDonald's") */}
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.855rem",
                      fontWeight: 600,
                      color: "var(--text-primary)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {r.primaryName ||
                      r.street ||
                      r.city ||
                      r.shortName.split(",")[0]}
                  </div>
                  {/* Secondary address */}
                  <div
                    style={{
                      fontFamily: "var(--font-body)",
                      fontSize: "0.76rem",
                      color: "var(--text-muted)",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      marginTop: "1px",
                    }}
                  >
                    {[r.street, r.city, r.state, r.postcode]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                </div>

                {/* Arrow */}
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="var(--text-muted)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ flexShrink: 0, marginTop: "4px" }}
                >
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            ))}

            {/* Footer attribution */}
            <div
              style={{
                padding: "6px 14px",
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                fontFamily: "var(--font-body)",
                borderTop: "1px solid var(--border-default)",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              {attributionText}
            </div>
          </div>
        )}

        {/* No results state */}
        {showDropdown &&
          !isSearching &&
          searchResults.length === 0 &&
          searchQuery.trim().length >= 2 && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 6px)",
                left: 0,
                right: 0,
                background: "var(--bg-card)",
                border: "1.5px solid var(--border-default)",
                borderRadius: "12px",
                padding: "16px 14px",
                zIndex: 9999,
                textAlign: "center",
                fontFamily: "var(--font-body)",
                fontSize: "0.82rem",
                color: "var(--text-muted)",
              }}
            >
              {noResultsText}
            </div>
          )}
      </div>

      {/* Map */}
      <div
        style={{
          height: showDropdown ? 0 : 220,
          borderRadius: 12,
          overflow: "hidden",
          border: showDropdown ? "none" : "1.5px solid var(--border-default)",
          position: "relative",
          transform: "translateZ(0)",
          transition: "height 0.2s ease, border 0.2s ease",
        }}
      >
        <div ref={mapContainerRef} style={{ width: "100%", height: "100%" }} />
        {!mapReady && !showDropdown && (
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
            {loadingMapText}
          </div>
        )}
      </div>

      {/* Selected location pill */}
      {value && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "7px 12px",
            background: "rgba(var(--accent-rgb, 40,94,187), 0.08)",
            border: "1px solid rgba(var(--accent-rgb, 40,94,187), 0.2)",
            borderRadius: "8px",
          }}
        >
          <span style={{ fontSize: "13px" }}>📍</span>
          <span
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.78rem",
              fontWeight: 500,
              color: "var(--accent)",
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {value.address}
          </span>
          <span
            style={{
              fontSize: "0.7rem",
              color: "var(--text-muted)",
              fontFamily: "var(--font-body)",
              flexShrink: 0,
            }}
          >
            {value.lat.toFixed(4)}, {value.lng.toFixed(4)}
          </span>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
