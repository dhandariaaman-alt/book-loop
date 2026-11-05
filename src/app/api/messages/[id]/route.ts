import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";
import { isBlockedEitherWay } from "@/lib/blocks";
import { requireParticipant } from "@/lib/conversations";
import { MESSAGE_SELECT, toChatMessage } from "@/components/messages/types";
import { markConversationRead, seenUpTo } from "@/components/messages/thread-data";

// Polling endpoint for the chat page (real-time sockets are out of scope).
// GET /api/messages/{conversationId}?after={lastMessageId | ISO date}
//   → { messages: ChatMessage[], seenUpTo: ISO | null, blocked: boolean }
// Viewing a conversation marks the other user's messages as read.

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const meId = session?.user?.id;
  if (!meId) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`poll:${meId}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const { id } = await params;
  let convo;
  try {
    convo = await requireParticipant(id, meId);
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // Cursor: a message id from this conversation, or an ISO timestamp.
  const after = req.nextUrl.searchParams.get("after")?.trim() ?? "";
  let since: Date | null = null;
  let excludeId: string | undefined;
  if (after) {
    const d = new Date(after);
    if (/^\d{4}-\d{2}-\d{2}T/.test(after) && !Number.isNaN(d.getTime())) {
      since = d;
    } else {
      const m = await prisma.message.findFirst({ where: { id: after, conversationId: id }, select: { createdAt: true } });
      if (m) {
        since = m.createdAt;
        excludeId = after;
      }
    }
  }

  const rows = await prisma.message.findMany({
    where: {
      conversationId: id,
      deletedAt: null,
      ...(since ? { createdAt: excludeId ? { gte: since } : { gt: since } } : {}),
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { createdAt: since ? "asc" : "desc" },
    take: 100,
    select: MESSAGE_SELECT,
  });
  if (!since) rows.reverse();

  if (rows.some((m) => m.senderId !== meId && !m.readAt)) await markConversationRead(id, meId);

  const [seen, blocked] = await Promise.all([seenUpTo(id, meId), isBlockedEitherWay(meId, convo.otherUserId)]);

  return NextResponse.json(
    { messages: rows.map(toChatMessage), seenUpTo: seen, blocked },
    { headers: { "Cache-Control": "no-store" } },
  );
}
