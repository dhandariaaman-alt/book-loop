import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Doodle } from "@/components/landing/decorations";
import { Reveal } from "@/components/landing/reveal";
import { Icon, PageHeader, SectionTitle, StatTile, TINT_BG, deep, type IconKind, type Tint } from "@/components/app/ui";

export const metadata: Metadata = { title: "Home" };

const PILL =
  "inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium text-fg transition hover:-translate-y-0.5 hover:shadow-sm";

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

  const sections: { href: string; title: string; desc: string; tint: Tint; icon: IconKind }[] = [
    { href: "/discover", title: "Discover", desc: "Nearby, new and recommended books", tint: "peach", icon: "compass" },
    {
      href: "/activity",
      title: "My activity",
      desc: incoming > 0 ? `${incoming} ${incoming === 1 ? "request" : "requests"} to review` : "Requests, borrowings and your books",
      tint: "lavender",
      icon: "swap",
    },
    {
      href: "/community",
      title: "Community",
      desc:
        donationRequests.length > 0
          ? `${donationRequests.length} open donation ${donationRequests.length === 1 ? "request" : "requests"}`
          : "Donations and exchanges",
      tint: "rose",
      icon: "heart",
    },
    { href: "/messages", title: "Messages", desc: "Chat with readers · Phase 4", tint: "sky", icon: "chat" },
  ];

  return (
    <div>
      <Reveal>
        <div className="relative">
          <PageHeader
            title={`Hello, ${firstName}`}
            note="happy reading ✶"
            subtitle={profile?.neighbourhood ? `Books around ${profile.neighbourhood}` : "Here's what's happening in your loop."}
          />
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

      <Reveal delay={80}>
        <SectionTitle>Your sections</SectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          {sections.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className={`group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-2xl border border-border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md sm:p-5 ${TINT_BG[s.tint]}`}
            >
              <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: deep(s.tint) }} aria-hidden="true" />
              <span className="mt-1 flex h-10 w-10 items-center justify-center rounded-full bg-surface p-2 text-brand">
                <Icon kind={s.icon} />
              </span>
              <span className="heading text-lg font-semibold sm:text-xl">{s.title}</span>
              <span className="text-sm text-fg/75">{s.desc}</span>
              <span className="mt-auto inline-block text-lg text-brand transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">
                →
              </span>
            </Link>
          ))}
        </div>
      </Reveal>

      <Reveal delay={80}>
        <SectionTitle>At a glance</SectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map((s, i) => (
            <StatTile key={s.label} label={s.label} value={s.value} tint={s.tint} tilt={i % 2 ? 0.6 : -0.6} />
          ))}
        </div>
      </Reveal>

      <Reveal delay={80}>
        <nav aria-label="Quick actions" className="mt-8 flex flex-wrap gap-2">
          <Link href="/books/new" className="btn-primary">+ List a book</Link>
          <Link href="/discover" className={`${PILL} bg-peach`}>Find a book</Link>
          <Link href="/activity" className={`${PILL} bg-lavender`}>View requests</Link>
        </nav>
      </Reveal>

      {donationRequests.length > 0 && (
        <Reveal delay={80}>
          <SectionTitle
            action={
              <Link href="/community" className="text-sm text-brand hover:underline">
                See all →
              </Link>
            }
          >
            From the community
          </SectionTitle>
          <ul className="card mt-4 divide-y divide-border px-5">
            {donationRequests.map((d) => (
              <li key={d.id} className="py-3">
                <p className="text-sm font-medium">{d.title}</p>
                <p className="text-xs text-muted">{d.institution.name}</p>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </div>
  );
}
