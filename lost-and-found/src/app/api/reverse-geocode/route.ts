import { NextRequest, NextResponse } from "next/server";

// Reverse geocode: lat/lng -> address string
export async function POST(req: NextRequest) {
  const { lat, lng } = await req.json();
  if (lat === undefined || lng === undefined)
    return NextResponse.json({ error: "Missing lat/lng" }, { status: 400 });

  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=17&addressdetails=1`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": "Finder-LostAndFound/1.0 (contact@finder.app)",
      "Accept-Language": "en",
    },
  });

  if (!res.ok)
    return NextResponse.json(
      { error: "Reverse geocoding failed" },
      { status: 500 },
    );

  const data = await res.json();

  // Build a short, human-friendly address
  const a = data.address || {};
  const shortAddress = [
    a.amenity || a.building || a.road || a.pedestrian,
    a.suburb || a.neighbourhood || a.quarter,
    a.city || a.town || a.village,
    a.state,
  ]
    .filter(Boolean)
    .join(", ");

  return NextResponse.json({
    displayName: data.display_name || "",
    shortAddress: shortAddress || data.display_name || "",
  });
}
