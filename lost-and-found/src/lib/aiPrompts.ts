//shared Groq settings for the AI routes, also imported by scripts/validate-matching.mjs
//keep this file plain TS (no enums/namespaces) so Node can strip the types and run it directly

//text model for search ranking, match checks and the support chatbot (llama-3.3-70b-versatile was retired by Groq)
export const GROQ_TEXT_MODEL = "openai/gpt-oss-120b";

//vision model for photo tagging in /api/image-search (the only image-capable model on our Groq keys)
export const GROQ_VISION_MODEL = "qwen/qwen3.8-27b";
