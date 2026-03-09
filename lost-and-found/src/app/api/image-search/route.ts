



import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "No image" }, { status: 400 });

    const response = await groq.chat.completions.create({
      model: "meta-llama/llama-4-scout-17b-16e-instruct",
      messages: [
      {
        role: "user",
        content: [
        {
          type: "image_url",
          image_url: { url: `data:${mimeType || "image/jpeg"};base64,${imageBase64}` }
        },
        {
          type: "text",
          text: `Look at this image of a found item and return ONLY a comma-separated list of search keywords.
Include: object type, color, brand if visible, model name, material, size, any distinctive features.
Example: iPhone 17, Apple, smartphone, orange, mobile phone, iOS device
Maximum 20 words. No extra text, just the keywords.`
        }]

      }],

      max_tokens: 100
    });

    const keywords = response.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ keywords });
  } catch (error) {
    console.error("Groq error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
