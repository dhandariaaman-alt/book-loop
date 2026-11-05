import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/app/ui";
import { OPEN_REPORT_STATUSES, PAGE_SIZE, fmtDate, humanize, moderatorScope, oneOf, pageFrom, reportInclude } from "@/lib/admin";
import { Badge, FilterBar, Pagination } from "../admin/_components/kit";
import { ReportCard } from "../admin/_components/report-card";

export const metadata: Metadata = { title: "Moderation" };

const STATUSES = ["OPEN", "UNDER_REVIEW", "ESCALATED", "RESOLVED", "DISMISSED"] as const;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function ModeratorPage({ searchParams }: { searchParams: SP }) {
  const me = await requireRole(["MODERATOR", "ADMIN"]);
  const sp = await searchParams;
  const statusParam = typeof sp.status === "string" ? sp.status : "ACTIVE";
  const status = oneOf(statusParam, STATUSES);
  const page = pageFrom(sp.page);

  const scope = await moderatorScope(me);
  const communityIds = scope.communities.map((c) => c.id);

  const where: Prisma.ReportWhereInput = {
    AND: [
      scope.reportWhere,
      { status: status ? status : statusParam === "ALL" ? undefined : { in: OPEN_REPORT_STATUSES } },
    ],
  };

  // Activity: admins see every community, moderators only theirs.
  const listingWhere: Prisma.BookListingWhereInput = scope.isAdmin ? { communityId: { not: null } } : { communityId: { in: communityIds } };
  const hasActivity = scope.isAdmin || communityIds.length > 0;
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [total, reports, openCount, listingCount, txCount, recentListings, recentTx] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({ where, orderBy: { createdAt: "asc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE, include: reportInclude }),
    prisma.report.count({ where: { AND: [scope.reportWhere, { status: { in: ["OPEN", "UNDER_REVIEW"] } }] } }),
    hasActivity ? prisma.bookListing.count({ where: { ...listingWhere, createdAt: { gte: since }, status: { not: "REMOVED" } } }) : 0,
    hasActivity ? prisma.transaction.count({ where: { listing: listingWhere, createdAt: { gte: since } } }) : 0,
    hasActivity
      ? prisma.bookListing.findMany({
          where: { ...listingWhere, status: { not: "REMOVED" } },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            neighbourhood: true,
            book: { select: { title: true } },
            owner: { select: { username: true } },
            community: { select: { name: true } },
          },
        })
      : [],
    hasActivity
      ? prisma.transaction.findMany({
          where: { listing: listingWhere },
          orderBy: { createdAt: "desc" },
          take: 10,
          select: {
            id: true,
            type: true,
            status: true,
            createdAt: true,
            listing: { select: { book: { select: { title: true } }, community: { select: { name: true } } } },
            owner: { select: { username: true } },
            receiver: { select: { username: true } },
          },
        })
      : [],
  ]);

  const scopeText = scope.isAdmin
    ? "You're an admin, so you see reports from every community."
    : scope.communities.length > 0
      ? `You moderate ${scope.communities.map((c) => c.name).join(", ")}.`
      : "You aren't assigned to a community yet, so you see reports that have no community.";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 lg:pt-8">
      <PageHeader
        title="Moderation"
        note="kind, fair, quick"
        subtitle={scopeText}
        actions={
          scope.isAdmin ? (
            <Link href="/admin/reports" className="btn-secondary">
              Admin reports queue
            </Link>
          ) : undefined
        }
      />

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatTile label="Reports needing action" value={openCount} tint="peach" />
        <StatTile label="New listings, 30 days" value={listingCount} tint="mint" />
        <StatTile label="New hand-offs, 30 days" value={txCount} tint="sky" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section aria-label="Reports" className="min-w-0">
          <h2 className="heading text-2xl font-semibold">Reports</h2>
          <p className="text-sm text-muted">You can remove listings and reviews, or escalate to admins. Only admins can suspend or ban people.</p>
          <FilterBar
            action="/moderator"
            selects={[
              {
                name: "status",
                label: "Status",
                value: status ?? (statusParam === "ALL" ? "ALL" : "ACTIVE"),
                options: [
                  { value: "ACTIVE", label: "Needs action" },
                  { value: "ALL", label: "All" },
                  ...STATUSES.map((s) => ({ value: s, label: humanize(s) })),
                ],
              },
            ]}
          />
          <div className="mt-4 space-y-4">
            {reports.length === 0 ? (
              <EmptyState icon="inbox">No reports here. Nice and quiet.</EmptyState>
            ) : (
              reports.map((r) => <ReportCard key={r.id} r={r} mode="moderator" />)
            )}
            <Pagination
              path="/moderator"
              params={{ status: statusParam === "ACTIVE" ? undefined : statusParam }}
              page={page}
              total={total}
              pageSize={PAGE_SIZE}
            />
          </div>
        </section>

        <div className="min-w-0 space-y-6">
          <Panel title="Community activity" tint="mint" icon="book">
            {!hasActivity ? (
              <EmptyState icon="pin">Ask an admin to assign you a community to see its activity.</EmptyState>
            ) : recentListings.length === 0 ? (
              <EmptyState>No listings yet.</EmptyState>
            ) : (
              <>
                <h4 className="font-mono text-[11px] uppercase tracking-wider text-muted">Recent listings</h4>
                <ul className="mt-2 divide-y divide-border text-sm">
                  {recentListings.map((l) => (
                    <li key={l.id} className="flex items-start justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <Link href={`/books/${l.id}`} className="block truncate font-medium text-brand hover:underline">
                          {l.book.title}
                        </Link>
                        <span className="block truncate text-xs text-muted">
                          @{l.owner.username} · {humanize(l.type)} · {[l.neighbourhood, l.community?.name].filter(Boolean).join(", ")} · {fmtDate(l.createdAt)}
                        </span>
                      </span>
                      <Badge value={l.status} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Panel>

          {hasActivity && (
            <Panel title="Recent hand-offs" tint="sky" icon="swap">
              {recentTx.length === 0 ? (
                <EmptyState icon="swap">No transactions yet.</EmptyState>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {recentTx.map((t) => (
                    <li key={t.id} className="flex items-start justify-between gap-2 py-2">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{t.listing.book.title}</span>
                        <span className="block truncate text-xs text-muted">
                          @{t.owner.username} to @{t.receiver.username} · {humanize(t.type)} · {fmtDate(t.createdAt)}
                        </span>
                      </span>
                      <Badge value={t.status} />
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
