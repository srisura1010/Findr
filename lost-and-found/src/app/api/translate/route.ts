import { NextResponse } from "next/server";

const cache = new Map<string, string>();


const SUPPORTED_LANGUAGES = [
"es", "fr", "de", "it", "pt", "ja", "zh", "ru", "ar", "hi",
"nl", "pl", "ko", "tr", "sv", "id", "th", "vi", "he", "el"];


export async function POST(req: Request) {
  let text = "";
  let target = "";

  try {

    const body = await req.json().catch(() => null);

    if (!body) {

      return NextResponse.json({ translatedText: "" });
    }

    text = body.text;
    target = body.target;

    if (!text || !target) {
      return NextResponse.json(
        { error: "Missing text or target language" },
        { status: 400 }
      );
    }


    if (target === "en") {
      return NextResponse.json({ translatedText: text });
    }

    const key = `${text}-${target}`;


    if (cache.has(key)) {
      return NextResponse.json({
        translatedText: cache.get(key)
      });
    }


    if (!SUPPORTED_LANGUAGES.includes(target)) {
      return NextResponse.json({ translatedText: text });
    }


    const url = new URL("https://api.mymemory.translated.net/get");
    url.searchParams.append("q", text);
    url.searchParams.append("langpair", `en|${target}`);

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      return NextResponse.json({ translatedText: text });
    }

    const data = await response.json();

    if (data.responseStatus === 200 && data.responseData?.translatedText) {
      const translatedText = data.responseData.translatedText;


      cache.set(key, translatedText);

      return NextResponse.json({ translatedText });
    }


    return NextResponse.json({ translatedText: text });
  } catch (error) {

    if (error instanceof Error && error.message.includes('aborted')) {
      return NextResponse.json({ translatedText: text || "" });
    }


    console.error("Translation error:", error);
    return NextResponse.json({ translatedText: text || "" });
  }
}
