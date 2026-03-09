// Image-search API route: handles image uploads and extracts descriptive keywords.
// This route uses Groq's multimodal vision capabilities to analyze the uploaded image.
// The `GROQ_API_KEY` environment variable is required for this route to function.

import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

// Groq client used for multimodal (image + text) inference.
//
// This API route runs server-side, so the `GROQ_API_KEY` is not exposed to the browser.
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// POST /api/image-search
// Body: { imageBase64: string, mimeType?: string }
// Response: { keywords: string }
//
// The client uses this to extract descriptive keywords from an uploaded image.
// Those keywords can be used for searching/matching found items.
export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mimeType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: "No image" }, { status: 400 });

    // Send a single multimodal message:
    // - `image_url`: the uploaded image as a data URL
    // - `text`: a strict prompt requesting a comma-separated keyword list
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

    // The prompt asks the model to return ONLY the keyword list.
    const keywords = response.choices[0]?.message?.content?.trim() ?? "";
    return NextResponse.json({ keywords });
  } catch (error) {
    console.error("Groq error:", error);
    return NextResponse.json({ error: "Failed to analyze image" }, { status: 500 });
  }
}
