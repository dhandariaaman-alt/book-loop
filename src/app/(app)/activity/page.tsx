import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Reveal } from "@/components/landing/reveal";
import { EmptyState, PageHeader, Panel, SoonBadge, StatTile } from "@/components/app/ui";
import { LISTING_STATUS, REQUEST_STATUS, TX_STATUS, TYPE_LABEL, TYPE_PILL, relativeDate, shortDate } from "./labels";

export const metadata: Metadata = { title: "My activity" };

const TABS = ["requests", "borrowing", "books", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  requests: "Requests",
  borrowing: "Borrowing",
  books: "My books",
  history: "History",
};

const DAY = 24 * 60 * 60 * 1000;

function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "requests";
  const now = new Date();

  const bookSel = { select: { title: true, author: true } };
  const incomingWhere = { status: "PENDING" as const, listing: { ownerId: user.id } };
  const borrowedWhere = { receiverId: user.id, type: "BORROW" as const, status: "HANDED_OVER" as const };
  const lentWhere = { ownerId: user.id, status: "HANDED_OVER" as const };
  const myBooksWhere = { ownerId: user.id, status: { not: "REMOVED" as const } };
  const historyWhere = {
    status: { in: ["COMPLETED" as const, "CANCELLED" as const] },
    OR: [{ ownerId: user.id }, { receiverId: user.id }],
  };

  const [toReview, myPending, borrowedCount, lentCount, booksCount, historyCount] = await Promise.all([
    prisma.request.count({ where: incomingWhere }),
    prisma.request.count({ where: { requesterId: user.id, status: "PENDING" } }),
    prisma.transaction.count({ where: borrowedWhere }),
    prisma.transaction.count({ where: lentWhere }),
    prisma.bookListing.count({ where: myBooksWhere }),
    prisma.transaction.count({ where: historyWhere }),
  ]);

  const counts: Record<Tab, number> = {
    requests: toReview + myPending,
    borrowing: borrowedCount + lentCount,
    books: booksCount,
    history: historyCount,
  };

  let content: React.ReactNode = null;

  if (tab === "requests") {
    const [incoming, outgoing] = await Promise.all([
      prisma.request.findMany({
        where: incomingWhere,
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { listing: { include: { book: bookSel } }, requester: { select: { username: true } } },
      }),
      prisma.request.findMany({
        where: { requesterId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { listing: { include: { book: bookSel, owner: { select: { username: true } } } } },
      }),
    ]);
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Requests to review" tint="peach" icon="inbox">
          {incoming.length === 0 ? (
            <EmptyState icon="inbox">Nothing to review right now. When someone asks for one of your books, it lands here.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {incoming.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="heading truncate font-semibold">{r.listing.book.title}</p>
                    <p className="truncate text-sm text-muted">
                      {r.listing.book.author} · from @{r.requester.username}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={TYPE_PILL[r.type]}>{TYPE_LABEL[r.type]}</Pill>
                    <Pill className={REQUEST_STATUS[r.status].pill}>{REQUEST_STATUS[r.status].label}</Pill>
                    <span className="text-xs text-muted">{relativeDate(r.createdAt, now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel title="My requests" tint="sky" icon="swap">
          {outgoing.length === 0 ? (
            <EmptyState icon="search">You haven&apos;t asked for any books yet. Find one you like and send a request.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {outgoing.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <p className="heading truncate font-semibold">{r.listing.book.title}</p>
                    <p className="truncate text-sm text-muted">
                      {r.listing.book.author} · owned by @{r.listing.owner.username}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Pill className={TYPE_PILL[r.type]}>{TYPE_LABEL[r.type]}</Pill>
                    <Pill className={REQUEST_STATUS[r.status].pill}>{REQUEST_STATUS[r.status].label}</Pill>
                    <span className="text-xs text-muted">{relativeDate(r.createdAt, now)}</span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    );
  } else if (tab === "borrowing") {
    const [borrowed, lent] = await Promise.all([
      prisma.transaction.findMany({
        where: borrowedWhere,
        orderBy: { agreedDueDate: "asc" },
        take: 50,
        include: { listing: { include: { book: bookSel } }, owner: { select: { username: true } } },
      }),
      prisma.transaction.findMany({
        where: lentWhere,
        orderBy: { agreedDueDate: "asc" },
        take: 50,
        include: { listing: { include: { book: bookSel } }, receiver: { select: { username: true } } },
      }),
    ]);
    const duePill = (due: Date | null) => {
      if (!due) return null;
      if (due.getTime() < now.getTime()) return <Pill className="bg-danger-soft text-danger">Overdue</Pill>;
      if (due.getTime() - now.getTime() <= 3 * DAY) return <Pill className="bg-butter">Due soon</Pill>;
      return null;
    };
    const row = (
      t: { id: string; agreedDueDate: Date | null; listing: { book: { title: string; author: string } } },
      who: string,
    ) => (
      <li key={t.id} className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0">
        <div className="min-w-0">
          <p className="heading truncate font-semibold">{t.listing.book.title}</p>
          <p className="truncate text-sm text-muted">
            {t.listing.book.author} · {who}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {duePill(t.agreedDueDate)}
          <span className="text-xs text-muted">{t.agreedDueDate ? `Due ${shortDate(t.agreedDueDate)}` : "No due date"}</span>
        </div>
      </li>
    );
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Borrowed by me" tint="mint" icon="book">
          {borrowed.length === 0 ? (
            <EmptyState icon="book">You aren&apos;t borrowing anything at the moment.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">{borrowed.map((t) => row(t, `from @${t.owner.username}`))}</ul>
          )}
        </Panel>
        <Panel title="Lent by me" tint="lavender" icon="heart">
          {lent.length === 0 ? (
            <EmptyState icon="heart">None of your books are out on loan.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">{lent.map((t) => row(t, `with @${t.receiver.username}`))}</ul>
          )}
        </Panel>
      </div>
    );
  } else if (tab === "books") {
    const listings = await prisma.bookListing.findMany({
      where: myBooksWhere,
      orderBy: { createdAt: "desc" },
      take: 60,
      include: { book: bookSel },
    });
    content = (
      <Panel
        title="My books"
        tint="butter"
        icon="book"
        action={
          <span className="flex items-center gap-2">
            <button type="button" disabled className="btn-primary cursor-not-allowed text-sm opacity-60">
              + List a book
            </button>
            <SoonBadge phase={2} />
          </span>
        }
      >
        {listings.length === 0 ? (
          <EmptyState icon="book">Your shelf is empty. Listing books arrives in Phase 2.</EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {listings.map((l) => (
              <li key={l.id} className="min-w-0 rounded-xl border border-border bg-surface-2 p-4">
                <p className="heading truncate font-semibold">{l.book.title}</p>
                <p className="truncate text-sm text-muted">{l.book.author}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Pill className={TYPE_PILL[l.type]}>{TYPE_LABEL[l.type]}</Pill>
                  <Pill className={LISTING_STATUS[l.status].pill}>{LISTING_STATUS[l.status].label}</Pill>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  } else {
    const history = await prisma.transaction.findMany({
      where: historyWhere,
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        listing: { include: { book: bookSel } },
        owner: { select: { username: true } },
        receiver: { select: { username: true } },
      },
    });
    content = (
      <Panel title="Past hand-offs" tint="rose" icon="clock">
        {history.length === 0 ? (
          <EmptyState icon="clock">No finished hand-offs yet. Completed and cancelled ones will appear here.</EmptyState>
        ) : (
          <ol className="relative">
            {history.map((t, i) => {
              const iOwn = t.ownerId === user.id;
              const other = iOwn ? t.receiver.username : t.owner.username;
              const date = t.completedAt ?? t.cancelledAt ?? t.updatedAt;
              return (
                <li key={t.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < history.length - 1 && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-border" aria-hidden="true" />}
                  <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-brand bg-surface" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">{shortDate(date)}</p>
                    <p className="heading truncate font-semibold">{t.listing.book.title}</p>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <span>
                        {iOwn ? "Gave to" : "Received from"} @{other}
                      </span>
                      <Pill className={TX_STATUS[t.status].pill}>{TX_STATUS[t.status].label}</Pill>
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Panel>
    );
  }

  return (
    <div className="min-w-0">
      <Reveal>
        <PageHeader title="My activity" note="every hand-off counts" subtitle="Track requests, loans and the books you've shared." />
      </Reveal>

      <Reveal className="mt-6">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatTile label="Requests to review" value={toReview} tint="peach" tilt={-1} />
          <StatTile label="My pending requests" value={myPending} tint="sky" tilt={1} />
          <StatTile label="Active borrowings" value={borrowedCount} tint="mint" tilt={-0.5} />
          <StatTile label="Books I've listed" value={booksCount} tint="butter" tilt={1} />
        </div>
      </Reveal>

      <Reveal className="mt-8">
        <nav aria-label="Activity sections" className="-mx-1 overflow-x-auto px-1 pb-1">
          <ul className="flex w-max gap-2">
            {TABS.map((t) => {
              const active = t === tab;
              return (
                <li key={t}>
                  <Link
                    href={`/activity?tab=${t}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-2 whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm transition-colors ${
                      active ? "bg-lavender font-semibold" : "bg-surface hover:bg-surface-2"
                    }`}
                  >
                    {TAB_LABEL[t]}
                    <span className="rounded-full bg-surface px-2 font-mono text-xs">{counts[t]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </Reveal>

      <Reveal className="mt-5">{content}</Reveal>
    </div>
  );
}
