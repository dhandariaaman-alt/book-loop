// One-to-one conversations (PRD section 7).
// Each request gets its own conversation between requester and owner.
// Users are stored sorted (userAId < userBId) so pairs are consistent.

import { prisma } from "./prisma";

/** Find or create the conversation for a request (or a plain pair when requestId is omitted). */
export async function getOrCreateConversation(userX: string, userY: string, requestId?: string): Promise<string> {
  const [userAId, userBId] = userX < userY ? [userX, userY] : [userY, userX];
  if (requestId) {
    const existing = await prisma.conversation.findUnique({ where: { requestId }, select: { id: true } });
    if (existing) return existing.id;
    try {
      const c = await prisma.conversation.create({ data: { userAId, userBId, requestId }, select: { id: true } });
      return c.id;
    } catch {
      // Created concurrently by the other party.
      const c = await prisma.conversation.findUniqueOrThrow({ where: { requestId }, select: { id: true } });
      return c.id;
    }
  }
  const existing = await prisma.conversation.findFirst({
    where: { userAId, userBId, requestId: null },
    select: { id: true },
  });
  if (existing) return existing.id;
  const c = await prisma.conversation.create({ data: { userAId, userBId }, select: { id: true } });
  return c.id;
}

/** Throws unless the user is a participant. Use before reading or writing a conversation. */
export async function requireParticipant(conversationId: string, userId: string) {
  const c = await prisma.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: userId }, { userBId: userId }] },
    select: { id: true, userAId: true, userBId: true, requestId: true },
  });
  if (!c) throw new Error("Conversation not found.");
  return { ...c, otherUserId: c.userAId === userId ? c.userBId : c.userAId };
}

/** Add an automatic system-style note to a conversation (sent as the acting user). */
export async function postConversationNote(conversationId: string, senderId: string, body: string) {
  await prisma.$transaction([
    prisma.message.create({ data: { conversationId, senderId, type: "TEXT", body } }),
    prisma.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: new Date() } }),
  ]);
}
