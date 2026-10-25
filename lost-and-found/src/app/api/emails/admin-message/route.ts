import { Resend } from "resend";
import { NextResponse } from "next/server";

const resend = new Resend(process.env.RESEND_API_KEY);

//POST /api/emails/admin-message - sends a custom admin-to-user message email about a specific item
export async function POST(req: Request) {
  const { to_email, to_name, admin_name, item_name, message } =
    await req.json();

  await resend.emails
    .send({
      from: "Findr <noreply@findrapp.me>",
      to: to_email,
      subject: `Message from Findr Admin regarding "${item_name}"`,
      html: `
        <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
          <h2 style="margin:0 0 16px">Hi ${to_name},</h2>
          <p style="margin:0 0 16px">
            A Findr administrator (<strong>${admin_name}</strong>) has sent you a message
            regarding the item <strong>"${item_name}"</strong>:
          </p>
          <div style="border-left:3px solid #6c63ff;padding:12px 16px;background:#f5f5ff;border-radius:4px;margin:16px 0;font-size:14px;line-height:1.6;color:#333">
            ${message}
          </div>
          <p style="margin:0 0 24px;color:#555;font-size:14px">
            If you have questions, please log in to your Findr dashboard.
          </p>
          <a
            href="https://finderfbla.com/dashboard"
            style="display:inline-block;background:#6c63ff;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:15px"
          >
            Go to Dashboard →
          </a>
          <p style="color:#888;font-size:13px;margin-top:32px">-The Findr Team</p>
        </div>
      `,
    })
    .catch(console.error);

  return NextResponse.json({ success: true });
}
