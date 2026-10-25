import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GROQ_TEXT_MODEL } from "@/lib/aiPrompts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

//POST /api/match-check - cross-matches a new report against the opposite table, returns top 3 potential matches
export async function POST(req: NextRequest) {
  const { query, mode } = await req.json();
  if (!query?.trim()) return NextResponse.json({ items: [] });

  // mode="found": user is reporting a found item → check lost_items for matches
  // mode="lost": user is reporting a lost item → check items (found) for matches
  let allItems: any[] = [];

  if (mode === "found") {
    const { data, error } = await supabase
      .from("lost_items")
      .select(
        "id, name, description, image_url, image_urls, category, location, created_at, author_name, author_avatar",
      )
      .eq("status", "looking")
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) allItems = data;
  } else {
    const { data, error } = await supabase
      .from("items")
      .select(
        "id, name, description, image_url, image_urls, category, location, date_found, author_name, author_avatar, ai_keywords",
      )
      .neq("status", "claimed")
      .neq("status", "returned")
      .order("date_found", { ascending: false })
      .limit(100);
    if (!error && data) allItems = data;
  }

  if (allItems.length === 0) return NextResponse.json({ items: [] });

  const dateField = mode === "found" ? "created_at" : "date_found";

  const catalogue = allItems
    .map((item) => {
      const desc = (item.description ?? "").slice(0, 80);
      const keywords = item.ai_keywords ?? "";
      const cat = item.category ?? "";
      return `${item.id}|${item.name}|${cat}|${keywords}|${desc}`;
    })
    .join("\n");

  const prompt = `You are a semantic matching engine for a lost-and-found app.

Someone just reported: "${query}"

Below is a catalogue of ${mode === "found" ? "lost item reports" : "found items"} in the format:
id|name|category|ai_keywords|description

${catalogue}

Instructions:
- Match items SEMANTICALLY, not just by exact keywords.
- "water bottle" matches "bottle", "hydro flask", "thermos", "container" etc.
- "phone" matches "electronics", "device", "Samsung", "Apple", "mobile" etc.
- "bag" matches "backpack", "purse", "tote", "satchel", "luggage" etc.
- Return ONLY a raw JSON array of the top 3 best-matching item IDs, ordered best match first.
- Only include items that are genuinely the same type of object.
- If nothing is a reasonable match, return [].
- No markdown, no explanation — just the raw JSON array of integer IDs.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY_2}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        max_tokens: 1024, //gpt-oss reasons before answering, so leave room for the JSON answer
        temperature: 0,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) return NextResponse.json({ items: [] });

    const data = await res.json();
    const textContent = data.choices?.[0]?.message?.content ?? "[]";
    const raw = textContent.replace(/```json|```/g, "").trim();
    const matchedIds: number[] = JSON.parse(raw);

    if (matchedIds.length === 0) return NextResponse.json({ items: [] });

    const idToItem = new Map(allItems.map((i) => [i.id, i]));
    const results = matchedIds
      .slice(0, 3)
      .map((id) => {
        const item = idToItem.get(id);
        if (!item) return null;

        let imageUrl = item.image_url ?? null;
        if (item.image_urls) {
          const urls = Array.isArray(item.image_urls)
            ? item.image_urls
            : (() => {
                try {
                  return JSON.parse(item.image_urls);
                } catch {
                  return [];
                }
              })();
          if (urls.length > 0) imageUrl = urls[0];
        }

        return {
          id: item.id,
          name: item.name,
          image: imageUrl,
          category: item.category ?? null,
          location: item.location ?? null,
          description: (item.description ?? "").slice(0, 120),
          postedAt: item[dateField] ?? null,
          authorName: item.author_name ?? null,
          authorAvatar: item.author_avatar ?? null,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: results });
  } catch (err) {
    console.error("match-check error:", err);
    return NextResponse.json({ items: [] });
  }
}
