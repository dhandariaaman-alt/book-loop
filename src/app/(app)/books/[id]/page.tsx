import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { conditionLabel, getListing, STATUS_LABEL } from "@/lib/listings";
import { formatDistance } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";
import { Icon } from "@/components/app/ui";
import { DrawnCover, TypePill } from "@/components/listings/listing-card";
import { Gallery } from "@/components/listings/gallery";
import { OwnerActions } from "@/components/listings/owner-actions";
import { activeTransactionForListing, formatDate, pendingRequestsForListing, requesterContext } from "@/lib/transactions";
import { RequestForm } from "@/components/requests/request-form";
import { CancelRequestButton, RequestDecision } from "@/components/requests/request-buttons";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const l = await prisma.bookListing.findFirst({
    where: { id, status: { not: "REMOVED" } },
    select: { book: { select: { title: true } } },
  });
  return { title: l?.book.title ?? "Book" };
}

export default async function BookPage({ params, searchParams }: Props) {
  const [{ id }, sp, me] = await Promise.all([params, searchParams, requireUser()]);
  const book = await getListing(id, me.id);
  if (!book) notFound();

  const place = [book.neighbourhood, book.distanceKm != null ? `${formatDistance(book.distanceKm)} away` : null]
    .filter(Boolean)
    .join(" · ");
  const available = book.status === "AVAILABLE";
  const ownerName = book.owner.name ?? book.owner.username;

  const [ownerRequests, ownerActive, mine] = await Promise.all([
    book.isMine ? pendingRequestsForListing(book.id) : null,
    book.isMine ? activeTransactionForListing(book.id) : null,
    book.isMine ? null : requesterContext(book.id, me.id),
  ]);
  const requestable = book.status === "AVAILABLE" || book.status === "REQUEST_PENDING";

  return (
    <div className="min-w-0">
      <Link href="/discover" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←</span> Back to Discover
      </Link>

      {sp.new === "1" && (
        <p role="status" className="mt-4 rounded-2xl border border-border bg-mint p-4 text-sm font-medium text-fg">
          Your book is listed. Neighbours can find it in Discover now.
        </p>
      )}
      {sp.saved === "1" && (
        <p role="status" className="mt-4 rounded-2xl border border-border bg-mint p-4 text-sm font-medium text-fg">
          Changes saved.
        </p>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12">
        <Gallery
          images={book.images}
          title={book.title}
          fallback={<DrawnCover title={book.title} author={book.author} />}
        />

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <TypePill card={book} />
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                available ? "bg-mint text-fg" : "bg-surface-2 text-muted"
              }`}
            >
              {STATUS_LABEL[book.status]}
            </span>
            {book.isMine && (
              <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-semibold text-brand">Yours</span>
            )}
          </div>

          <h1 className="heading mt-3 text-3xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-4xl">{book.title}</h1>
          <p className="mt-1 text-lg text-muted">by {book.author}</p>

          <ul className="mt-4 flex flex-wrap gap-2 text-sm" aria-label="Details">
            <li className="rounded-full border border-border bg-peach px-3 py-1">Condition: {conditionLabel(book.condition)}</li>
            {book.genre && <li className="rounded-full border border-border bg-lavender px-3 py-1">{book.genre}</li>}
            {book.isbn && <li className="rounded-full border border-border bg-surface px-3 py-1 font-mono text-xs leading-5">ISBN {book.isbn}</li>}
          </ul>

          {place && (
            <p className="mt-4 flex items-center gap-1.5 text-sm text-muted">
              <span className="h-4 w-4 shrink-0">
                <Icon kind="pin" />
              </span>
              {place}
            </p>
          )}

          {book.description && (
            <div className="mt-6">
              <h2 className="text-xs uppercase tracking-wider text-muted">About this copy</h2>
              <p className="mt-2 whitespace-pre-line [overflow-wrap:anywhere]">{book.description}</p>
            </div>
          )}

          <div className="card mt-6 flex items-center gap-3 p-4">
            <Avatar name={ownerName} image={book.owner.image} size={48} />
            <div className="min-w-0">
              <p className="truncate font-medium">{ownerName}</p>
              <p className="truncate text-sm text-muted">
                <Link href={`/u/${book.owner.username}`} className="text-brand hover:underline">
                  @{book.owner.username}
                </Link>{" "}
                · Member since {book.owner.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
              </p>
            </div>
          </div>

          <div className="mt-6">
            {book.isMine ? (
              <div className="space-y-6">
                <OwnerActions id={book.id} status={book.status} />
                {ownerActive && (
                  <div className="card flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
                    <p>
                      In a hand-off with <span className="font-semibold">@{ownerActive.receiver.username}</span>.
                    </p>
                    <Link href={`/transactions/${ownerActive.id}`} className="btn-primary text-sm">
                      View hand-off
                    </Link>
                  </div>
                )}
                <section className="card p-4 sm:p-5" aria-label="Requests for this book">
                  <h2 className="heading text-lg font-semibold">Requests for this book</h2>
                  {!ownerRequests || ownerRequests.length === 0 ? (
                    <p className="mt-2 text-sm text-muted">No pending requests. When a neighbour asks for it, they&apos;ll show up here.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-border">
                      {ownerRequests.map((r) => (
                        <li key={r.id} className="py-4 first:pt-0 last:pb-0">
                          <div className="flex items-center gap-3">
                            <Avatar name={r.requester.name ?? r.requester.username} image={r.requester.image} size={36} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">
                                <Link href={`/u/${r.requester.username}`} className="hover:underline">
                                  {r.requester.name ?? r.requester.username}
                                </Link>{" "}
                                <span className="font-normal text-muted">@{r.requester.username}</span>
                              </p>
                              <p className="text-xs text-muted">{formatDate(r.createdAt)}</p>
                            </div>
                          </div>
                          {(r.proposedDays || r.offeredListing) && (
                            <div className="mt-2 flex flex-wrap gap-2 text-xs">
                              {r.proposedDays && <span className="rounded-full bg-sky px-2.5 py-0.5">For {r.proposedDays} days</span>}
                              {r.offeredListing && (
                                <Link href={`/books/${r.offeredListing.id}`} className="rounded-full bg-lavender px-2.5 py-0.5 hover:underline">
                                  Offers: {r.offeredListing.book.title}
                                </Link>
                              )}
                            </div>
                          )}
                          {r.message && (
                            <p className="mt-2 whitespace-pre-line rounded-xl bg-surface-2 p-3 text-sm [overflow-wrap:anywhere]">{r.message}</p>
                          )}
                          <div className="mt-3">
                            <RequestDecision requestId={r.id} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              </div>
            ) : (
              <div className="card p-4 sm:p-5">
                <h2 className="heading flex items-center gap-2 text-lg font-semibold">
                  <span className="h-5 w-5 text-brand">
                    <Icon kind="swap" />
                  </span>
                  Request this book
                </h2>
                <div className="mt-3">
                  {mine?.active ? (
                    <div className="rounded-xl bg-mint p-3 text-sm">
                      <p className="font-medium">The owner accepted your request.</p>
                      <Link href={`/transactions/${mine.active.id}`} className="btn-primary mt-3 text-sm">
                        View hand-off
                      </Link>
                    </div>
                  ) : mine?.pending ? (
                    <div className="rounded-xl bg-sky p-3 text-sm">
                      <p className="font-medium">Request sent. Waiting for the owner.</p>
                      <p className="mt-0.5 text-xs text-fg/70">Sent {formatDate(mine.pending.createdAt)}</p>
                      <div className="mt-2">
                        <CancelRequestButton requestId={mine.pending.id} />
                      </div>
                    </div>
                  ) : requestable ? (
                    <RequestForm listingId={book.id} type={book.type} myAvailable={mine?.myAvailable ?? []} />
                  ) : (
                    <p className="rounded-xl bg-surface-2 p-3 text-sm text-muted">
                      This book isn&apos;t open for requests right now. Check back later or find another copy in Discover.
                    </p>
                  )}
                </div>
                <p className="mt-4 flex items-start gap-2 rounded-xl bg-butter p-3 text-sm text-fg">
                  <span className="mt-0.5 h-4 w-4 shrink-0">
                    <Icon kind="pin" />
                  </span>
                  Safety tip: Meet in a public place. Never share your home address.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
