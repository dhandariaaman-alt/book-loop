import type { Metadata } from "next";
import Link from "next/link";
import "@fontsource/caveat/latin-500.css";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Doodle } from "@/components/landing/decorations";
import { Reveal } from "@/components/landing/reveal";

export const metadata: Metadata = { title: "Dashboard" };

type Tint = "mint" | "peach" | "lavender" | "sky" | "butter" | "rose";
type IconKind = "book" | "leaf" | "cup";

const TINT_BG: Record<Tint, string> = {
  mint: "bg-mint",
  peach: "bg-peach",
  lavender: "bg-lavender",
  sky: "bg-sky",
  butter: "bg-butter",
  rose: "bg-rose",
};

function deep(t: Tint) {
  return `color-mix(in srgb, var(--${t}) 45%, var(--brand))`;
}

function Icon({ kind }: { kind: IconKind }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className="h-full w-full"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {kind === "book" && <path d="M5 7c4-1.5 8-1 11 1.5 3-2.5 7-3 11-1.5v17c-4-1.5-8-1-11 1.5-3-2.5-7-3-11-1.5zM16 8.5V26" />}
      {kind === "leaf" && <path d="M7 25C6 14 13 6 26 6c0 12-7 19-17 19M7 25l10-10" />}
      {kind === "cup" && (
        <path d="M6 12h15v7a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6zM21 14h2.5a3 3 0 0 1 0 6H21M10 5c-1 2 1 3 0 5M15 5c-1 2 1 3 0 5" />
      )}
    </svg>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-10">
      <h2 className="heading text-2xl font-semibold">{children}</h2>
      <svg
        viewBox="0 0 90 8"
        className="mt-1 h-2 w-20 text-accent"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      >
        <path d="M2 5c7-5 12 3 19-1s12 3 19-1 12 3 19-1 12 2 28-1" />
      </svg>
    </div>
  );
}

function Section({
  title,
  children,
  action,
  tint = "mint",
  icon = "book",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  tint?: Tint;
  icon?: IconKind;
}) {
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <div className={`flex items-center justify-between gap-2 border-b border-border px-5 py-3 ${TINT_BG[tint]}`}>
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface p-1.5 text-brand">
            <Icon kind={icon} />
          </span>
          <h3 className="heading font-semibold">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

function Empty({ children, icon = "book" }: { children: React.ReactNode; icon?: IconKind }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2 px-4 py-6 text-center text-sm text-muted">
      <span className="h-8 w-8 text-brand/70">
        <Icon kind={icon} />
      </span>
      <p>{children}</p>
    </div>
  );
}

const SOON = "Coming in Phase 2";

const PILL =
  "inline-flex cursor-not-allowed items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-fg opacity-70";

