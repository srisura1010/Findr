import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GROQ_TEXT_MODEL } from "@/lib/aiPrompts";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

//POST /api/school-similar-items - returns up to 6 semantically similar items within a specific school
export async function POST(req: NextRequest) {
  const { query, school_id, exclude_id } = await req.json();
  if (!query?.trim() || !school_id) return NextResponse.json({ items: [] });

  //fetch school-scoped items only
  const { data: allItems, error } = await supabase
    .from("school_items")
    .select("id, name, description, image_url, image_urls, ai_keywords, category, location, status")
    .eq("school_id", school_id)
    .neq("status", "claimed")
    .neq("status", "returned")
    .order("date_found", { ascending: false })
    .limit(200);

  if (error || !allItems || allItems.length === 0)
    return NextResponse.json({ items: [] });

  //exclude the item the user is currently viewing from suggestions
  const candidates = allItems.filter((i) => i.id !== exclude_id);
  if (candidates.length === 0) return NextResponse.json({ items: [] });

  const catalogue = candidates
    .map((item) => {
      const desc = (item.description ?? "").slice(0, 80);
      const keywords = item.ai_keywords ?? "";
      const cat = item.category ?? "";
      return `${item.id}|${item.name}|${cat}|${keywords}|${desc}`;
    })
    .join("\n");

  const prompt = `You are a semantic search engine for a school lost-and-found app.

The current item is: "${query}"

Below is the catalogue of other lost items at the same school in the format:
id|name|category|ai_keywords|description

${catalogue}

Instructions:
- Match items SEMANTICALLY, not just by exact keywords.
- A search for "phone" should match items tagged "electronics", "device", "Samsung", "Apple", "mobile" etc even if the word "phone" never appears.
- A search for "bag" should match "backpack", "purse", "tote", "satchel", "luggage" etc.
- Return ONLY a raw JSON array of the top matching item IDs (up to 6), ordered best match first.
- If nothing is a reasonable match, return an empty array [].
- No markdown, no explanation, just the JSON array of integer IDs.`;

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY_4}`,
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        max_tokens: 1024, //gpt-oss reasons before answering, so leave room for the JSON answer
        temperature: 0,
        reasoning_effort: "low",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      console.error("Groq school-similar-items error:", err);
      return NextResponse.json({ items: [] });
    }

    const data = await res.json();
    const textContent = data.choices?.[0]?.message?.content ?? "[]";
    const raw = textContent.replace(/```json|```/g, "").trim();
    const matchedIds: number[] = JSON.parse(raw);

    if (matchedIds.length === 0) return NextResponse.json({ items: [] });

    const idToItem = new Map(candidates.map((i) => [i.id, i]));
    const results = matchedIds
      .map((id) => {
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
        };
      })
      .filter(Boolean);

    return NextResponse.json({ items: results });
  } catch (error) {
    console.error("School similar items error:", error);
    return NextResponse.json({ items: [] });
  }
}
