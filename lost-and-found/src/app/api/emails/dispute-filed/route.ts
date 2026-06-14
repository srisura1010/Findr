import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

function buildHtml(adminName: string, item_name: string, claimant_email: string, dispute_reason: string) {
  return `
    <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
      <h2 style="margin:0 0 16px">Hi ${adminName},</h2>
      <p style="margin:0 0 16px">
        A dispute has been filed on Findr and requires your review.
      </p>
      <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
        <tr>
          <td style="padding:10px 16px;font-weight:600;width:100px">Item</td>
          <td style="padding:10px 16px">${item_name}</td>
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
      <p style="margin:0 0 24px">
        Log in to the admin dashboard and go to <strong>Reports → Disputes</strong>
        to resolve this.
      </p>
      <a
        href="https://findrapp.me/dashboard"
        style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px"
      >
        Go to Admin Dashboard →
      </a>
      <p style="color:#888;font-size:13px;margin-top:32px">— The Findr Team</p>
    </div>
  `;
}

export async function POST(req: Request) {
  const { item_name, claimant_email, dispute_reason } = await req.json();

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const { data: admins } = await supabase
    .from("admins")
    .select("email, name")

  const fallback = process.env.NEXT_PUBLIC_ADMIN_EMAIL || "admin@findrapp.me";
  const recipients: { email: string; name: string }[] =
    admins && admins.length > 0
      ? admins
      : [{ email: fallback, name: "Admin" }];

  await Promise.all(
    recipients.map(({ email, name }) =>
      resend.emails
        .send({
          from: "Findr <noreply@findrapp.me>",
          to: email,
          subject: `Dispute opened for "${item_name}" — action required`,
          html: buildHtml(name, item_name, claimant_email, dispute_reason),
        })
        .catch(console.error),
    ),
  );

  return NextResponse.json({ success: true, sent: recipients.length });
}
