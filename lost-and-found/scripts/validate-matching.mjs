//offline validation of Findr's AI search against test/validation/queries.csv
//usage: npm run validate:matching            (dry run: prints planned Groq calls + token estimate)
//       npm run validate:matching -- --yes   (makes the uncached Groq calls, then writes results)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { GROQ_TEXT_MODEL, buildSimilarItemsPrompt, buildMatchCheckPrompt } from "../src/lib/aiPrompts.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "test", "validation");
const CATALOG_PATH = path.join(DIR, "catalog.json");
const QUERIES_PATH = path.join(DIR, "queries.csv");
const CACHE_PATH = path.join(DIR, "cache.json");
const RESULTS_PATH = path.join(DIR, "results.csv");
const DOC_PATH = path.join(ROOT, "docs", "VALIDATION.md");

const MODEL = GROQ_TEXT_MODEL;
const REASONING_EFFORT = "low";
//output tokens per ranking call (reasoning + answer) measured on gpt-oss-120b test calls: 88-154; used for the dry-run estimate
const EST_OUTPUT_TOKENS = 150;
const THROTTLE_MS = 10000;
const TYPES = ["minimal", "rambler", "brand", "typo", "misremember", "absent"];

//settings copied from the routes: model, max_tokens 1024, temperature 0, reasoning_effort low
//keys: search calls alternate by row (odd rows key 3, even rows key 4) to spread rate limits; match-check uses key 2 like its route
const PROMPTS = {
  similar: { envKey: (rowNum) => (rowNum % 2 === 1 ? "GROQ_API_KEY_3" : "GROQ_API_KEY_4"), maxTokens: 1024, build: (q, items) => buildSimilarItemsPrompt(q, items) },
  match_lost: { envKey: () => "GROQ_API_KEY_2", maxTokens: 1024, build: (q, items) => buildMatchCheckPrompt(q, "lost", items) },
};

// ── inputs ───────────────────────────────────────────────────────────────────

//minimal RFC 4180 parser so queries may contain commas and quotes
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((f) => f.trim() !== ""));
}

if (!existsSync(CATALOG_PATH)) {
  console.error("test/validation/catalog.json not found. Run `npm run build:catalog` first.");
  process.exit(1);
}
const catalog = JSON.parse(readFileSync(CATALOG_PATH, "utf8"));
const catalogHash = createHash("sha256").update(JSON.stringify(catalog)).digest("hex").slice(0, 12);
const idToItem = new Map(catalog.map((i) => [i.id, i]));

const [header, ...body] = parseCsv(readFileSync(QUERIES_PATH, "utf8").replace(/^﻿/, ""));
const cols = header.map((h) => h.trim());
for (const need of ["query", "type", "expected_id", "match_check"]) {
  if (!cols.includes(need)) {
    console.error(`queries.csv is missing the "${need}" column.`);
    process.exit(1);
  }
}
const rows = body.map((r, i) => {
  const get = (name) => (r[cols.indexOf(name)] ?? "").trim();
  return {
    line: i + 2,
    query: get("query"),
    type: get("type").toLowerCase(),
    expectedRaw: get("expected_id"),
    expectedIds: [],
    matchCheck: get("match_check").toLowerCase() === "yes",
  };
});

if (rows.length === 0) {
  console.log("queries.csv has no rows yet. Nothing to run; no Groq calls made and no results written.");
  process.exit(0);
}

//expected_id is "|"-separated; each part is a numeric id or DB:<exact name> of a database (tag_source "groq") item
const resolved = new Map();
function resolveExpected(part, line, problems) {
  if (!part.startsWith("DB:")) {
    const id = Number(part);
    if (!idToItem.has(id)) problems.push(`line ${line}: expected id "${part}" is not in catalog.json`);
    return id;
  }
  const name = part.slice(3);
  const hits = catalog.filter((i) => i.tag_source === "groq" && i.name === name);
  if (hits.length !== 1) {
    const found = hits.length ? ` (ids ${hits.map((i) => i.id).join(", ")})` : "";
    problems.push(`line ${line}: ${part} matches ${hits.length} database items${found}; it must match exactly 1`);
    return null;
  }
  resolved.set(part, hits[0].id);
  return hits[0].id;
}

