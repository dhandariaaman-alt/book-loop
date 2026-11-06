import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Reveal } from "@/components/landing/reveal";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/app/ui";
import { STATUS_LABEL, formatPrice, myListings } from "@/lib/listings";
import { ACTIVE_TX, dueState, expireReservationsLazily } from "@/lib/transactions";
import { CancelRequestButton, RequestDecision } from "@/components/requests/request-buttons";
import { LISTING_STATUS, PLACEHOLDER_TINTS, REQUEST_STATUS, TX_STATUS, TYPE_LABEL, TYPE_PILL, relativeDate, shortDate, txStatusPill } from "./labels";

export const metadata: Metadata = { title: "My activity" };

const TABS = ["requests", "borrowing", "books", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = {
  requests: "Requests",
  borrowing: "Borrowing",
  books: "My books",
  history: "History",
};


function Pill({ className, children }: { className: string; children: React.ReactNode }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border border-border px-2.5 py-0.5 text-xs ${className}`}>
      {children}
    </span>
  );
}

export default async function ActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string; removed?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const tab: Tab = (TABS as readonly string[]).includes(sp.tab ?? "") ? (sp.tab as Tab) : "requests";
  await expireReservationsLazily();
  const now = new Date();

  const bookSel = { select: { title: true, author: true } };
  const incomingWhere = { status: "PENDING" as const, listing: { ownerId: user.id } };
  const borrowedWhere = { receiverId: user.id, status: { in: ACTIVE_TX } };
  const lentWhere = { ownerId: user.id, status: { in: ACTIVE_TX } };
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
        include: {
          listing: { include: { book: bookSel } },
          requester: { select: { username: true } },
          offeredListing: { select: { id: true, book: bookSel } },
        },
      }),
      prisma.request.findMany({
        where: { requesterId: user.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: {
          listing: { include: { book: bookSel, owner: { select: { username: true } } } },
          transaction: { select: { id: true, status: true } },
        },
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
                <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/books/${r.listingId}`} className="heading block truncate font-semibold hover:text-brand">
                        {r.listing.book.title}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        from{" "}
                        <Link href={`/u/${r.requester.username}`} className="hover:text-brand hover:underline">
                          @{r.requester.username}
                        </Link>
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className={TYPE_PILL[r.type]}>{TYPE_LABEL[r.type]}</Pill>
                      <span className="text-xs text-muted">{relativeDate(r.createdAt, now)}</span>
                    </div>
                  </div>
                  {(r.proposedDays || r.offeredListing) && (
                    <p className="mt-1.5 text-xs text-muted">
                      {r.proposedDays ? `Wants it for ${r.proposedDays} days` : null}
                      {r.offeredListing && (
                        <>
                          Offers{" "}
                          <Link href={`/books/${r.offeredListing.id}`} className="font-medium text-fg underline underline-offset-2">
                            {r.offeredListing.book.title}
                          </Link>
                        </>
                      )}
                    </p>
                  )}
                  {r.message && <p className="mt-2 line-clamp-3 rounded-lg bg-surface-2 px-3 py-2 text-sm [overflow-wrap:anywhere]">{r.message}</p>}
                  <div className="mt-3">
                    <RequestDecision requestId={r.id} compact />
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
                <li key={r.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <Link href={`/books/${r.listingId}`} className="heading block truncate font-semibold hover:text-brand">
                        {r.listing.book.title}
                      </Link>
                      <p className="truncate text-sm text-muted">
                        {r.listing.book.author} · owned by @{r.listing.owner.username}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className={TYPE_PILL[r.type]}>{TYPE_LABEL[r.type]}</Pill>
                      <Pill className={REQUEST_STATUS[r.status].pill}>{REQUEST_STATUS[r.status].label}</Pill>
                      <span className="text-xs text-muted">{relativeDate(r.createdAt, now)}</span>
                    </div>
                  </div>
                  {r.status === "PENDING" && (
                    <div className="mt-1">
                      <CancelRequestButton requestId={r.id} />
                    </div>
                  )}
                  {r.transaction && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Link href={`/transactions/${r.transaction.id}`} className="btn-secondary px-3 py-1.5 text-sm">
                        View hand-off
                      </Link>
                      <Pill className={TX_STATUS[r.transaction.status].pill}>{TX_STATUS[r.transaction.status].label}</Pill>
                    </div>
                  )}
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
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          listing: { include: { book: bookSel } },
          owner: { select: { username: true } },
          reservations: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, expiresAt: true } },
        },
      }),
      prisma.transaction.findMany({
        where: lentWhere,
        orderBy: { updatedAt: "desc" },
        take: 50,
        include: {
          listing: { include: { book: bookSel } },
          receiver: { select: { username: true } },
          reservations: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, expiresAt: true } },
        },
      }),
    ]);
    type Row = {
      id: string;
      type: string;
      status: (typeof borrowed)[number]["status"];
      agreedDueDate: Date | null;
      listing: { book: { title: string; author: string } };
      reservations: { status: string; expiresAt: Date }[];
    };
    const row = (t: Row, who: string) => {
      const due = dueState(t.agreedDueDate, t.status, now);
      const res = t.reservations[0];
      const hint =
        t.status === "RESERVED"
          ? res?.status === "CONFIRMED"
            ? "Meet-up confirmed"
            : res
              ? `Reserved until ${shortDate(res.expiresAt)}`
              : null
          : t.agreedDueDate && t.status === "HANDED_OVER"
            ? `Due ${shortDate(t.agreedDueDate)}`
            : null;
      return (
        <li key={t.id}>
          <Link
            href={`/transactions/${t.id}`}
            className="-mx-2 flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-3 transition-colors hover:bg-surface-2"
          >
            <div className="min-w-0">
              <p className="heading truncate font-semibold">{t.listing.book.title}</p>
              <p className="truncate text-sm text-muted">
                {t.listing.book.author} · {who}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Pill className={TYPE_PILL[t.type]}>{TYPE_LABEL[t.type]}</Pill>
              <Pill className={TX_STATUS[t.status].pill}>{TX_STATUS[t.status].label}</Pill>
              {due === "overdue" && <Pill className="bg-danger-soft text-danger">Overdue</Pill>}
              {due === "soon" && <Pill className="bg-butter">Due soon</Pill>}
              {hint && <span className="text-xs text-muted">{hint}</span>}
            </div>
          </Link>
        </li>
      );
    };
    content = (
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Coming to me" tint="mint" icon="book">
          {borrowed.length === 0 ? (
            <EmptyState icon="book">Nothing on its way to you right now. Accepted requests and loans show up here.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">{borrowed.map((t) => row(t, `from @${t.owner.username}`))}</ul>
          )}
        </Panel>
        <Panel title="Going out from me" tint="lavender" icon="heart">
          {lent.length === 0 ? (
            <EmptyState icon="heart">None of your books are reserved or out on loan.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">{lent.map((t) => row(t, `with @${t.receiver.username}`))}</ul>
          )}
        </Panel>
      </div>
    );
  } else if (tab === "books") {
    const listings = await myListings(user.id);
    content = (
      <div className="space-y-4">
        {sp.removed === "1" && (
          <p role="status" className="rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
            Listing removed.
          </p>
        )}
        <Panel
          title="My books"
          tint="butter"
          icon="book"
          action={
            <Link href="/books/new" className="btn-primary text-sm">
              + List a book
            </Link>
          }
        >
          {listings.length === 0 ? (
            <EmptyState icon="book">
              Your shelf is empty. List a book and a neighbour can borrow, swap or buy it.
            </EmptyState>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
              {listings.map((l, i) => {
                const price = l.type === "SALE" ? formatPrice(l.pricePaise) : null;
                return (
                  <li key={l.id} className="group relative flex min-w-0 flex-col">
                    <Link href={`/books/${l.id}`} className="flex min-w-0 flex-1 flex-col rounded-xl focus-visible:outline-2 focus-visible:outline-offset-4">
                      {l.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={l.imageUrl}
                          alt={`Cover of ${l.title}`}
                          loading="lazy"
                          className="aspect-[2/3] w-full rounded-l-sm rounded-r-md object-cover shadow-md transition group-hover:-translate-y-0.5"
                        />
                      ) : (
                        <span
                          aria-hidden="true"
                          className={`relative flex aspect-[2/3] w-full flex-col justify-between overflow-hidden rounded-l-sm rounded-r-md border border-border p-3 shadow-md transition group-hover:-translate-y-0.5 ${PLACEHOLDER_TINTS[i % PLACEHOLDER_TINTS.length]}`}
                        >
                          <span className="absolute inset-y-0 left-0 w-2 bg-fg/10" />
                          <span className="heading line-clamp-4 pl-1 text-base font-semibold leading-snug">{l.title}</span>
                          <span className="font-hand line-clamp-2 pl-1 text-lg leading-tight text-fg/70">{l.author}</span>
                        </span>
                      )}
                      <span className="mt-2 block truncate font-semibold heading">{l.title}</span>
                      <span className="block truncate text-sm text-muted">{l.author}</span>
                    </Link>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Pill className={TYPE_PILL[l.type]}>{TYPE_LABEL[l.type]}</Pill>
                      <Pill className={LISTING_STATUS[l.status]?.pill ?? "bg-surface-2"}>{STATUS_LABEL[l.status]}</Pill>
                      {price && <span className="text-sm font-semibold">{price}</span>}
                    </div>
                    <Link
                      href={`/books/${l.id}/edit`}
                      className="mt-1.5 self-start text-xs text-muted underline underline-offset-2 hover:text-brand"
                      aria-label={`Edit ${l.title}`}
                    >
                      Edit
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
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
        reservations: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true } },
      },
    });
    content = (
      <Panel title="Past hand-offs" tint="rose" icon="clock">
        {history.length === 0 ? (
          <EmptyState icon="clock">No finished hand-offs yet. Completed, cancelled and expired ones will appear here.</EmptyState>
        ) : (
          <ol className="relative">
            {history.map((t, i) => {
              const iOwn = t.ownerId === user.id;
              const other = iOwn ? t.receiver.username : t.owner.username;
              const date = t.completedAt ?? t.cancelledAt ?? t.updatedAt;
              const pill = txStatusPill(t.status, t.reservations[0]?.status);
              const verb =
                t.status === "COMPLETED"
                  ? t.type === "BORROW"
                    ? iOwn
                      ? "Lent to"
                      : "Borrowed from"
                    : iOwn
                      ? "Gave to"
                      : "Received from"
                  : iOwn
                    ? "With"
                    : "From";
              return (
                <li key={t.id} className="relative flex gap-4 pb-6 last:pb-0">
                  {i < history.length - 1 && <span className="absolute bottom-0 left-[5px] top-3 w-px bg-border" aria-hidden="true" />}
                  <span className="relative mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 border-brand bg-surface" aria-hidden="true" />
                  <div className="min-w-0">
                    <p className="font-mono text-xs text-muted">{shortDate(date)}</p>
                    <Link href={`/transactions/${t.id}`} className="heading block truncate font-semibold hover:text-brand">
                      {t.listing.book.title}
                    </Link>
                    <p className="flex flex-wrap items-center gap-2 text-sm text-muted">
                      <span>
                        {verb} @{other}
                      </span>
                      <Pill className={TYPE_PILL[t.type]}>{TYPE_LABEL[t.type]}</Pill>
                      <Pill className={pill.pill}>{pill.label}</Pill>
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
          <StatTile label="Active hand-offs" value={borrowedCount + lentCount} tint="mint" tilt={-0.5} />
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