export default async function DashboardPage() {
  const me = await requireUser();
  const now = new Date();
  const soon = new Date(now.getTime() + 3 * 24 * 60 * 60_000);

  const [profile, incoming, outgoing, myListings, activeBorrowings, overdue, dueSoon, donationRequests] =
    await Promise.all([
      prisma.profile.findUnique({ where: { userId: me.id }, select: { latitude: true, neighbourhood: true } }),
      prisma.request.count({ where: { status: "PENDING", listing: { ownerId: me.id } } }),
      prisma.request.count({ where: { status: "PENDING", requesterId: me.id } }),
      prisma.bookListing.count({ where: { ownerId: me.id, status: { not: "REMOVED" } } }),
      prisma.transaction.count({ where: { receiverId: me.id, type: "BORROW", status: "HANDED_OVER" } }),
      prisma.transaction.count({
        where: { receiverId: me.id, type: "BORROW", status: "HANDED_OVER", agreedDueDate: { lt: now } },
      }),
      prisma.transaction.count({
        where: { receiverId: me.id, type: "BORROW", status: "HANDED_OVER", agreedDueDate: { gte: now, lte: soon } },
      }),
      prisma.donationRequest.findMany({
        where: { status: "OPEN", institution: { verificationStatus: "VERIFIED" } },
        orderBy: { createdAt: "desc" },
        take: 3,
        select: { id: true, title: true, institution: { select: { name: true } } },
      }),
    ]);

  const firstName = me.name?.split(" ")[0] ?? me.username;

  const stats: { label: string; value: number; tint: Tint }[] = [
    { label: "Requests to review", value: incoming, tint: "mint" },
    { label: "My pending requests", value: outgoing, tint: "peach" },
    { label: "Active borrowings", value: activeBorrowings, tint: "lavender" },
    { label: "Books I've listed", value: myListings, tint: "sky" },
  ];

  return (
    <div className="mx-auto max-w-6xl overflow-x-clip px-4 py-8">
      <Reveal>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="heading text-3xl font-semibold sm:text-4xl">Hello, {firstName}</h1>
            <p className="font-hand text-2xl text-accent">happy reading ✶</p>
            <p className="text-muted">
              {profile?.neighbourhood ? <>Books around {profile.neighbourhood}</> : "Here's what's happening in your loop."}
            </p>
          </div>
          <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
            <span className="btn-primary cursor-not-allowed opacity-60" title={SOON}>+ List a book</span>
            <span className={`${PILL} bg-peach`} title={SOON}>Find a book</span>
            <span className={`${PILL} bg-lavender`} title="Coming in Phase 3">Requests</span>
            <span className={`${PILL} bg-sky`} title="Coming in Phase 4">Messages</span>
          </nav>
          <Doodle kind="sparkle" className="-top-2 right-0 hidden w-7 md:block" color="var(--accent)" fill="var(--butter)" animation="twinkle" />
        </div>
      </Reveal>

      {profile?.latitude == null && (
        <Reveal delay={80}>
          <div className="relative mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-butter p-5 text-fg">
            <div className="md:pl-14">
              <p className="font-semibold">Share your area to see nearby books</p>
              <p className="text-sm">Nearby discovery needs your approximate location. Your exact position is never shown.</p>
            </div>
            <Doodle kind="leaf" className="absolute left-4 top-1/2 hidden w-9 -translate-y-1/2 md:block" color="var(--brand)" fill="var(--mint)" animation="float" />
            <Link href="/settings/profile" className="btn-primary">Set location</Link>
          </div>
        </Reveal>
      )}

      {(overdue > 0 || dueSoon > 0) && (
        <Reveal delay={120}>
          <div className="mt-6 space-y-2" role="status">
            {overdue > 0 && (
              <p className="rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">
                {overdue} borrowed {overdue === 1 ? "book is" : "books are"} overdue. Please arrange a return.
              </p>
            )}
            {dueSoon > 0 && (
              <p className="rounded-2xl border border-border bg-butter px-4 py-3 text-sm">
                {dueSoon} {dueSoon === 1 ? "book is" : "books are"} due back in the next 3 days.
              </p>
            )}
          </div>
        </Reveal>
      )}

      <Reveal delay={100}>
        <SectionTitle>My activity</SectionTitle>
        <dl className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <div
              key={s.label}
              className={`relative overflow-hidden rounded-2xl border border-border p-4 pt-5 shadow-sm ${TINT_BG[s.tint]} ${i % 2 ? "sm:rotate-[0.6deg]" : "sm:-rotate-[0.6deg]"}`}
            >
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: deep(s.tint) }} aria-hidden="true" />
              <dd className="heading text-4xl font-semibold leading-none">{s.value}</dd>
              <dt className="mt-2 text-xs text-fg/70">{s.label}</dt>
            </div>
          ))}
        </dl>
      </Reveal>

      <Reveal delay={80}>
        <SectionTitle>Discover</SectionTitle>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Section title="Nearby books" tint="mint" icon="book">
            <Empty icon="book">Book listings arrive in Phase 2. Nearby books will show up here.</Empty>
          </Section>
          <Section title="Recently listed" tint="peach" icon="leaf">
            <Empty icon="leaf">No books listed in your area yet.</Empty>
          </Section>
          <Section title="Recommended for you" tint="lavender" icon="book">
            <Empty icon="book">
              Pick your favourite genres in{" "}
              <Link href="/settings/profile" className="text-brand hover:underline">your profile</Link> for better picks.
            </Empty>
          </Section>
          <Section title="Popular in your neighbourhood" tint="sky" icon="cup">
            <Empty icon="cup">Nothing trending yet.</Empty>
          </Section>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="relative">
          <SectionTitle>Community</SectionTitle>
          <Doodle kind="heart" className="right-2 top-10 hidden w-6 md:block" color="var(--accent)" fill="var(--rose)" animation="float" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Section title="Donation requests" tint="rose" icon="leaf">
            {donationRequests.length === 0 ? (
              <Empty icon="leaf">No libraries or community centres are asking for books right now.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {donationRequests.map((d) => (
                  <li key={d.id} className="py-2.5">
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="text-xs text-muted">{d.institution.name}</p>
                  </li>
                ))}
              </ul>
            )}
          </Section>
          <Section title="Exchange opportunities" tint="butter" icon="cup">
            <Empty icon="cup">Exchange listings near you will appear here.</Empty>
          </Section>
        </div>
      </Reveal>
    </div>
  );
}
