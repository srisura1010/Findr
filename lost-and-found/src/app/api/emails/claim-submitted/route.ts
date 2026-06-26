import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { finder_email, finder_name, item_name, claimant_name } =
    await req.json();

  await resend.emails
    .send({
      from: "Finder <noreply@findrapp.me>",
      to: finder_email,
      subject: `Someone claimed your item on Finder`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
          <h2 style="margin:0 0 16px">Hi ${finder_name},</h2>
          <p style="margin:0 0 12px">
            <strong>${claimant_name}</strong> submitted a claim for your found item
            <strong>"${item_name}"</strong>.
          </p>
          <p style="margin:0 0 24px">
            They've provided proof of ownership. Log in to your Finder dashboard to review
            their claim and decide whether to accept or reject it.
          </p>
          <a
            href="https://findrapp.me/dashboard"
            style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px"
          >
            Review Claims →
          </a>
          <p style="color:#888;font-size:13px;margin-top:32px">-The Finder Team</p>
        </div>
      `,
    })
    .catch(console.error);

  return NextResponse.json({ ok: true });
}
