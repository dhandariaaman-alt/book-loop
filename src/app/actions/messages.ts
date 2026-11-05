"use server";

import { after } from "next/server";
import type { MessageType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { requireParticipant } from "@/lib/conversations";
import { isBlockedEitherWay } from "@/lib/blocks";
import { notify } from "@/lib/notify";
import { saveAudio, saveImage, UploadError } from "@/lib/storage";
import {
  MAX_MESSAGE_CHARS,
  MAX_VOICE_SECONDS,
  MESSAGE_SELECT,
  toChatMessage,
  type ChatMessage,
} from "@/components/messages/types";

export type SendResult = { ok: true; message: ChatMessage } | { ok: false; error: string };

const NOTIFY_THROTTLE_MS = 10 * 60_000;

function fileFrom(v: FormDataEntryValue | null): File | null {
  return v && typeof v === "object" && "size" in v && (v as File).size > 0 ? (v as File) : null;
}

/** Send a text, photo or voice message. Used by the chat composer. */
export async function sendMessageAction(formData: FormData): Promise<SendResult> {
  const me = await requireUser();
  const conversationId = String(formData.get("conversationId") ?? "");
  const type = String(formData.get("type") ?? "TEXT") as MessageType;
  if (!["TEXT", "IMAGE", "VOICE"].includes(type)) return { ok: false, error: "Unknown message type." };

  let convo;
  try {
    convo = await requireParticipant(conversationId, me.id);
  } catch {
    return { ok: false, error: "Conversation not found." };
  }

  if (!rateLimit(`msg:${me.id}`, 30, 60_000)) {
    return { ok: false, error: "You're sending messages very quickly. Please wait a moment." };
  }
  if (await isBlockedEitherWay(me.id, convo.otherUserId)) {
    return { ok: false, error: "You can't send messages in this conversation." };
  }

  const rawBody = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (rawBody.length > MAX_MESSAGE_CHARS) {
    return { ok: false, error: `Messages can be up to ${MAX_MESSAGE_CHARS} characters.` };
  }

  let body: string | null = rawBody || null;
  let mediaUrl: string | null = null;
  let durationSec: number | null = null;

  try {
    if (type === "TEXT") {
      if (!body) return { ok: false, error: "Write a message first." };
    } else if (type === "IMAGE") {
      const file = fileFrom(formData.get("file"));
      if (!file) return { ok: false, error: "Choose a photo to send." };
      mediaUrl = await saveImage(file);
    } else {
      const file = fileFrom(formData.get("file"));
      if (!file) return { ok: false, error: "The recording is empty." };
      const d = Math.round(Number(formData.get("durationSec") ?? 0));
      durationSec = Number.isFinite(d) ? Math.min(MAX_VOICE_SECONDS, Math.max(1, d)) : 1;
      mediaUrl = await saveAudio(file);
      body = null;
    }
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    console.error("[messages] upload failed", e);
    return { ok: false, error: "We couldn't upload that. Please try again." };
  }

  const now = new Date();
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: { conversationId, senderId: me.id, type, body, mediaUrl, durationSec },
      select: MESSAGE_SELECT,
    }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } }),
  ]);

  // Notify the other person, at most once per conversation every 10 minutes
  // while they still have unread messages here.
  const link = `/messages/${conversationId}`;
  const [olderUnread, recentNotice] = await Promise.all([
    prisma.message.count({
      where: { conversationId, senderId: me.id, readAt: null, deletedAt: null, id: { not: message.id } },
    }),
    prisma.notification.findFirst({
      where: {
        userId: convo.otherUserId,
        type: "NEW_MESSAGE",
        link,
        createdAt: { gte: new Date(now.getTime() - NOTIFY_THROTTLE_MS) },
      },
      select: { id: true },
    }),
  ]);
  if (!(olderUnread > 0 && recentNotice)) {
    const sender = me.name || me.username;
    const preview =
      type === "TEXT" ? (body ?? "").slice(0, 120) : type === "IMAGE" ? "Sent you a photo" : "Sent you a voice message";
    // Don't hold up the sender while email/push/SMS go out.
    after(() => notify({ userId: convo.otherUserId, type: "NEW_MESSAGE", title: `New message from ${sender}`, body: preview, link }));
  }

  return { ok: true, message: toChatMessage(message) };
}
