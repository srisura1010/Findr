// app/api/geocode/route.ts
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { query } = await req.json();
    if (!query?.trim()) {
      return NextResponse.json({ results: [] });
    }

    // Use Nominatim with a viewbox bias toward the US for better local results
    const params = new URLSearchParams({
      q: query,
      format: "json",
      addressdetails: "1",
      limit: "6",
      countrycodes: "us", // bias to US — remove if you want global
      "accept-language": "en",
    });

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?${params}`,
      {
        headers: {
          // Nominatim requires a descriptive User-Agent
          "User-Agent": "Findr-LostAndFound-App/1.0 (contact@yourapp.com)",
        },
      },
    );

    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }

    const data = await res.json();

    // Shape each result into something the picker can use
    const results = (data as any[]).map((place) => {
      const addr = place.address ?? {};

      // Build a short human-readable name (like Google Maps style)
      const nameParts: string[] = [];

      // Primary name: amenity/shop/tourism name if present
      const primaryName =
        addr.amenity ||
        addr.shop ||
        addr.tourism ||
        addr.leisure ||
        addr.office ||
        addr.building ||
        place.namedetails?.name ||
        null;

      if (primaryName) nameParts.push(primaryName);

      // Street address
      const houseNumber = addr.house_number ?? "";
      const road = addr.road ?? addr.pedestrian ?? addr.footway ?? "";
      if (road) {
        nameParts.push(houseNumber ? `${houseNumber} ${road}` : road);
      }

      // City / suburb
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        "";
      if (city) nameParts.push(city);

      // State abbreviation
      if (addr.state) nameParts.push(addr.state);

      // Zip
      if (addr.postcode) nameParts.push(addr.postcode);

      const shortName = nameParts.join(", ") || place.display_name;

      return {
        lat: parseFloat(place.lat),
        lng: parseFloat(place.lon),
        shortName,
        displayName: place.display_name,
        type: place.type,
        // Extra fields for richer UI
        street: road ? (houseNumber ? `${houseNumber} ${road}` : road) : null,
        city,
        state: addr.state ?? null,
        postcode: addr.postcode ?? null,
        primaryName: primaryName ?? null,
      };
    });

    return NextResponse.json({ results });
  } catch (err) {
    console.error("Geocode error:", err);
    return NextResponse.json({ results: [] });
  }
}
