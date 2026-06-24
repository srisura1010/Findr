import { NextResponse } from "next/server";

// Server-side warm cache — resets on restart, but saves round-trips within a session.
const cache = new Map<string, string>();

// POST /api/translate
// Body: { text: string, target: string }
// Response: { translatedText: string }
export async function POST(req: Request) {
  let text = "";
  let target = "";

  try {
    const body = await req.json().catch(() => null);
    if (!body) return NextResponse.json({ translatedText: "" });

    text = body.text;
    target = body.target;

    if (!text || !target) {
      return NextResponse.json({ error: "Missing text or target language" }, { status: 400 });
    }

    if (target === "en") return NextResponse.json({ translatedText: text });

    const key = `${target}:${text}`;
    if (cache.has(key)) return NextResponse.json({ translatedText: cache.get(key) });

    // Uses Google Translate's public endpoint — no API key required, no daily cap.
    const url = new URL("https://translate.googleapis.com/translate_a/single");
    url.searchParams.set("client", "gtx");
    url.searchParams.set("sl", "en");
    url.searchParams.set("tl", target);
    url.searchParams.set("dt", "t");
    url.searchParams.set("q", text);

    const response = await fetch(url.toString());
    if (!response.ok) return NextResponse.json({ translatedText: text });

    const data = await response.json();
    const translatedText: string = data?.[0]?.[0]?.[0] ?? text;

    cache.set(key, translatedText);
    return NextResponse.json({ translatedText });
  } catch (error) {
    if (error instanceof Error && error.message.includes("aborted")) {
      return NextResponse.json({ translatedText: text || "" });
    }
    console.error("Translation error:", error);
    return NextResponse.json({ translatedText: text || "" });
  }
}
