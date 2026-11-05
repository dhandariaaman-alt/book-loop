import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Dashboard" };

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <section className="card p-5" aria-label={title}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl bg-surface-2 px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

const SOON = "Coming in Phase 2";

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

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="heading text-3xl font-semibold">Hello, {firstName}</h1>
          <p className="text-muted">
            {profile?.neighbourhood ? <>Books around {profile.neighbourhood}</> : "Here's what's happening in your loop."}
          </p>
        </div>
        <nav aria-label="Quick actions" className="flex flex-wrap gap-2">
          <span className="btn-primary cursor-not-allowed opacity-60" title={SOON}>+ List a book</span>
          <span className="btn-secondary cursor-not-allowed opacity-60" title={SOON}>Find a book</span>
          <span className="btn-secondary cursor-not-allowed opacity-60" title="Coming in Phase 3">Requests</span>
          <span className="btn-secondary cursor-not-allowed opacity-60" title="Coming in Phase 4">Messages</span>
        </nav>
      </div>

      {profile?.latitude == null && (
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-soft p-5 text-brand">
          <div>
            <p className="font-semibold">Share your area to see nearby books</p>
            <p className="text-sm">Nearby discovery needs your approximate location. Your exact position is never shown.</p>
          </div>
          <Link href="/settings/profile" className="btn-primary">Set location</Link>
        </div>
      )}

      {(overdue > 0 || dueSoon > 0) && (
        <div className="mt-6 space-y-2" role="status">
          {overdue > 0 && (
            <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">
              {overdue} borrowed {overdue === 1 ? "book is" : "books are"} overdue. Please arrange a return.
            </p>
          )}
          {dueSoon > 0 && (
            <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
              {dueSoon} {dueSoon === 1 ? "book is" : "books are"} due back in the next 3 days.
            </p>
          )}
        </div>
      )}

      <h2 className="heading mt-10 text-xl font-semibold">My activity</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Requests to review", value: incoming },
          { label: "My pending requests", value: outgoing },
          { label: "Active borrowings", value: activeBorrowings },
          { label: "Books I've listed", value: myListings },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="heading mt-10 text-xl font-semibold">Discover</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Section title="Nearby books">
          <Empty>Book listings arrive in Phase 2. Nearby books will show up here.</Empty>
        </Section>
        <Section title="Recently listed">
          <Empty>No books listed in your area yet.</Empty>
        </Section>
        <Section title="Recommended for you">
          <Empty>
            Pick your favourite genres in{" "}
            <Link href="/settings/profile" className="text-brand hover:underline">your profile</Link> for better picks.
          </Empty>
        </Section>
        <Section title="Popular in your neighbourhood">
          <Empty>Nothing trending yet.</Empty>
        </Section>
      </div>

      <h2 className="heading mt-10 text-xl font-semibold">Community</h2>
      <div className="mt-3 grid gap-4 md:grid-cols-2">
        <Section title="Donation requests">
          {donationRequests.length === 0 ? (
            <Empty>No libraries or community centres are asking for books right now.</Empty>
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
        <Section title="Exchange opportunities">
          <Empty>Exchange listings near you will appear here.</Empty>
        </Section>
      </div>
    </div>
  );
}
