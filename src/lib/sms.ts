// SMS notifications through Twilio's REST API.
// Env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM (an E.164 number or Messaging Service SID).
// Reads the user's private Profile.phone. Throws when SMS isn't configured or the
// user has no phone number, so notify() records the delivery as FAILED.

import { prisma } from "./prisma";

export const E164 = /^\+[1-9]\d{7,14}$/;

export function smsConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

export async function sendSms(userId: string, text: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_FROM?.trim();
  if (!sid || !token || !from) throw new Error("SMS is not configured.");

  const profile = await prisma.profile.findUnique({ where: { userId }, select: { phone: true } });
  const to = profile?.phone?.trim();
  if (!to || !E164.test(to)) throw new Error("User has no valid phone number.");

  const params = new URLSearchParams({ To: to, Body: text.slice(0, 640) });
  if (from.startsWith("MG")) params.set("MessagingServiceSid", from);
  else params.set("From", from);

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    let detail = "";
    try {
      const j = (await res.json()) as { message?: string };
      detail = j.message ?? "";
    } catch {}
    throw new Error(`Twilio returned ${res.status}${detail ? `: ${detail}` : ""}`.slice(0, 400));
  }
}
