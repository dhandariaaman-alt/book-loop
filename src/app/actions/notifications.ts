"use server";

import { revalidatePath } from "next/cache";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { NOTIFICATION_TYPE_LABEL, notify } from "@/lib/notify";
import { E164 } from "@/lib/sms";
import type { FormState } from "./auth";

const CHANNELS: NotificationChannel[] = ["IN_APP", "EMAIL", "PUSH", "SMS"];

/** Mark one notification read. Returns its link so the client can navigate. */
export async function markNotificationReadAction(id: string): Promise<string | null> {
  const me = await requireUser();
  const n = await prisma.notification.findFirst({ where: { id, userId: me.id }, select: { id: true, link: true, readAt: true } });
  if (!n) return null;
  if (!n.readAt) await prisma.notification.update({ where: { id: n.id }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
  return n.link;
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const me = await requireUser();
  await prisma.notification.updateMany({ where: { userId: me.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/notifications");
}

export async function setNotificationPreferenceAction(
  type: NotificationType,
  channel: NotificationChannel,
  enabled: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const me = await requireUser();
  if (!(type in NOTIFICATION_TYPE_LABEL) || !CHANNELS.includes(channel)) return { ok: false, error: "Unknown setting." };
  if (!rateLimit(`pref:${me.id}`, 120, 60_000)) return { ok: false, error: "Too many changes. Wait a moment." };
  await prisma.notificationPreference.upsert({
    where: { userId_type_channel: { userId: me.id, type, channel } },
    create: { userId: me.id, type, channel, enabled: Boolean(enabled) },
    update: { enabled: Boolean(enabled) },
  });
  return { ok: true };
}

export async function savePhoneAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const raw = String(formData.get("phone") ?? "").replace(/[\s()-]/g, "");
  if (raw && !E164.test(raw)) {
    return { error: "Enter the number in international format, starting with + and your country code, e.g. +919876543210." };
  }
  await prisma.profile.upsert({
    where: { userId: me.id },
    create: { userId: me.id, phone: raw || null },
    update: { phone: raw || null },
  });
  revalidatePath("/settings/notifications");
  return { success: raw ? "Phone number saved." : "Phone number removed." };
}

export async function sendTestNotificationAction(): Promise<{ ok: boolean; message: string }> {
  const me = await requireUser();
  if (!rateLimit(`test-notify:${me.id}`, 3, 10 * 60_000)) {
    return { ok: false, message: "You've sent a few tests already. Try again in a few minutes." };
  }
  await notify({
    userId: me.id,
    type: "ACCOUNT",
    title: "Test notification from BookLoop",
    body: "If you can see this, notifications are working.",
    link: "/notifications",
  });
  revalidatePath("/notifications");
  return { ok: true, message: "Sent. Check this browser, your inbox and the bell." };
}
