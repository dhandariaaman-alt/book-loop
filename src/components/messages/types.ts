// Chat message shape shared by the server (page, action, polling route) and the client thread.
// No database code here, so client components can import it.

import type { MessageType } from "@prisma/client";

export const MAX_MESSAGE_CHARS = 4000;
export const MAX_VOICE_SECONDS = 120;

export type ChatMessage = {
  id: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  durationSec: number | null;
  readAt: string | null;
  createdAt: string;
};

type Row = {
  id: string;
  senderId: string;
  type: MessageType;
  body: string | null;
  mediaUrl: string | null;
  durationSec: number | null;
  readAt: Date | null;
  createdAt: Date;
};

export function toChatMessage(m: Row): ChatMessage {
  return {
    id: m.id,
    senderId: m.senderId,
    type: m.type,
    body: m.body,
    mediaUrl: m.mediaUrl,
    durationSec: m.durationSec,
    readAt: m.readAt?.toISOString() ?? null,
    createdAt: m.createdAt.toISOString(),
  };
}

export const MESSAGE_SELECT = {
  id: true,
  senderId: true,
  type: true,
  body: true,
  mediaUrl: true,
  durationSec: true,
  readAt: true,
  createdAt: true,
} as const;

/** Short preview text for conversation lists. */
export function messagePreview(m: { type: MessageType; body: string | null } | undefined | null): string {
  if (!m) return "Say hello!";
  if (m.type === "IMAGE") return m.body ? `📷 ${m.body}` : "📷 Photo";
  if (m.type === "VOICE") return "🎤 Voice message";
  return m.body ?? "";
}

export function formatDuration(sec: number) {
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
