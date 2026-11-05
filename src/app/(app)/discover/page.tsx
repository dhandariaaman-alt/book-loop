import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Reveal } from "@/components/landing/reveal";
import { EmptyState, Icon, PageHeader, Panel, SoonBadge } from "@/components/app/ui";

export const metadata: Metadata = { title: "Discover" };

const CHIP =
  "inline-flex cursor-not-allowed items-center rounded-full border border-border bg-surface px-3.5 py-1.5 text-sm font-medium text-fg opacity-70";

const DISTANCES = ["1 km", "5 km", "10 km"];
const TYPES = ["All", "Borrow", "Exchange", "Give away", "Sale"];
const GENRE_TINTS = ["bg-mint", "bg-peach", "bg-sky", "bg-butter", "bg-rose"];

export default async function DiscoverPage() {
  const me = await requireUser();
  const profile = await prisma.profile.findUnique({
    where: { userId: me.id },
    select: {
      latitude: true,
      neighbourhood: true,
      favouriteGenres: { select: { id: true, name: true }, orderBy: { name: "asc" } },
    },
  });
  const genres = profile?.favouriteGenres ?? [];

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
        <div className="card mt-6 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <label htmlFor="discover-search" className="sr-only">
              Search by title or author
            </label>
            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted">
                <Icon kind="search" />
              </span>
              <input
                id="discover-search"
                type="search"
                disabled
                title="Search arrives in Phase 2"
                placeholder="Search by title or author"
                className="input w-full cursor-not-allowed pl-10 opacity-70"
              />
            </div>
            <SoonBadge phase={2} />
          </div>
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Distance">
              <span className="mr-1 text-xs uppercase tracking-wider text-muted">Within</span>
              {DISTANCES.map((d) => (
                <button key={d} type="button" disabled title="Filters arrive in Phase 2" className={CHIP}>
                  {d}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Listing type">
              <span className="mr-1 text-xs uppercase tracking-wider text-muted">Type</span>
              {TYPES.map((t) => (
                <button key={t} type="button" disabled title="Filters arrive in Phase 2" className={CHIP}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Reveal>

      {profile?.latitude == null && (
        <Reveal delay={80}>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-butter p-5 text-fg">
            <div className="min-w-0">
              <p className="font-semibold">Share your area to see nearby books</p>
              <p className="text-sm">Nearby discovery needs your approximate location. Your exact position is never shown.</p>
            </div>
            <Link href="/settings/profile" className="btn-primary">
              Set location
            </Link>
          </div>
        </Reveal>
      )}

      <Reveal delay={80}>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Panel title="Nearby books" tint="mint" icon="pin">
            <EmptyState icon="pin">Book listings arrive in Phase 2. Nearby books will show up here.</EmptyState>
          </Panel>
          <Panel title="Recently listed" tint="peach" icon="leaf">
            <EmptyState icon="leaf">No books listed in your area yet.</EmptyState>
          </Panel>
          <Panel title="Recommended for you" tint="lavender" icon="book">
            {genres.length > 0 ? (
              <EmptyState icon="book">
                <p>No matches yet. We&apos;ll match books in:</p>
                <ul className="mt-3 flex flex-wrap justify-center gap-2">
                  {genres.map((g, i) => (
                    <li
                      key={g.id}
                      className={`rounded-full border border-border px-3 py-1 text-xs font-medium text-fg ${GENRE_TINTS[i % GENRE_TINTS.length]}`}
                    >
                      {g.name}
                    </li>
                  ))}
                </ul>
              </EmptyState>
            ) : (
              <EmptyState icon="book">
                Pick your favourite genres in{" "}
                <Link href="/settings/profile" className="text-brand hover:underline">
                  your profile
                </Link>{" "}
                for better picks.
              </EmptyState>
            )}
          </Panel>
          <Panel title="Popular nearby" tint="sky" icon="cup">
            <EmptyState icon="cup">Nothing trending yet.</EmptyState>
          </Panel>
        </div>
      </Reveal>
    </div>
  );
}
