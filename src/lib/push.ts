// Browser push notifications (Web Push API) using VAPID keys.
// Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (e.g. mailto:hello@bookloop.app).
// Throws when push isn't configured, the user has no subscriptions, or every send
// fails, so notify() records the delivery as FAILED and retries later.

import webpush from "web-push";
import { prisma } from "./prisma";

export type PushPayload = { title: string; body: string; url: string };

let configured = false;

/** The public VAPID key browsers need to subscribe, or null when push isn't set up. */
export function vapidPublicKey(): string | null {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  return pub && priv ? pub : null;
}

function configure(): boolean {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY?.trim();
  const priv = process.env.VAPID_PRIVATE_KEY?.trim();
  if (!pub || !priv) return false;
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:admin@localhost";
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!configure()) throw new Error("Browser push is not configured.");

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });
  if (subs.length === 0) throw new Error("No browser push subscriptions for this user.");

  const data = JSON.stringify({ title: payload.title, body: payload.body, url: payload.url });
  let sent = 0;
  const errors: string[] = [];

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, data, {
          TTL: 60 * 60 * 24,
        });
        sent += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired or was revoked by the browser.
          await prisma.pushSubscription.delete({ where: { id: s.id } }).catch(() => {});
        }
        errors.push(status ? `HTTP ${status}` : e instanceof Error ? e.message : "Unknown error");
      }
    }),
  );

  if (sent === 0) throw new Error(`Every push send failed: ${errors.join(", ")}`.slice(0, 400));
}
