import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const resend = new Resend(process.env.RESEND_API_KEY);

async function sendEmail(to: string, subject: string, body: string) {
  await resend.emails
    .send({
      from: "Findr <noreply@findrapp.me>",
      to,
      subject,
      html: `<div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px"><p>${body}</p><p style="color:#888;font-size:13px;margin-top:24px">The Findr Team</p></div>`,
    })
    .catch(console.error);
}

export async function GET(request: Request) {
  const secret = request.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let expiredClaims = 0;
  let autoCompleted = 0;

  // 1. Expire accepted claims with no handoff after 7 days
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: expiredItems } = await supabase
    .from("items")
    .select("*")
    .eq("status", "claim_accepted")
    .lt("claim_accepted_at", sevenDaysAgo)
    .eq("handoff_confirmed_by_poster", false);

  for (const item of expiredItems || []) {
    // Revert item to waiting
    await supabase
      .from("items")
      .update({
        status: "waiting",
        accepted_claimant_id: null,
        accepted_claimant_email: null,
        accepted_claimant_name: null,
        claim_accepted_at: null,
        handoff_confirmed_by_poster: false,
      })
      .eq("id", item.id);

    // Mark the accepted claim as expired and notify claimant
    const { data: acceptedClaim } = await supabase
      .from("claim_requests")
      .select("*")
      .eq("item_id", item.id)
      .eq("status", "accepted")
      .maybeSingle();

    if (acceptedClaim) {
      await supabase
        .from("claim_requests")
        .update({ status: "expired" })
        .eq("id", acceptedClaim.id);

      if (acceptedClaim.claimant_email) {
        await sendEmail(
          acceptedClaim.claimant_email,
          `Your accepted claim for "${item.name}" has expired`,
          `Your accepted claim for <strong>${item.name}</strong> has expired after 7 days of no handoff confirmation. The item is now available for others to claim.`,
        );
      }
    }

    // Revert auto-rejected claims (those rejected only because another was accepted) back to pending
    await supabase
      .from("claim_requests")
      .update({ status: "pending", rejection_reason: null, updated_at: new Date().toISOString() })
      .eq("item_id", item.id)
      .eq("status", "rejected")
      .eq("rejection_reason", "Another claim was accepted for this item.");

    expiredClaims++;
  }

  // 2. Auto-complete handed-off items after 48 hours with no claimant confirmation
  const fortyEightHoursAgo = new Date(
    Date.now() - 48 * 60 * 60 * 1000,
  ).toISOString();

  const { data: handedOffItems } = await supabase
    .from("items")
    .select("*")
    .eq("status", "handed_off")
    .lt("handed_off_at", fortyEightHoursAgo)
    .eq("handoff_confirmed_by_claimant", false);

  for (const item of handedOffItems || []) {
    // Move into returned_items, then delete from the live items table.
    await supabase.from("returned_items").insert({
      original_item_id: item.id,
      author_id: item.author_id,
      author_name: item.author_name,
      item_name: item.name,
      returned_by_id: item.accepted_claimant_id ?? item.author_id,
      date_found: item.date_found ?? item.created_at ?? null,
      snapshot: item,
    });
    await supabase.from("items").delete().eq("id", item.id);

    if (item.accepted_claimant_email) {
      await sendEmail(
        item.accepted_claimant_email,
        `Return of "${item.name}" auto-confirmed`,
        `The return of <strong>${item.name}</strong> was auto-confirmed after 48 hours. The listing has been removed.`,
      );
    }

    autoCompleted++;
  }

  return NextResponse.json({ expired_claims: expiredClaims, auto_completed: autoCompleted });
}
