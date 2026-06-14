import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const { claimant_email, claimant_name, item_name, rejection_reason } =
    await req.json();

  await resend.emails
    .send({
      from: "Findr <noreply@findrapp.me>",
      to: claimant_email,
      subject: `Update on your claim for "${item_name}"`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
          <h2 style="margin:0 0 16px">Hi ${claimant_name},</h2>
          <p style="margin:0 0 12px">
            Your claim for <strong>"${item_name}"</strong> was reviewed by the finder and
            was not accepted.
          </p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
            <tr>
              <td style="padding:12px 16px;font-weight:600;width:80px;vertical-align:top">Reason</td>
              <td style="padding:12px 16px">${rejection_reason}</td>
            </tr>
          </table>
          <p style="margin:0 0 12px;color:#555;font-size:14px">
            If you believe this item is yours, please contact your school administrator.
            You can also report the item from the Findr dashboard if you feel the
            rejection was in error.
          </p>
          <p style="color:#888;font-size:13px;margin-top:32px">— The Findr Team</p>
        </div>
      `,
    })
    .catch(console.error);

  return NextResponse.json({ ok: true });
}
