//builds test/validation/catalog.json = live found items (read-only, same query as /api/similar-items) + hand-made test items
//usage: npm run build:catalog
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "test", "validation");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (expected in .env.local).");
  process.exit(1);
}
const supabase = createClient(url, key);

//same columns, filter, order and limit as src/app/api/similar-items/route.ts (select only, nothing is written)
const { data, error } = await supabase
  .from("items")
  .select("id, name, description, image_url, image_urls, ai_keywords, category, location, status")
  .neq("status", "claimed")
  .neq("status", "returned")
  .order("date_found", { ascending: false })
  .limit(200);

if (error) {
  console.error("Supabase error:", error.message);
  process.exit(1);
}

//catalog.json is committed, so keep only what the prompt and runner use (no locations, image urls, author names/avatars)
const pick = (item, tag_source) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  description: item.description,
  ai_keywords: item.ai_keywords,
  tag_source,
});

const dbItems = data.map((item) => pick(item, "groq"));
const testItems = JSON.parse(readFileSync(path.join(DIR, "test_items.json"), "utf8")).map((item) => pick(item, item.tag_source));

//test ids must not collide with real ids, or ranks would be ambiguous
const dbIds = new Set(dbItems.map((i) => i.id));
const clashes = testItems.filter((t) => dbIds.has(t.id)).map((t) => t.id);
if (clashes.length) {
  console.error(`Test item ids already exist in the database: ${clashes.join(", ")}. Catalog not written.`);
  process.exit(1);
}

//db items keep the route's newest-first order; test items follow in id order
const catalog = [...dbItems, ...testItems];
writeFileSync(path.join(DIR, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");

console.log(`DB items:   ${dbItems.length}`);
console.log(`Test items: ${testItems.length}`);
console.log(`Total:      ${catalog.length}`);
console.log(`Wrote ${path.relative(ROOT, path.join(DIR, "catalog.json"))}`);
