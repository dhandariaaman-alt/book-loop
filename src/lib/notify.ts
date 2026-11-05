// Notifications (PRD section 8).
// Every notification is stored in-app. Email, SMS and browser push are sent
// when the user's preferences allow, each tracked as a NotificationDelivery
// row so failures are logged and retried (see processPendingDeliveries).

import type { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "./prisma";
import { sendMail } from "./mail";
import { sendPushToUser, vapidPublicKey } from "./push";
import { sendSms, smsConfigured } from "./sms";

/** What a user gets when they haven't set a preference for that channel. */
export const CHANNEL_DEFAULTS: Record<NotificationChannel, boolean> = {
  IN_APP: true,
  EMAIL: true,
  PUSH: true,
  SMS: false, // costs money per message; opt-in only
};

export const NOTIFICATION_TYPE_LABEL: Record<NotificationType, string> = {
  REQUEST_RECEIVED: "New requests for your books",
  REQUEST_ACCEPTED: "Your request was accepted",
  REQUEST_REJECTED: "Your request was declined",
  EXCHANGE_OFFER: "Exchange offers",
  RESERVATION_CONFIRMED: "Reservation confirmed",
  RESERVATION_EXPIRED: "Reservation expired",
  NEW_MESSAGE: "New messages",
  RETURN_REMINDER: "Return reminders",
  OVERDUE: "Overdue books",
  TRANSACTION_COMPLETED: "Completed hand-offs",
  DONATION_UPDATE: "Donation updates",
  DISPUTE_UPDATE: "Dispute updates",
  ACCOUNT: "Important account notices",
};

const MAX_ATTEMPTS = 5;
const backoffMs = (attempt: number) => Math.min(60, 2 ** attempt) * 60_000; // 2, 4, 8 … 60 minutes

type NotifyInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  /** Relative app path, e.g. /transactions/abc */
  link?: string;
};

async function enabledChannels(userId: string, type: NotificationType): Promise<NotificationChannel[]> {
  const prefs = await prisma.notificationPreference.findMany({ where: { userId, type } });
  const on = (c: NotificationChannel) => prefs.find((p) => p.channel === c)?.enabled ?? CHANNEL_DEFAULTS[c];
  // Only queue push/SMS when they can actually be delivered, so unconfigured
  // channels don't fill the delivery log with failures and retries.
  const [pushReady, smsReady] = await Promise.all([
    vapidPublicKey() ? prisma.pushSubscription.count({ where: { userId } }).then((n) => n > 0) : false,
    smsConfigured()
      ? prisma.profile.findUnique({ where: { userId }, select: { phone: true } }).then((p) => Boolean(p?.phone))
      : false,
  ]);
  return (["EMAIL", "SMS", "PUSH"] as const).filter((c) => {
    if (c === "PUSH" && !pushReady) return false;
    if (c === "SMS" && !smsReady) return false;
    // Account notices always go by email too.
    return (type === "ACCOUNT" && c === "EMAIL") || on(c);
  });
}

async function deliver(deliveryId: string) {
  const d = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: { include: { user: { select: { id: true, email: true, name: true } } } } },
  });
  if (!d || d.status === "SENT") return;
  const n = d.notification;
  const url = `${process.env.APP_URL ?? "http://localhost:3000"}${n.link ?? "/notifications"}`;
  try {
    if (d.channel === "EMAIL") {
      await sendMail({ to: n.user.email, subject: n.title, text: `${n.body ?? n.title}\n\nOpen BookLoop: ${url}\n\nManage notifications: ${process.env.APP_URL ?? "http://localhost:3000"}/settings/notifications` });
    } else if (d.channel === "PUSH") {
      await sendPushToUser(n.userId, { title: n.title, body: n.body ?? "", url: n.link ?? "/notifications" });
    } else if (d.channel === "SMS") {
      await sendSms(n.userId, `BookLoop: ${n.title}${n.body ? `. ${n.body}` : ""} ${url}`);
    }
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: { status: "SENT", sentAt: new Date(), attempts: { increment: 1 }, lastError: null, nextAttemptAt: null },
    });
  } catch (e) {
    const attempts = d.attempts + 1;
    await prisma.notificationDelivery.update({
      where: { id: d.id },
      data: {
        status: "FAILED",
        attempts,
        lastError: e instanceof Error ? e.message.slice(0, 500) : "Unknown error",
        nextAttemptAt: attempts < MAX_ATTEMPTS ? new Date(Date.now() + backoffMs(attempts)) : null,
      },
    });
    console.warn(`[notify] ${d.channel} delivery ${d.id} failed (attempt ${attempts}):`, e);
  }
}

/** Create an in-app notification and send it on the user's other enabled channels. Never throws. */
export async function notify(input: NotifyInput): Promise<void> {
  try {
    const channels = await enabledChannels(input.userId, input.type);
    const n = await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        link: input.link,
        deliveries: { create: channels.map((channel) => ({ channel })) },
      },
      include: { deliveries: { select: { id: true } } },
    });
    await Promise.all(n.deliveries.map((d) => deliver(d.id)));
  } catch (e) {
    console.error("[notify] failed to create notification", e);
  }
}

/** Retry failed deliveries whose backoff has passed. Called by the cron route. */
export async function processPendingDeliveries(limit = 50): Promise<number> {
  const due = await prisma.notificationDelivery.findMany({
    where: {
      OR: [
        { status: "PENDING" },
        { status: "FAILED", nextAttemptAt: { lte: new Date() }, attempts: { lt: MAX_ATTEMPTS } },
      ],
    },
    take: limit,
    select: { id: true },
  });
  for (const d of due) await deliver(d.id);
  return due.length;
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
