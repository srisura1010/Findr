import { Resend } from "resend";
import { NextResponse } from "next/server";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
  const {
    author_name,
    author_email,
    item_name,
    retriever_name,
    retriever_email,
  } = await req.json();

  const result = await resend.emails.send({
    from: "noreply@findrapp.me",
    to: author_email,
    subject: `Someone wants to retrieve "${item_name}"`,
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:32px 24px">
        <h2>Hi ${author_name},</h2>
        <p>Someone has requested to retrieve an item.</p>
        <table style="border-collapse:collapse;width:100%;margin:16px 0;background:#f9f9f9;border-radius:8px">
          <tr>
            <td style="padding:10px 16px;font-weight:600;width:100px">Item</td>
            <td style="padding:10px 16px">${item_name}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee">Name</td>
            <td style="padding:10px 16px;border-top:1px solid #eee">${retriever_name}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px;font-weight:600;border-top:1px solid #eee">Email</td>
            <td style="padding:10px 16px;border-top:1px solid #eee">
              <a href="mailto:${retriever_email}">${retriever_email}</a>
            </td>
          </tr>
        </table>
        <p>Thank you for helping return lost items.</p>
        <p style="color:#888;font-size:13px;margin-top:24px">Best regards,<br/>The Lost and Found Team</p>
      </div>
    `,
  });

  console.log("Resend result:", result);
  return NextResponse.json({ ok: true });
}
