import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: Request) {
  const { item_id, user_id } = await req.json();

  if (!item_id || !user_id) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Pull the full item row so we can snapshot it before deleting.
  const { data: item, error: fetchError } = await supabase
    .from("items")
    .select("*")
    .eq("id", item_id)
    .maybeSingle();

  if (fetchError || !item) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }

  const isAuthor = item.author_id === user_id;
  const isClaimant = item.accepted_claimant_id === user_id;

  // Flow 1: poster confirms informal retrieval (status pending/waiting/claim_accepted)
  // Flow 2: accepted claimant confirms formal handoff (status handed_off)
  const isFlow1 = isAuthor && ["pending", "waiting", "claim_accepted"].includes(item.status);
  const isFlow2 = isClaimant && item.status === "handed_off";

  if (!isFlow1 && !isFlow2) {
    return NextResponse.json(
      { error: `Not authorized or wrong status (status=${item.status}, isAuthor=${isAuthor}, isClaimant=${isClaimant})` },
      { status: 403 },
    );
  }

  // Move the item into returned_items (credited to the finder/poster).
  const { error: insertError } = await supabase.from("returned_items").insert({
    original_item_id: item.id,
    author_id: item.author_id,
    author_name: item.author_name,
    item_name: item.name,
    returned_by_id: user_id,
    date_found: item.date_found ?? item.created_at ?? null,
    snapshot: item,
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Mark claim_requests resolved (FK is ON DELETE CASCADE, but we set status
  // first so nothing lingers if the row is read before cascade completes).
  await supabase
    .from("claim_requests")
    .update({ status: "completed" })
    .eq("item_id", item_id)
    .in("status", ["pending", "accepted"]);

  // Remove the item from the live items table.
  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("id", item_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
