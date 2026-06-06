import { NextRequest, NextResponse } from "next/server";

// Forward geocode: address -> lat/lng
export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query) return NextResponse.json({ error: "No query" }, { status: 400 });

  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Findr-LostAndFound/1.0 (contact@findr.app)",
      "Accept-Language": "en",
    },
  });

  if (!res.ok)
    return NextResponse.json({ error: "Geocoding failed" }, { status: 500 });

  const data = await res.json();
  const results = data.map((r: any) => ({
    displayName: r.display_name,
    lat: parseFloat(r.lat),
    lng: parseFloat(r.lon),
    shortName:
      [
        r.address?.amenity ||
          r.address?.building ||
          r.address?.road ||
          r.address?.pedestrian,
        r.address?.suburb || r.address?.neighbourhood || r.address?.quarter,
        r.address?.city || r.address?.town || r.address?.village,
      ]
        .filter(Boolean)
        .join(", ") || r.display_name,
  }));

  return NextResponse.json({ results });
}
