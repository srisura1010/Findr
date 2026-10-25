import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

//POST /api/emails/claim-accepted - notifies the claimant that the finder accepted their claim
export async function POST(req: Request) {
  const { claimant_email, claimant_name, item_name } = await req.json();

  await resend.emails
    .send({
      from: "Findr <noreply@findrapp.me>",
      to: claimant_email,
      subject: `Your claim for "${item_name}" was accepted!`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
          <h2 style="margin:0 0 16px">Hi ${claimant_name},</h2>
          <p style="margin:0 0 12px">
            Great news! Your claim for <strong>"${item_name}"</strong> has been accepted
            by the finder.
          </p>
          <p style="margin:0 0 24px">
            Log in to your Findr dashboard to coordinate pickup. Once the finder physically
            hands the item back, they'll confirm the handoff and you'll get another email
            to confirm receipt.
          </p>
          <a
            href="https://finderfbla.com/dashboard"
            style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px"
          >
            Go to Dashboard →
          </a>
          <p style="color:#888;font-size:13px;margin-top:32px">The Findr Team</p>
        </div>
      `,
    })
    .catch(console.error);

  return NextResponse.json({ ok: true });
}
