import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

//GET /api/returned-count?author_id= - returns how many items a finder has successfully returned
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const author_id = searchParams.get("author_id");

  if (!author_id) {
    return NextResponse.json({ count: 0, items: [] });
  }

  //query returned_items for this finder's history
  const { count, data } = await supabase
    .from("returned_items")
    .select("id, date_found, returned_at, item_name", { count: "exact" })
    .eq("author_id", author_id);

  return NextResponse.json({ count: count ?? 0, items: data ?? [] });
}
