import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  const { query } = await req.json();
  if (!query?.trim()) return NextResponse.json({ items: [] });

  const { data: allItems, error } = await supabase
    .from("items")
    .select(
      "id, name, description, image_url, image_urls, ai_keywords, category, location, status",
    )
    .neq("status", "claimed")
    .neq("status", "returned")
    .order("date_found", { ascending: false })
    .limit(200);

  if (error || !allItems || allItems.length === 0)
    return NextResponse.json({ items: [] });

  const catalogue = allItems
    .map((item) => {
      const desc = (item.description ?? "").slice(0, 80);
      const keywords = item.ai_keywords ?? "";
      const cat = item.category ?? "";
      return `${item.id}|${item.name}|${cat}|${keywords}|${desc}`;
    })
    .join("\n");

  const prompt = `You are a semantic search engine for a lost-and-found app.

User is searching for: "${query}"

Below is the catalogue of lost items in the format:
id|name|category|ai_keywords|description

${catalogue}

Instructions:
- Match items SEMANTICALLY, not just by exact keywords.
- A search for "phone" should match items tagged "electronics", "device", "Samsung", "Apple", "mobile" etc even if the word "phone" never appears.
- A search for "bag" should match "backpack", "purse", "tote", "satchel", "luggage" etc.
- Return ONLY a raw JSON array of the top matching item IDs (up to 10), ordered best match first.
- If nothing is a reasonable match, return an empty array [].
- No markdown, no explanation, just the JSON array of integer IDs.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY_3}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 200,
        temperature: 0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Groq similar-items error:", err);
      return NextResponse.json({ items: [] });
    }

    const data = await res.json();
    const textContent = data.choices?.[0]?.message?.content ?? "[]";
    const raw = textContent.replace(/```json|```/g, "").trim();
    const matchedIds: number[] = JSON.parse(raw);

    if (matchedIds.length === 0) return NextResponse.json({ items: [] });

    const idToItem = new Map(allItems.map((i) => [i.id, i]));
    const results = matchedIds
      .map((id, rank) => {
        const item = idToItem.get(id);
        if (!item) return null;

        let imageUrl = item.image_url;
        if (item.image_urls) {
          const urls = Array.isArray(item.image_urls)
            ? item.image_urls
            : typeof item.image_urls === "string"
              ? JSON.parse(item.image_urls)
              : [];
          if (urls.length > 0) imageUrl = urls[0];
        }

        return {
          id: item.id,
          name: item.name,
          image: imageUrl,
          category: item.category,
          location: item.location,
          status: item.status,
          score: matchedIds.length - rank,
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: results });
  } catch (error) {
    console.error("Similar items error:", error);
    return NextResponse.json({ items: [] });
  }
}
