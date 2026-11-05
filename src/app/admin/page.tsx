import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader, Panel, StatTile, type Tint } from "@/components/app/ui";
import { OPEN_REPORT_STATUSES, fmtDate, humanize, pct } from "@/lib/admin";
import { Badge } from "./_components/kit";

export const metadata: Metadata = { title: "Overview" };

const DAY = 86_400_000;

export default async function AdminOverviewPage() {
  await requireRole(["ADMIN"]);
  const since = new Date(Date.now() - 30 * DAY);

  const [
    users,
    activeUsers,
    listingsByStatus,
    txByStatus,
    openReports,
    openDisputes,
    pendingInstitutions,
    requestsByStatus,
    rating,
    completedByType,
    donations,
    escalated,
    oldDisputes,
    pendingInst,
  ] = await Promise.all([
    prisma.user.count(),
    // Approximate: anyone whose account changed or who listed, requested or messaged in the last 30 days.
    prisma.user.count({
      where: {
        status: "ACTIVE",
        OR: [
          { updatedAt: { gte: since } },
          { listings: { some: { createdAt: { gte: since } } } },
          { requestsMade: { some: { createdAt: { gte: since } } } },
          { messagesSent: { some: { createdAt: { gte: since } } } },
        ],
      },
    }),
    prisma.bookListing.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.report.count({ where: { status: { in: OPEN_REPORT_STATUSES } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
    prisma.institution.count({ where: { verificationStatus: "PENDING" } }),
    prisma.request.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.review.aggregate({ where: { removedAt: null }, _avg: { rating: true }, _count: { _all: true } }),
    prisma.transaction.groupBy({ by: ["type"], where: { status: "COMPLETED" }, _count: { _all: true } }),
    prisma.donation.aggregate({ where: { status: "RECEIVED" }, _count: { _all: true }, _sum: { quantity: true } }),
    prisma.report.findMany({
      where: { status: "ESCALATED" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, target: true, reason: true, createdAt: true },
    }),
    prisma.dispute.findMany({
      where: { status: "OPEN" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, kind: true, createdAt: true, transaction: { select: { listing: { select: { book: { select: { title: true } } } } } } },
    }),
    prisma.institution.findMany({
      where: { verificationStatus: "PENDING" },
      orderBy: { createdAt: "asc" },
      take: 5,
      select: { id: true, name: true, createdAt: true },
    }),
  ]);

  const count = <T extends { _count: { _all: number } }>(rows: T[], pick: (r: T) => boolean) =>
    rows.filter(pick).reduce((n, r) => n + r._count._all, 0);
  const totalListings = count(listingsByStatus, () => true);
  const totalTx = count(txByStatus, () => true);

  const accepted = count(requestsByStatus, (r) => r.status === "ACCEPTED");
  const answered = count(requestsByStatus, (r) => ["ACCEPTED", "REJECTED", "EXPIRED"].includes(r.status));
  const completed = count(txByStatus, (r) => r.status === "COMPLETED");
  const finished = count(txByStatus, (r) => ["COMPLETED", "CANCELLED", "DISPUTED"].includes(r.status));
  const giveaways = count(completedByType, (r) => r.type === "GIVEAWAY");
  const borrows = count(completedByType, (r) => r.type === "BORROW");

  const tiles: { label: string; value: number; tint: Tint }[] = [
    { label: "Users", value: users, tint: "mint" },
    { label: "Active in the last 30 days", value: activeUsers, tint: "sky" },
    { label: "Listings", value: totalListings, tint: "butter" },
    { label: "Transactions", value: totalTx, tint: "lavender" },
    { label: "Open reports", value: openReports, tint: "peach" },
    { label: "Open disputes", value: openDisputes, tint: "rose" },
    { label: "Institutions to verify", value: pendingInstitutions, tint: "butter" },
  ];

  const attention: { href: string; text: string; meta: string; badge: string }[] = [
    ...escalated.map((r) => ({ href: `/admin/reports?status=ESCALATED`, text: `${humanize(r.target)} report: ${r.reason.slice(0, 80)}`, meta: fmtDate(r.createdAt), badge: "ESCALATED" })),
    ...oldDisputes.map((d) => ({ href: `/admin/disputes/${d.id}`, text: `${humanize(d.kind)} on "${d.transaction.listing.book.title}"`, meta: fmtDate(d.createdAt), badge: "OPEN" })),
    ...pendingInst.map((i) => ({ href: `/admin/institutions?status=PENDING`, text: `Verify ${i.name}`, meta: fmtDate(i.createdAt), badge: "PENDING" })),
  ];

  return (
    <div>
      <PageHeader title="Admin" note="keeping the loop kind" subtitle="Platform health at a glance." />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
        {tiles.map((t) => (
          <StatTile key={t.label} label={t.label} value={t.value} tint={t.tint} />
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Panel title="Success metrics" tint="mint" icon="heart">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
            <Metric label="Request acceptance" value={pct(accepted, answered)} hint={`${accepted} of ${answered} answered`} />
            <Metric label="Completion rate" value={pct(completed, finished)} hint={`${completed} of ${finished} finished`} />
            <Metric
              label="Average rating"
              value={rating._avg.rating != null ? rating._avg.rating.toFixed(2) : "n/a"}
              hint={`${rating._count._all} reviews`}
            />
            <Metric label="Giveaways completed" value={String(giveaways)} />
            <Metric label="Borrows completed" value={String(borrows)} />
            <Metric label="Donations received" value={String(donations._count._all)} hint={`${donations._sum.quantity ?? 0} books`} />
          </dl>
        </Panel>

        <Panel title="Needs attention" tint="peach" icon="inbox">
          {attention.length === 0 ? (
            <EmptyState icon="leaf">Nothing waiting. Lovely.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {attention.map((a, i) => (
                <li key={i}>
                  <Link href={a.href} className="flex items-center justify-between gap-3 rounded-lg px-1 py-2.5 text-sm hover:bg-surface-2/60">
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{a.text}</span>
                      <span className="text-xs text-muted">Since {a.meta}</span>
                    </span>
                    <Badge value={a.badge} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Listings by status" tint="butter" icon="book">
          <StatusBars rows={listingsByStatus.map((r) => ({ key: r.status, n: r._count._all }))} total={totalListings} />
        </Panel>

        <Panel title="Transactions by status" tint="sky" icon="swap">
          <StatusBars rows={txByStatus.map((r) => ({ key: r.status, n: r._count._all }))} total={totalTx} />
        </Panel>
      </div>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="heading mt-0.5 text-2xl font-semibold">{value}</dd>
      {hint && <dd className="text-[11px] text-muted">{hint}</dd>}
    </div>
  );
}

function StatusBars({ rows, total }: { rows: { key: string; n: number }[]; total: number }) {
  if (rows.length === 0) return <EmptyState>Nothing yet.</EmptyState>;
  return (
    <ul className="space-y-2.5">
      {rows
        .sort((a, b) => b.n - a.n)
        .map((r) => (
          <li key={r.key} className="text-sm">
            <div className="flex items-center justify-between gap-2">
              <Badge value={r.key} />
              <span className="font-mono text-xs">{r.n}</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-brand" style={{ width: `${total ? Math.max(2, (r.n / total) * 100) : 0}%` }} />
            </div>
          </li>
        ))}
    </ul>
  );
}
