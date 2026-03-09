import emailjs from "@emailjs/browser";

// Send an email to a newly-created admin user.
//
// This uses EmailJS from the client, so the configuration is provided via
// `NEXT_PUBLIC_*` environment variables.
//
// Note: Because this runs in the browser, you should ensure your EmailJS
// template does not expose sensitive information beyond what is intended.
export async function sendAdminEmail(name: string, email: string, password: string) {
  await emailjs.send(
    process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID!,
    process.env.NEXT_PUBLIC_EMAILJS_ADMIN_TEMPLATE_ID!,
    { name, email, password },
    process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY!
  );
}
