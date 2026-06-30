import { Resend } from "resend";
import { NextResponse } from "next/server";
const resend = new Resend(process.env.RESEND_API_KEY);

//POST /api/emails/school-approved - notifies a school admin that their school is live, includes school code and password
export async function POST(req: Request) {
  const { name, email, school_name, school_code, school_password } =
    await req.json();
  await resend.emails.send({
    from: "Finder <noreply@findrapp.me>",
    to: email,
    subject: `${school_name} is now live on Finder!`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
        <h2>Hi ${name},</h2>
        <p><strong>${school_name}</strong> has been approved and is now live on Finder Campus.</p>
        <p>Share the school code with your students and staff:</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
          <tr>
            <td style="padding:10px 16px;font-weight:600;width:160px">School Code</td>
            <td style="padding:10px 16px;font-family:monospace;font-size:18px;letter-spacing:1px">${school_code}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee">Admin Password</td>
            <td style="padding:10px 16px;font-family:monospace;border-top:1px solid #eee">${school_password}</td>
          </tr>
        </table>
        <p style="font-size:13px;color:#888">Keep your admin password private: it unlocks the admin panel on your school board.</p>
        <p style="color:#888;font-size:13px;margin-top:24px">Best regards,<br/>-The Finder Team</p>
      </div>
    `,
  });
  return NextResponse.json({ ok: true });
}
