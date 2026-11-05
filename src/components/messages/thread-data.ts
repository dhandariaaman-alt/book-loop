// Server-only helpers shared by the chat page and the polling route.
import { prisma } from "@/lib/prisma";

/** Mark the other user's unread messages (and their NEW_MESSAGE notifications) as read. */
export async function markConversationRead(conversationId: string, meId: string) {
  const now = new Date();
  const res = await prisma.message.updateMany({
    where: { conversationId, senderId: { not: meId }, readAt: null },
    data: { readAt: now },
  });
  if (res.count > 0) {
    await prisma.notification.updateMany({
      where: { userId: meId, type: "NEW_MESSAGE", link: `/messages/${conversationId}`, readAt: null },
      data: { readAt: now },
    });
  }
  return res.count;
}

/** Latest createdAt among my messages the other user has read (for the "Seen" receipt). */
export async function seenUpTo(conversationId: string, meId: string): Promise<string | null> {
  const m = await prisma.message.findFirst({
    where: { conversationId, senderId: meId, readAt: { not: null }, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });
  return m?.createdAt.toISOString() ?? null;
}
