import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

//builds the HTML email body for a dispute notification sent to all admins
function buildHtml(
  adminName: string,
  item_name: string,
  item_description: string,
  item_image_url: string,
  item_id: string,
  finder_name: string,
  finder_email: string,
  claimant_email: string,
  dispute_reason: string,
) {
  const truncatedDesc =
    item_description.length > 200
      ? item_description.slice(0, 200) + "..."
      : item_description;

  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
      <h2 style="margin:0 0 16px">Hi ${adminName},</h2>
      <p style="margin:0 0 16px">
        A dispute has been filed on Finder and requires your review.
      </p>
      ${item_image_url ? `<img src="${item_image_url}" style="width:100%;max-width:480px;height:200px;object-fit:cover;border-radius:8px;margin-bottom:16px;display:block" />` : ""}
      <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
        <tr>
          <td style="padding:10px 16px;font-weight:600;width:120px">Item</td>
          <td style="padding:10px 16px">${item_name}</td>
        </tr>
        ${item_description ? `
        <tr>
          <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee;vertical-align:top">Description</td>
          <td style="padding:10px 16px;border-top:1px solid #eee">${truncatedDesc}</td>
        </tr>` : ""}
        <tr>
          <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee">Finder</td>
          <td style="padding:10px 16px;border-top:1px solid #eee">${finder_name} (${finder_email})</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee">Claimant</td>
          <td style="padding:10px 16px;border-top:1px solid #eee">${claimant_email}</td>
        </tr>
        <tr>
          <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee;vertical-align:top">Reason</td>
          <td style="padding:10px 16px;border-top:1px solid #eee">${dispute_reason}</td>
        </tr>
      </table>
      <p style="margin:0 0 16px">
        Log in to the admin dashboard and go to <strong>Reports → Disputes</strong>
        to resolve this.
      </p>
      <div style="display:flex;gap:12px;flex-wrap:wrap">
        <a
          href="https://findrapp.me/items/${item_id}"
          style="display:inline-block;background:#444;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px"
        >
          View Item on Finder →
        </a>
        <a
          href="https://findrapp.me/dashboard"
          style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600;font-size:14px"
        >
          Go to Admin Dashboard →
        </a>
      </div>
      <p style="color:#888;font-size:13px;margin-top:32px">The Finder Team</p>
    </div>
  `;
}

//POST /api/emails/dispute-filed - sends dispute alert email to all registered admins
export async function POST(req: Request) {
  const {
    item_name,
    item_description,
    item_image_url,
    item_id,
    finder_name,
    finder_email,
    claimant_email,
    dispute_reason,
  } = await req.json();

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  //fetch all admin recipients; fall back to the env-configured address if none are registered
  const { data: admins } = await supabase
    .from("admins")
    .select("email, name");

  const fallback = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@findrapp.me";
  const recipients: { email: string; name: string }[] =
    admins && admins.length > 0
      ? admins
      : [{ email: fallback, name: "Admin" }];

  await Promise.all(
    recipients.map(({ email, name }) =>
      resend.emails
        .send({
          from: "Finder <noreply@findrapp.me>",
          to: email,
          subject: `Dispute opened for "${item_name}": action required`,
          html: buildHtml(
            name,
            item_name,
            item_description || "",
            item_image_url || "",
            item_id || "",
            finder_name || "",
            finder_email || "",
            claimant_email,
            dispute_reason,
          ),
        })
        .catch(console.error),
    ),
  );

  return NextResponse.json({ success: true, sent: recipients.length });
}
