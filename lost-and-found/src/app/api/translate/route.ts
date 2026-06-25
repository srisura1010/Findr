import { NextResponse } from "next/server";

// Server-side warm cache — resets on restart, but saves round-trips within a session.
const cache = new Map<string, string>();

// Limit concurrent outgoing calls to Google's unofficial API.
// Without this, a first-time visitor fires 70+ parallel requests, some get
// rate-limited and fall back to English, producing a partially-translated UI.
let _slots = 5;
const _waiters: Array<() => void> = [];

function acquireSlot(): Promise<void> {
  if (_slots > 0) {
    _slots--;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => _waiters.push(resolve));
}

function releaseSlot() {
  const next = _waiters.shift();
  if (next) {
    next(); // hand the slot directly to the next waiter
  } else {
    _slots++;
  }
}

async function googleTranslate(text: string, target: string): Promise<string> {
  const key = `${target}:${text}`;
  if (cache.has(key)) return cache.get(key)!;

  await acquireSlot();
  try {
    // Re-check cache after acquiring slot (another request may have fetched it).
    if (cache.has(key)) return cache.get(key)!;

    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url.toString());
    if (!response.ok) return text;

    const data = await response.json();
    const translatedText: string = data?.[0]?.[0]?.[0] ?? text;
    cache.set(key, translatedText);
    return translatedText;
  } finally {
    releaseSlot();
  }
}

// POST /api/translate
// Single:  { text: string,    target: string } → { translatedText: string }
// Batch:   { texts: string[], target: string } → { translatedTexts: string[] }
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ translatedText: "" });

    const target: string = body.target;
    if (!target) return NextResponse.json({ error: "Missing target language" }, { status: 400 });

    // ── Batch mode ────────────────────────────────────────────────────────────
    if (Array.isArray(body.texts)) {
      const texts: string[] = body.texts;
      if (target === "en") return NextResponse.json({ translatedTexts: texts });

      const translatedTexts = await Promise.all(
        texts.map((t) => googleTranslate(t, target).catch(() => t)),
      );
      return NextResponse.json({ translatedTexts });
    }

    // ── Single mode ───────────────────────────────────────────────────────────
    const text: string = body.text;
    if (!text) return NextResponse.json({ error: "Missing text" }, { status: 400 });
    if (target === "en") return NextResponse.json({ translatedText: text });

    const translatedText = await googleTranslate(text, target).catch(() => text);
    return NextResponse.json({ translatedText });
  } catch (error) {
    if (error instanceof Error && error.message.includes("aborted")) {
      return NextResponse.json({ translatedText: "" });
    }
    console.error("Translation error:", error);
    return NextResponse.json({ translatedText: "" });
  }
}
