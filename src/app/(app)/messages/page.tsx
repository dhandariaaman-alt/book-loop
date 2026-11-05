import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Reveal } from "@/components/landing/reveal";
import { Doodle } from "@/components/landing/decorations";
import { EmptyState, PageHeader, SoonBadge } from "@/components/app/ui";

export const metadata: Metadata = { title: "Messages" };

function timeLabel(d: Date, now: Date) {
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Illustration() {
  return (
    <svg viewBox="0 0 220 150" className="mx-auto h-36 w-52" aria-hidden="true" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 30h110a10 10 0 0 1 10 10v44a10 10 0 0 1-10 10H70l-22 18V94H20a10 10 0 0 1-10-10V40a10 10 0 0 1 10-10z" fill="var(--mint)" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M30 52h80M30 66h56" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M100 76h90a10 10 0 0 1 10 10v36a10 10 0 0 1-10 10h-8v16l-20-16h-62a10 10 0 0 1-10-10V86a10 10 0 0 1 10-10z" fill="var(--lavender)" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M118 98h60M118 112h38" stroke="var(--brand)" strokeWidth="2.5" />
      <path d="M185 22l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="var(--butter)" stroke="var(--accent)" strokeWidth="2" />
    </svg>
  );
}

export default async function MessagesPage() {
  const user = await requireUser();
  const now = new Date();

  const conversations = await prisma.conversation.findMany({
    where: { OR: [{ userAId: user.id }, { userBId: user.id }] },
    orderBy: { lastMessageAt: "desc" },
    take: 20,
    include: {
      userA: { select: { id: true, name: true, username: true } },
      userB: { select: { id: true, name: true, username: true } },
      messages: { where: { deletedAt: null }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  return (
    <div className="min-w-0">
      <Reveal>
        <PageHeader title="Messages" note="say hello, plan the hand-off" subtitle="Chat with readers about requests and meet-ups." />
      </Reveal>

      <Reveal className="mt-6">
        <div className="grid gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <aside className="card min-w-0 overflow-hidden" aria-label="Conversations">
            <div className="border-b border-border bg-sky px-5 py-3">
              <h2 className="heading font-semibold">Conversations</h2>
            </div>
            {conversations.length === 0 ? (
              <div className="p-4">
                <EmptyState icon="chat">No conversations yet.</EmptyState>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {conversations.map((c) => {
                  const other = c.userAId === user.id ? c.userB : c.userA;
                  const display = other.name || other.username;
                  const last = c.messages[0];
                  const preview = last
                    ? last.type === "TEXT"
                      ? (last.body ?? "")
                      : last.type === "IMAGE"
                        ? "Sent a photo"
                        : "Voice message"
                    : "Say hello!";
                  return (
                    <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-lavender font-semibold uppercase">
                        {display.slice(0, 2)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <p className="heading truncate font-semibold">{display}</p>
                          <span className="shrink-0 font-mono text-xs text-muted">{timeLabel(last?.createdAt ?? c.lastMessageAt, now)}</span>
                        </div>
                        <p className="truncate text-sm text-muted">{preview}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </aside>

          <section
            className={`card relative min-w-0 overflow-hidden p-6 sm:p-10 ${conversations.length > 0 ? "hidden lg:block" : ""}`}
            aria-label="Conversation"
          >
            <Doodle kind="leaf" className="absolute left-5 top-6 hidden w-9 md:block" color="var(--brand)" fill="var(--mint)" animation="float" />
            <Doodle kind="heart" className="absolute right-6 top-8 hidden w-7 md:block" color="var(--accent)" fill="var(--rose)" animation="float" />
            <div className="mx-auto max-w-md text-center">
              <Illustration />
              <h2 className="heading mt-4 text-2xl font-semibold">Your conversations will live here</h2>
              <p className="mt-2 text-muted">
                Chats open automatically when you request a book, or when someone requests yours.
              </p>
              <div className="mt-3">
                <SoonBadge phase={4} />
              </div>
              <div className="mt-6 rounded-xl border border-border bg-butter px-4 py-3 text-sm">
                <span className="font-hand text-xl text-accent">Safety tip</span>
                <p>Meet in public places · never share your home address</p>
              </div>
            </div>
          </section>
        </div>
      </Reveal>
    </div>
  );
}
