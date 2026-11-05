// Email sending. No provider is wired up yet (PRD Phase 4), so in development
// emails are printed to the server console. Plug Resend, SES, Postmark etc. in here.

type Mail = { to: string; subject: string; text: string };

export async function sendMail(mail: Mail): Promise<void> {
  if (process.env.NODE_ENV !== "production") {
    console.log(`\n📧  Email to ${mail.to}\n    Subject: ${mail.subject}\n\n${mail.text}\n`);
    return;
  }
  console.warn(`[mail] No email provider configured; dropped email "${mail.subject}".`);
}
