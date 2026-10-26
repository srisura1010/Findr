//shared Groq settings and prompt builders for the AI routes, also imported by scripts/validate-matching.mjs
//keep this file plain TS (no enums/namespaces) so Node can strip the types and run it directly

//text model for search ranking, match checks and the support chatbot (llama-3.3-70b-versatile was retired by Groq)
export const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";

//vision model for photo tagging in /api/image-search (the only image-capable model on our Groq keys)
export const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";

export type CatalogueItem = {
  id: number | string;
  name: string;
  category?: string | null;
  ai_keywords?: string | null;
  description?: string | null;
};

//build a pipe-delimited catalogue string the LLM will rank
export function buildCatalogue(items: CatalogueItem[]): string {
  return items
    .map((item) => {
      const desc = (item.description ?? "").slice(0, 80);
      const keywords = item.ai_keywords ?? "";
      const cat = item.category ?? "";
      return `${item.id}|${item.name}|${cat}|${keywords}|${desc}`;
    })
    .join("\n");
}

//prompt for /api/similar-items: rank up to 10 items for a search query
export function buildSimilarItemsPrompt(query: string, items: CatalogueItem[]): string {
  const catalogue = buildCatalogue(items);

  return `You are a semantic search engine for a lost-and-found app.

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
}

//prompt for /api/match-check: mode="found" checks lost reports, mode="lost" checks found items
export function buildMatchCheckPrompt(query: string, mode: string, items: CatalogueItem[]): string {
  const catalogue = buildCatalogue(items);

  return `You are a semantic matching engine for a lost-and-found app.

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
}
