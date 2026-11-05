/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { RequestStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { requireParticipant } from "@/lib/conversations";
import { typeLabel } from "@/lib/listing-labels";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/app/ui";
import { ReportButton } from "@/components/trust/report-button";
import { BlockButton } from "@/components/trust/block-button";
import { ChatThread } from "@/components/messages/chat-thread";
import { MESSAGE_SELECT, toChatMessage } from "@/components/messages/types";
import { markConversationRead, seenUpTo } from "@/components/messages/thread-data";

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: "Chat" };

const REQUEST_STATUS: Record<RequestStatus, { label: string; tint: string }> = {
  PENDING: { label: "Request pending", tint: "bg-butter" },
  ACCEPTED: { label: "Accepted", tint: "bg-mint" },
  REJECTED: { label: "Declined", tint: "bg-rose" },
  CANCELLED: { label: "Cancelled", tint: "bg-surface-2" },
  EXPIRED: { label: "Expired", tint: "bg-surface-2" },
};

export default async function ChatPage({ params }: Props) {
  const [{ id }, me] = await Promise.all([params, requireUser()]);

  let convo;
  try {
    convo = await requireParticipant(id, me.id);
  } catch {
    notFound();
  }

  await markConversationRead(id, me.id);

  const [other, request, recent, blocks, seen] = await Promise.all([
    prisma.user.findUnique({
      where: { id: convo.otherUserId },
      select: { id: true, name: true, username: true, image: true },
    }),
    convo.requestId
      ? prisma.request.findUnique({
          where: { id: convo.requestId },
          select: {
            status: true,
            type: true,
            listingId: true,
            transaction: { select: { id: true } },
            listing: {
              select: {
                book: { select: { title: true, author: true } },
                images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
              },
            },
          },
        })
      : null,
    prisma.message.findMany({
      where: { conversationId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: MESSAGE_SELECT,
    }),
    prisma.block.findMany({
      where: {
        OR: [
          { blockerId: me.id, blockedId: convo.otherUserId },
          { blockerId: convo.otherUserId, blockedId: me.id },
        ],
      },
      select: { blockerId: true },
    }),
    seenUpTo(id, me.id),
  ]);
  if (!other) notFound();

  const iBlocked = blocks.some((b) => b.blockerId === me.id);
  const blocked = blocks.length > 0;
  const otherName = other.name || other.username;
  const messages = recent.reverse().map(toChatMessage);
  const status = request ? REQUEST_STATUS[request.status] : null;

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <Link href="/messages" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←</span> All messages
      </Link>

      <header className="card mt-4 flex items-center gap-3 p-3 sm:p-4">
        <Avatar name={otherName} image={other.image} size={44} />
        <div className="min-w-0 flex-1">
          <h1 className="heading truncate text-xl font-semibold">{otherName}</h1>
          <Link href={`/u/${other.username}`} className="truncate text-sm text-brand hover:underline">
            @{other.username}
          </Link>
        </div>
        <details className="menu relative">
          <summary
            className="btn-ghost cursor-pointer list-none px-2.5 [&::-webkit-details-marker]:hidden"
            aria-label="Conversation options"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </summary>
          <div className="card absolute right-0 z-30 mt-2 flex w-56 flex-col gap-1 p-2 shadow-[0_12px_32px_-12px_rgb(60_45_25/0.25)]">
            <Link href={`/u/${other.username}`} className="rounded-md px-3 py-2 text-sm hover:bg-surface-2">
              View profile
            </Link>
            <ReportButton
              target="USER"
              targetId={other.id}
              reportedUserId={other.id}
              label="Report user"
              className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-surface-2"
            />
            <BlockButton
              userId={other.id}
              username={other.username}
              initiallyBlocked={iBlocked}
              className="w-full rounded-md px-3 py-2 text-left text-sm text-danger hover:bg-surface-2"
            />
          </div>
        </details>
      </header>

      {request && status && (
        <section className="card mt-3 flex items-center gap-3 p-3" aria-label="Linked book request">
          <div className="flex h-16 w-12 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-peach">
            {request.listing.images[0] ? (
              <img src={request.listing.images[0].url} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="h-6 w-6 text-brand">
                <Icon kind="book" />
              </span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <Link
              href={`/books/${request.listingId}`}
              className="heading line-clamp-1 font-semibold hover:underline [overflow-wrap:anywhere]"
            >
              {request.listing.book.title}
            </Link>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-brand-soft px-2 py-0.5 font-medium text-brand">{typeLabel(request.type)}</span>
              <span className={`rounded-full px-2 py-0.5 text-fg ${status.tint}`}>{status.label}</span>
            </div>
          </div>
          {request.transaction && (
            <Link href={`/transactions/${request.transaction.id}`} className="btn-secondary shrink-0 px-3 py-2 text-xs">
              Hand-off details
            </Link>
          )}
        </section>
      )}

      <p className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-butter px-3 py-2 text-sm">
        <span className="mt-0.5 h-4 w-4 shrink-0 text-accent">
          <Icon kind="pin" />
        </span>
        Safety tip: Meet in public places. Never share your home address.
      </p>

      <ChatThread
        conversationId={id}
        meId={me.id}
        otherName={otherName}
        otherUserId={other.id}
        initialMessages={messages}
        initialSeenUpTo={seen}
        initialBlocked={blocked}
        iBlocked={iBlocked}
      />
    </div>
  );
}
