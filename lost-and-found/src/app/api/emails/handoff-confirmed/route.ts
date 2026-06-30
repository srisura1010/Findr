import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

//POST /api/emails/handoff-confirmed - asks the claimant to confirm receipt after the finder marks an item handed off
export async function POST(req: Request) {
  const { claimant_email, claimant_name, item_name } = await req.json();

  await resend.emails
    .send({
      from: "Finder <noreply@findrapp.me>",
      to: claimant_email,
      subject: `Please confirm you received "${item_name}"`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
          <h2 style="margin:0 0 16px">Hi ${claimant_name},</h2>
          <p style="margin:0 0 12px">
            The finder has confirmed that they physically handed
            <strong>"${item_name}"</strong> back to you.
          </p>
          <p style="margin:0 0 24px">
            Please log in to your Finder dashboard and confirm receipt. This completes the
            return and removes the listing. If something went wrong, you can open a
            dispute.
          </p>
          <p style="margin:0 0 24px;font-weight:600;color:#e07b00">
            You have 48 hours to confirm before the return is auto-completed.
          </p>
          <a
            href="https://findrapp.me/dashboard"
            style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px"
          >
            Confirm Receipt →
          </a>
          <p style="color:#888;font-size:13px;margin-top:32px">-The Finder Team</p>
        </div>
      `,
    })
    .catch(console.error);

  return NextResponse.json({ ok: true });
}
