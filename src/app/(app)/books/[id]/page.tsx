import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { conditionLabel, getListing, STATUS_LABEL } from "@/lib/listings";
import { formatDistance } from "@/lib/geo";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";
import { Icon, SoonBadge } from "@/components/app/ui";
import { DrawnCover, TypePill } from "@/components/listings/listing-card";
import { Gallery } from "@/components/listings/gallery";
import { OwnerActions } from "@/components/listings/owner-actions";

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
              <OwnerActions id={book.id} status={book.status} />
            ) : (
              <div className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button type="button" disabled className="btn-primary">
                    <Icon kind="swap" className="h-4 w-4" />
                    Request this book
                  </button>
                  <SoonBadge phase={3} />
                </div>
                <p className="mt-2 text-sm text-muted">Requests open in the next update. For now, you can save the link and check back.</p>
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
