import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function GET() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, description, image_url, image_urls, category, location, status")
    .neq("status", "claimed")
    .order("date_found", { ascending: false })
    .limit(15);

  if (error || !data) return NextResponse.json({ items: [] });

  const items = data.map((row) => {
    let image = row.image_url as string | null;
    if (row.image_urls) {
      const urls = Array.isArray(row.image_urls)
        ? row.image_urls
        : typeof row.image_urls === "string"
        ? JSON.parse(row.image_urls)
        : [];
      if (urls.length > 0) image = urls[0];
    }
    return {
      id:          row.id,
      name:        row.name,
      image,
      category:    row.category,
      location:    row.location,
      description: row.description,
      status:      row.status,
      score:       0,
    };
  });

  return NextResponse.json({ items });
}