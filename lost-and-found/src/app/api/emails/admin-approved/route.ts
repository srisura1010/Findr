import { Resend } from "resend";
import { NextResponse } from "next/server";
const resend = new Resend(process.env.RESEND_API_KEY);

//POST /api/emails/admin-approved - sends approval email with credentials to a newly approved admin
export async function POST(req: Request) {
  const { name, email, password } = await req.json();
  await resend.emails.send({
    from: "Finder <noreply@findrapp.me>",
    to: email,
    subject: "Your Finder admin account has been approved",
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
        <h2>Hi ${name},</h2>
        <p>Your admin account has been approved. Here are your login credentials:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
          <tr>
            <td style="padding:12px 16px;font-weight:600;width:120px">Password</td>
            <td style="padding:12px 16px;font-family:monospace;font-size:15px">${password}</td>
          </tr>
        </table>
        <p>Please log in using that password to unlock admin features.</p>
        <p style="color:#888;font-size:13px;margin-top:24px">Best regards,<br/>The Finder Team</p>
      </div>
    `,
  });
  return NextResponse.json({ ok: true });
}