const problems = [];
for (const r of rows) {
  if (!r.query) problems.push(`line ${r.line}: empty query`);
  if (!TYPES.includes(r.type)) problems.push(`line ${r.line}: type "${r.type}" is not one of ${TYPES.join(", ")}`);
  if (r.type === "absent" && r.expectedRaw !== "") problems.push(`line ${r.line}: absent rows must leave expected_id blank`);
  if (r.type !== "absent" && r.expectedRaw === "") problems.push(`line ${r.line}: expected_id is required for type "${r.type}"`);
  if (r.expectedRaw !== "") {
    r.expectedIds = r.expectedRaw.split("|").map((p) => resolveExpected(p.trim(), r.line, problems));
  }
}
if (problems.length) {
  console.error("queries.csv has problems:\n  " + problems.join("\n  "));
  process.exit(1);
}
if (resolved.size) {
  console.log("Resolved DB: names:");
  for (const [part, id] of [...resolved].sort((a, b) => a[0].localeCompare(b[0]))) console.log(`  ${part.padEnd(26)} -> ${id}`);
}

// ── groq calls (cached) ──────────────────────────────────────────────────────

const cache = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf8")) : {};
const saveCache = () => writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2) + "\n", "utf8");
const cacheKey = (kind, query) => `${kind}::${query}`;

const tasks = new Map();
rows.forEach((r, i) => {
  for (const kind of r.matchCheck ? ["similar", "match_lost"] : ["similar"]) {
    const key = cacheKey(kind, r.query);
    if (!tasks.has(key)) {
      tasks.set(key, { key, kind, query: r.query, envKey: PROMPTS[kind].envKey(i + 1), prompt: PROMPTS[kind].build(r.query, catalog) });
    }
  }
});
const pending = [...tasks.values()].filter((t) => !(t.key in cache));
const estTokens = Math.round(pending.reduce((sum, t) => sum + t.prompt.length, 0) / 4);

console.log(`Catalog: ${catalog.length} items (hash ${catalogHash}). Queries: ${rows.length}.`);
console.log(`Groq calls needed: ${pending.length} of ${tasks.size} (${tasks.size - pending.length} cached).`);
console.log(`Estimated input tokens for those calls: ~${estTokens.toLocaleString()} (chars / 4).`);
console.log(`Expected output tokens (reasoning + answer): ~${(pending.length * EST_OUTPUT_TOKENS).toLocaleString()} (~${EST_OUTPUT_TOKENS}/call), at most ${(pending.length * PROMPTS.similar.maxTokens).toLocaleString()} (max_tokens cap).`);

const stale = [...tasks.values()].filter((t) => cache[t.key] && cache[t.key].catalogHash !== catalogHash);
if (stale.length) {
  console.warn(`Warning: ${stale.length} cached responses were made against a different catalog. Delete test/validation/cache.json to re-run them.`);
}

