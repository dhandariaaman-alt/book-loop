import type { Metadata } from "next";
import Link from "next/link";
import type { BookCondition, ListingType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { browseListings, CONDITIONS, LISTING_TYPES, type ListingCard as Card } from "@/lib/listings";
import { RADIUS_OPTIONS_KM } from "@/lib/geo";
import { Reveal } from "@/components/landing/reveal";
import { EmptyState, Icon, PageHeader, SectionTitle } from "@/components/app/ui";
import { ListingCard } from "@/components/listings/listing-card";
import { AutoSubmit } from "./filters";

export const metadata: Metadata = { title: "Discover" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;

const CHIP =
  "relative inline-flex cursor-pointer select-none items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg transition-colors hover:bg-surface-2 has-[:checked]:border-brand has-[:checked]:bg-brand has-[:checked]:text-brand-fg has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50";

const MAX_DELAY = 360;

export default async function DiscoverPage({ searchParams }: { searchParams: SearchParams }) {
  const me = await requireUser();
  const sp = await searchParams;

  const [genres, profile] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.profile.findUnique({
      where: { userId: me.id },
      select: { neighbourhood: true, favouriteGenres: { select: { id: true } } },
    }),
  ]);

  // Validate every param against the allowed values; ignore anything else.
  const q = one(sp.q)?.slice(0, 100);
  const typeRaw = one(sp.type);
  const type = LISTING_TYPES.some((t) => t.value === typeRaw) ? (typeRaw as ListingType) : undefined;
  const condRaw = one(sp.condition);
  const condition = CONDITIONS.some((c) => c.value === condRaw) ? (condRaw as BookCondition) : undefined;
  const genreRaw = one(sp.genre);
  const genreId = genres.some((g) => g.id === genreRaw) ? genreRaw : undefined;
  const radiusNum = Number(one(sp.radius));
  const radius = (RADIUS_OPTIONS_KM as readonly number[]).includes(radiusNum) ? radiusNum : undefined;
  const sortRaw = one(sp.sort);
  const sortParam = sortRaw === "near" || sortRaw === "new" ? sortRaw : undefined;

  const { items, hasLocation } = await browseListings(me.id, { q, type, condition, genreId, radiusKm: radius, sort: sortParam });
  const sort = sortParam === "near" && !hasLocation ? "new" : (sortParam ?? (hasLocation ? "near" : "new"));

  const activeCount = [q, type, condition, genreId, hasLocation ? radius : undefined].filter(Boolean).length;
  const filtered = activeCount > 0;

  // "Recommended for you": available books in the user's favourite genres, only on the unfiltered view.
  let recommended: Card[] = [];
  const favIds = (profile?.favouriteGenres ?? []).map((g) => g.id).slice(0, 6);
  if (!filtered && favIds.length > 0) {
    const lists = await Promise.all(favIds.map((id) => browseListings(me.id, { genreId: id, take: 8 })));
    const seen = new Set<string>();
    recommended = lists
      .flatMap((l) => l.items)
      .filter((c) => !c.isMine && !seen.has(c.id) && seen.add(c.id))
      .sort((a, b) =>
        hasLocation
          ? (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity)
          : b.createdAt.getTime() - a.createdAt.getTime(),
      )
      .slice(0, 8);
  }

  const count = items.length;
  const countLine = `${count} ${count === 1 ? "book" : "books"}${hasLocation && !filtered ? " near you" : ""}`;

  return (
    <div className="min-w-0">
      <Reveal>
        <PageHeader
          title="Discover books"
          note="find your next read"
          subtitle={profile?.neighbourhood ? `Books around ${profile.neighbourhood}` : "Books from readers near you"}
        />
      </Reveal>

      <Reveal delay={60}>
        <form method="get" action="/discover" className="card mt-6 p-4 sm:p-5" role="search" aria-label="Filter books">
          <AutoSubmit />
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <label htmlFor="discover-q" className="sr-only">
                Search by title or author
              </label>
              <span className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                <Icon kind="search" />
              </span>
              <input
                id="discover-q"
                name="q"
                type="search"
                defaultValue={q ?? ""}
                maxLength={100}
                placeholder="Search by title or author"
                className="input pl-10"
              />
            </div>
            <div className="flex gap-2">
              <button type="submit" className="btn-primary flex-1 sm:flex-none">
                Search
              </button>
              {filtered && (
                <Link href="/discover" className="btn-ghost flex-1 sm:flex-none">
                  Clear
                </Link>
              )}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="min-w-0">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted">Type</span>
              <select name="type" defaultValue={type ?? ""} className="input">
                <option value="">Any type</option>
                {LISTING_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted">Condition</span>
              <select name="condition" defaultValue={condition ?? ""} className="input">
                <option value="">Any condition</option>
                {CONDITIONS.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0">
              <span className="mb-1 block text-xs uppercase tracking-wider text-muted">Genre</span>
              <select name="genre" defaultValue={genreId ?? ""} className="input">
                <option value="">Any genre</option>
                {genres.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <fieldset className="min-w-0" disabled={!hasLocation}>
              <legend className="mb-1.5 text-xs uppercase tracking-wider text-muted">Within</legend>
              <div className="flex flex-wrap gap-2">
                {RADIUS_OPTIONS_KM.map((r) => (
                  <label key={r} className={CHIP}>
                    <input type="radio" name="radius" value={r} defaultChecked={radius === r} className="sr-only" />
                    {r} km
                  </label>
                ))}
                <label className={CHIP}>
                  <input type="radio" name="radius" value="" defaultChecked={!radius} className="sr-only" />
                  Any
                </label>
              </div>
              {!hasLocation && <p className="mt-1.5 text-xs text-muted">Set your area to filter by distance.</p>}
            </fieldset>

            <fieldset className="min-w-0">
              <legend className="mb-1.5 text-xs uppercase tracking-wider text-muted">Sort</legend>
              <div className="flex flex-wrap gap-2">
                <label className={CHIP}>
                  <input type="radio" name="sort" value="near" defaultChecked={sort === "near"} disabled={!hasLocation} className="sr-only" />
                  Nearest
                </label>
                <label className={CHIP}>
                  <input type="radio" name="sort" value="new" defaultChecked={sort === "new"} className="sr-only" />
                  Newest
                </label>
              </div>
            </fieldset>
          </div>

          {filtered && (
            <p className="mt-4 text-xs text-muted">
              {activeCount} {activeCount === 1 ? "filter" : "filters"} on
            </p>
          )}
        </form>
      </Reveal>

      {!hasLocation && (
        <Reveal delay={80}>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-butter p-5 text-fg">
            <div className="min-w-0">
              <p className="font-semibold">Set your area to see distances and nearby books</p>
              <p className="text-sm">We only use your approximate area. Your exact position is never shown.</p>
            </div>
            <Link href="/settings/profile" className="btn-primary">
              Set your area
            </Link>
          </div>
        </Reveal>
      )}

      {recommended.length > 0 && (
        <section aria-labelledby="recommended">
          <SectionTitle>
            <span id="recommended">Recommended for you</span>
          </SectionTitle>
          <p className="mt-1 text-sm text-muted">From the genres you love.</p>
          <ul className="-mx-4 mt-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
            {recommended.map((c) => (
              <li key={c.id} className="w-36 shrink-0 snap-start sm:w-44">
                <ListingCard card={c} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="results" className="mt-8">
        <h2 id="results" className="text-sm font-medium text-muted" aria-live="polite">
          {countLine}
        </h2>

        {count === 0 ? (
          <div className="mt-4">
            <EmptyState icon="compass">
              <p className="font-medium text-fg">{filtered ? "No books match those filters." : "No books listed nearby yet."}</p>
              <p className="mt-1">Have one on your shelf? Neighbours would love it.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Link href="/books/new" className="btn-primary">
                  Be the first to list one
                </Link>
                {filtered && (
                  <Link href="/discover" className="btn-secondary">
                    Clear filters
                  </Link>
                )}
              </div>
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-4">
            {items.map((c, i) => (
              <Reveal as="li" key={c.id} delay={Math.min(i * 40, MAX_DELAY)} className="min-w-0">
                <ListingCard card={c} index={i} />
              </Reveal>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
