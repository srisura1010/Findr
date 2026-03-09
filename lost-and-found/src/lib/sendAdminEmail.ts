import emailjs from "@emailjs/browser";

export async function sendAdminEmail(name: string, email: string, password: string) {
  await emailjs.send(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
    process.env.NEXT_PUBLIC_EMAILJS_ADMIN_TEMPLATE_ID!,
    { name, email, password },
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
  );
}
