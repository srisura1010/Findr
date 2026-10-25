import { NextRequest, NextResponse } from "next/server";
import { GROQ_TEXT_MODEL } from "@/lib/aiPrompts";

// POST /api/groq-chat
// Body: { messages: Array<{ role: string, content: string }> }
// Response: { reply: string } OR { error: string }
//
// This is a thin server-side proxy to Groq's OpenAI-compatible chat completions API.
// Running this on the server keeps `GROQ_API_KEY` private.
export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json();

    // Forward the conversation to Groq using the OpenAI-compatible endpoint.
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: GROQ_TEXT_MODEL,
        max_tokens: 1024, // includes gpt-oss reasoning tokens, so higher than the old 400
        temperature: 0.7,
        reasoning_effort: "low",
        messages
      })
    });

    // If Groq returns an error, bubble up a user-friendly message.
    if (!res.ok) {
      const err = await res.json();
      return NextResponse.json({ error: err.error?.message || "Groq error" }, { status: res.status });
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content ?? "Sorry, no response.";
    return NextResponse.json({ reply });
  } catch (err: any) {
    // Catch unexpected errors (e.g., invalid JSON body).
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
