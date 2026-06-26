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

  // get full item row before we delete it
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

  // two ways to confirm a return:
  // flow 1: finder confirms informal handback, no claim needed
  // flow 2: claimant confirms a formal handoff happened
  const isFlow1 = isAuthor && ["pending", "waiting", "claim_accepted"].includes(item.status);
  const isFlow2 = isClaimant && item.status === "handed_off";

  if (!isFlow1 && !isFlow2) {
    return NextResponse.json(
      { error: `Not authorized or wrong status (status=${item.status}, isAuthor=${isAuthor}, isClaimant=${isClaimant})` },
      { status: 403 },
    );
  }

  // save a copy before deleting, so return history isn't lost
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

  // close out the claim before the item row is gone
  await supabase
    .from("claim_requests")
    .update({ status: "completed" })
    .eq("item_id", item_id)
    .in("status", ["pending", "accepted"]);

  // now safe to remove the live item
  const { error: deleteError } = await supabase
    .from("items")
    .delete()
    .eq("id", item_id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}