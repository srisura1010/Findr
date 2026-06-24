import { NextResponse } from "next/server";

// Simple in-memory cache for translations.
//
// This cache is per-server-instance (it resets on server restart and does not
// share across serverless invocations). It mainly helps during local dev and
// for repeated translations during a single warm runtime.
const cache = new Map<string, string>();


// Languages we allow this endpoint to translate to.
//
// This protects the free translation provider from unexpected inputs and
// keeps behavior predictable.
const SUPPORTED_LANGUAGES = [
"es", "fr", "de", "it", "pt", "ja", "zh", "ru", "ar", "hi",
"nl", "pl", "ko", "tr", "sv", "id", "th", "vi", "he", "el",
"bn", "uk", "fa", "sw"];


// POST /api/translate
// Body: { text: string, target: string }
// Response: { translatedText: string }
//
// The client uses this route to avoid calling third-party translation APIs
// directly from the browser.
export async function POST(req: Request) {
  let text = "";
  let target = "";

  try {

    // Defensive parsing: malformed JSON should not crash the route.
    const body = await req.json().catch(() => null);

    // For empty body, return an empty translation (client treats this as "no-op").
    if (!body) {

      return NextResponse.json({ translatedText: "" });
    }

    text = body.text;
    target = body.target;

    // Validate required fields.
    if (!text || !target) {
      return NextResponse.json(
        { error: "Missing text or target language" },
        { status: 400 }
      );
    }


    // English is the source language in this app, so translating to English is a no-op.
    if (target === "en") {
      return NextResponse.json({ translatedText: text });
    }

    // Cache key is the input text + target language.
    const key = `${text}-${target}`;


    // Fast path: return cached translation if we already translated this string.
    if (cache.has(key)) {
      return NextResponse.json({
        translatedText: cache.get(key)
      });
    }


    // If the requested language is not in our allowlist, fall back to the original.
    // This keeps behavior stable even if the UI is extended with new language codes.
    if (!SUPPORTED_LANGUAGES.includes(target)) {
      return NextResponse.json({ translatedText: text });
    }


    // Use MyMemory's free translation endpoint.
    // Note: This is best-effort; we handle errors by returning the original text.
    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.append("q", text);
    url.searchParams.append("langpair", `en|${target}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    // Provider request failed; fall back to original text.
    if (!response.ok) {
      return NextResponse.json({ translatedText: text });
    }

    const data = await response.json();

    // Provider returns 200-style status + translated text payload.
    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translatedText = data.responseData.translatedText;


      // Store in memory cache for subsequent calls.
      cache.set(key, translatedText);

      return NextResponse.json({ translatedText });
    }


    return NextResponse.json({ translatedText: text });
  } catch (error) {

    // If the request was aborted (client canceled/navigation), return what we have.
    if (error instanceof Error && error.message.includes('aborted')) {
      return NextResponse.json({ translatedText: text || "" });
    }


    console.error("Translation error:", error);
    return NextResponse.json({ translatedText: text || "" });
  }
}