//never process.exit() after a fetch: on Windows that can crash Node while the keep-alive socket closes.
//returns null when every call succeeded, otherwise the exit code to stop with (progress is already saved)
async function runCalls(pending) {
  for (let i = 0; i < pending.length; i++) {
    const t = pending[i];
    if (i > 0) await new Promise((r) => setTimeout(r, THROTTLE_MS));
    process.stdout.write(`[${i + 1}/${pending.length}] ${t.kind} (${t.envKey}) "${t.query}" ... `);

    let res;
    try {
      res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env[t.envKey]}` },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: PROMPTS[t.kind].maxTokens,
          temperature: 0,
          reasoning_effort: REASONING_EFFORT,
          messages: [{ role: "user", content: t.prompt }],
        }),
      });
    } catch (err) {
      saveCache();
      console.error(`network error: ${err.message}. Progress saved; re-run to resume.`);
      return 1;
    }

    if (res.status === 429) {
      saveCache();
      const retry = res.headers.get("retry-after");
      await res.text().catch(() => ""); //drain the body so the socket can close and Node exits on its own
      console.log(`rate limited (HTTP 429). Progress saved (${i} new responses cached).`);
      console.log(`Retry after: ${retry ? `${retry} seconds` : "not given by Groq"}. Re-run the same command to resume.`);
      return 0;
    }
    if (!res.ok) {
      saveCache();
      console.error(`HTTP ${res.status}: ${await res.text()}\nProgress saved; re-run to resume.`);
      return 1;
    }

    const data = await res.json();
    cache[t.key] = {
      content: data.choices?.[0]?.message?.content ?? "[]",
      model: data.model ?? MODEL,
      keyName: t.envKey,
      usage: data.usage ?? null,
      catalogHash,
      at: new Date().toISOString(),
    };
    saveCache();
    console.log("ok");
  }
  return null;
}

// ── scoring ──────────────────────────────────────────────────────────────────

//same parsing as the routes: strip code fences, JSON.parse (failure -> no results), drop ids not in the catalogue
function parseIds(content) {
  try {
    const parsed = JSON.parse(content.replace(/```json|```/g, "").trim());
    if (!Array.isArray(parsed)) return { ids: [], parseError: true };
    return { ids: parsed.filter((id) => idToItem.has(id)), parseError: false };
  } catch {
    return { ids: [], parseError: true };
  }
}

//keyword baseline: lowercase, drop apostrophes, other punctuation -> spaces, count distinct shared words
const words = (s) => new Set(String(s ?? "").toLowerCase().replace(/'/g, "").replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean));
const itemWords = new Map(
  catalog.map((i) => [i.id, words([i.name, i.category, i.description, i.ai_keywords].map((f) => f ?? "").join(" "))]),
);
function baselineRanking(query) {
  const q = [...words(query)];
  return catalog
    .map((i) => ({ id: i.id, score: q.filter((w) => itemWords.get(i.id).has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.id - b.id)
    .map((x) => x.id);
}

//best (lowest) 1-based rank of any accepted id, or null if none were returned
const rankOf = (ids, expected) => {
  const ranks = expected.map((id) => ids.indexOf(id) + 1).filter((r) => r > 0);
  return ranks.length ? Math.min(...ranks) : null;
};

function writeOutputs() {
  const results = rows.map((r) => {
    const sim = parseIds(cache[cacheKey("similar", r.query)].content);
    const out = {
      query: r.query,
      type: r.type,
      expected_id: r.expectedRaw,
      expected_ids: r.expectedIds,
      findr_rank: rankOf(sim.ids, r.expectedIds),
      baseline_rank: rankOf(baselineRanking(r.query), r.expectedIds),
      findr_ids: sim.ids,
      findr_parse_error: sim.parseError,
      findr_returned_any: sim.ids.length > 0,
      match_check: r.matchCheck,
      match_rank: null,
      match_ids: [],
      match_parse_error: false,
    };
    if (r.matchCheck) {
      const mc = parseIds(cache[cacheKey("match_lost", r.query)].content);
      out.match_rank = rankOf(mc.ids, r.expectedIds);
      out.match_ids = mc.ids;
      out.match_parse_error = mc.parseError;
    }
    return out;
  });

  // ── outputs ──────────────────────────────────────────────────────────────────

  const csvCell = (v) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rankCell = (res, rank) => (res.type === "absent" ? "" : rank ?? "not found");
  const csvHeader = [
    "query", "type", "expected_id", "expected_ids", "findr_rank", "baseline_rank", "findr_ids", "findr_parse_error",
    "absent_findr_returned_any", "match_check", "match_check_rank", "match_check_ids", "search_key", "match_check_key",
  ];
  const csvRows = results.map((x) => [
    x.query, x.type, x.expected_id, x.expected_ids.join(" "), rankCell(x, x.findr_rank), rankCell(x, x.baseline_rank),
    x.findr_ids.join(" "), x.findr_parse_error ? "yes" : "",
    x.type === "absent" ? (x.findr_returned_any ? "yes" : "no") : "",
    x.match_check ? "yes" : "", x.match_check ? rankCell(x, x.match_rank) : "", x.match_ids.join(" "),
    cache[cacheKey("similar", x.query)].keyName ?? "",
    x.match_check ? cache[cacheKey("match_lost", x.query)].keyName ?? "" : "",
  ].map(csvCell).join(","));
  writeFileSync(RESULTS_PATH, [csvHeader.join(","), ...csvRows].join("\n") + "\n", "utf8");

  const pct = (n, d) => (d === 0 ? "n/a" : `${Math.round((100 * n) / d)}%`);
  const within = (rank, k) => rank !== null && rank <= k;

  const typeRows = TYPES.filter((t) => t !== "absent").map((t) => {
    const rs = results.filter((x) => x.type === t);
    return [t, rs.length,
      pct(rs.filter((x) => within(x.findr_rank, 1)).length, rs.length),
      pct(rs.filter((x) => within(x.findr_rank, 3)).length, rs.length),
      pct(rs.filter((x) => within(x.baseline_rank, 3)).length, rs.length)];
  });
  const present = results.filter((x) => x.type !== "absent");
  typeRows.push(["**all (excl. absent)**", present.length,
    pct(present.filter((x) => within(x.findr_rank, 1)).length, present.length),
    pct(present.filter((x) => within(x.findr_rank, 3)).length, present.length),
    pct(present.filter((x) => within(x.baseline_rank, 3)).length, present.length)]);

  const absent = results.filter((x) => x.type === "absent");
  const absentHits = absent.filter((x) => x.findr_returned_any).length;
  //the keyword baseline "returns" an item whenever any word overlaps (score >= 1)
  const absentBaseHits = absent.filter((x) => baselineRanking(x.query).length > 0).length;

  //present queries where the expected item was not in Findr's top 3
  const nameOf = (id) => `${id} ${idToItem.get(id)?.name ?? "?"}`;
  const misses = present.filter((x) => !within(x.findr_rank, 3));
  const misremember = present.filter((x) => x.type === "misremember");
  const others = present.filter((x) => x.type !== "misremember");

  const mcRows = results.filter((x) => x.match_check);
  const mcPresent = mcRows.filter((x) => x.type !== "absent");
  const mcAbsent = mcRows.filter((x) => x.type === "absent");

  const dbCount = catalog.filter((i) => i.tag_source === "groq").length;
  const testCount = catalog.filter((i) => i.tag_source === "claude").length;
  const catCounts = catalog.reduce((m, i) => m.set(i.category, (m.get(i.category) ?? 0) + 1), new Map());
  const sharedCat = catalog.filter((i) => catCounts.get(i.category) > 1).length;
  const catSummary = [...catCounts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([c, n]) => `${c} ${n}`).join(", ");
  const parseErrors = results.filter((x) => x.findr_parse_error || x.match_parse_error).length;
  const models = [...new Set([...tasks.keys()].map((k) => cache[k].model ?? MODEL))].join(", ");

  const QUERY_SOURCE =
    "Queries were simulated by an AI model (ChatGPT) using five student writing-style personas (minimal, rambler, brand-only, typo, misremembers) and only the owner's memory of each item; it never saw the listings or tags. Queries for indistinguishable listings (three phone posts, two calculators for the generic 'calculator' query) accept any matching listing. One near-duplicate 'absent' query was removed because the item was in the catalog. AI-written queries may be cleaner than real student searches.";

  const table = (head, body) =>
    [`| ${head.join(" | ")} |`, `| ${head.map(() => "---").join(" | ")} |`, ...body.map((r) => `| ${r.join(" | ")} |`)].join("\n");

  const doc = `# Findr AI Search Validation

_Generated by \`npm run validate:matching\` on ${new Date().toISOString().slice(0, 10)}. Raw per-query results: \`test/validation/results.csv\`._

## Method

- **What was tested:** the existing AI search (\`/api/similar-items\`) and, for selected rows, the lost-report match check (\`/api/match-check\`, mode \`lost\`). Prompts come from the same \`src/lib/aiPrompts.ts\` builders the live routes use, sent to Groq with the routes' settings (model \`${MODEL}\`, temperature 0, reasoning_effort ${REASONING_EFFORT}, max_tokens ${PROMPTS.similar.maxTokens}). Responses are parsed the way the routes parse them: unparseable output counts as "no results", and ids not in the catalog are dropped.
- **Catalog:** ${catalog.length} found items (catalog hash \`${catalogHash}\`): ${dbCount} live items read from the database with the route's own filter (not claimed/returned, newest first), plus ${testCount} test items with photos (ids 9001-9017) appended after them. ${sharedCat} of ${catalog.length} items share a category with at least one other item, so the right answer usually has look-alike distractors (items per category: ${catSummary}).
- **Queries:** ${rows.length} queries (${present.length} for items in the catalog, ${absent.length} for items that are not), labeled by type: ${TYPES.join(", ")}. ${QUERY_SOURCE}
- **Scoring:** "rank" is the 1-based position of the expected item in the returned list; when a row accepts several listings, the best rank among them counts. Top-1 = the right item came first; top-3 = it was in the first three.
- **Keyword baseline (no AI):** lowercase both sides, strip punctuation, count distinct words shared between the query and each item's name + category + description + keywords; rank by that count, ties by id. No stemming or stop-word removal.
- **Model reported by Groq:** ${models}. ${parseErrors ? `${parseErrors} response(s) could not be parsed and were scored as "no results", as the live route would.` : "Every response parsed as a JSON id array."}

## Results by query type (AI search)

${table(["Type", "Queries", "Findr top-1", "Findr top-3", "Keyword top-3"], typeRows)}

## Absent items (nothing in the catalog should match)

${absent.length ? `Findr returned at least one item for **${absentHits} of ${absent.length}** absent queries (${pct(absentHits, absent.length)}). The keyword baseline returned at least one item (any shared word) for **${absentBaseHits} of ${absent.length}** (${pct(absentBaseHits, absent.length)}). Lower is better: these are false matches shown to a user whose item was never turned in.` : "No absent queries were run."}

## Misses (expected item not in Findr's top 3)

${misses.length ? table(["Query", "Type", "Expected", "Findr returned (top 3)"], misses.map((x) => [x.query, x.type, x.expected_ids.map(nameOf).join(" / "), x.findr_ids.slice(0, 3).map(nameOf).join(", ") || "nothing"])) : "None."}

## Match check (lost report vs. found items)

${mcRows.length
    ? table(["Rows", "Queries", "Top-1", "Top-3 (what the app shows)", "Absent: returned a match"], [
      ["present", mcPresent.length, pct(mcPresent.filter((x) => within(x.match_rank, 1)).length, mcPresent.length), pct(mcPresent.filter((x) => within(x.match_rank, 3)).length, mcPresent.length), "-"],
      ["absent", mcAbsent.length, "-", "-", mcAbsent.length ? `${mcAbsent.filter((x) => x.match_ids.length).length} of ${mcAbsent.length} (${pct(mcAbsent.filter((x) => x.match_ids.length).length, mcAbsent.length)})` : "n/a"],
    ])
    : "No rows were marked match_check=yes."}

## Limits

- **Test-item tags were not made by the production vision model.** The ${testCount} test items' \`ai_keywords\` were written by Claude in the production tag format. The ${dbCount} database items use real Groq tags.
- **Query source.** ${QUERY_SOURCE}
- **One small catalog** of ${catalog.length} items. Results on a full school's catalog may differ.
- **One run per query.** Temperature is 0, but repeated runs are not guaranteed to return identical lists.
- **The search route only looks at the newest 200 found items**, and the match-check route only at the newest 100 (it shows the top 3). Older items are never candidates in the live app.
- **Dates and locations are not used in ranking.** The prompt contains only id, name, category, keywords and the first 80 characters of the description.
- **Misremembered details are the weakest case.** Misremember queries reached the top 3 ${pct(misremember.filter((x) => within(x.findr_rank, 3)).length, misremember.length)} of the time, versus ${pct(others.filter((x) => within(x.findr_rank, 3)).length, others.length)} for the other types. When a query contradicts the listing (wrong color, brand or model), the model tends to return nothing or a different item rather than the closest match; the keyword baseline still matches on the shared noun. See Misses above.
`;

  mkdirSync(path.dirname(DOC_PATH), { recursive: true });
  writeFileSync(DOC_PATH, doc, "utf8");

  console.log("\nResults by type (Findr top-1 / top-3 / keyword top-3):");
  for (const [t, n, a, b, c] of typeRows) console.log(`  ${String(t).replace(/\*/g, "").padEnd(22)} n=${String(n).padEnd(3)} ${a.padEnd(5)} ${b.padEnd(5)} ${c}`);
  if (absent.length) console.log(`  absent: Findr returned a match for ${absentHits}/${absent.length} (${pct(absentHits, absent.length)}); keyword baseline for ${absentBaseHits}/${absent.length} (${pct(absentBaseHits, absent.length)})`);
  if (mcRows.length) console.log(`  match check: ${mcPresent.filter((x) => within(x.match_rank, 3)).length}/${mcPresent.length} present rows in top 3`);
  console.log(`\nWrote ${path.relative(ROOT, RESULTS_PATH)} and ${path.relative(ROOT, DOC_PATH)}`);
}

// ── run ──────────────────────────────────────────────────────────────────────

if (pending.length === 0) {
  writeOutputs();
} else if (!process.argv.includes("--yes")) {
  console.log("Dry run. Re-run with --yes to make these calls:  npm run validate:matching -- --yes");
} else {
  const missing = [...new Set(pending.map((t) => t.envKey))].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(`Missing ${missing.join(", ")} (expected in .env.local).`);
    process.exitCode = 1;
  } else {
    const stopCode = await runCalls(pending);
    if (stopCode === null) writeOutputs();
    else process.exitCode = stopCode;
  }
}
