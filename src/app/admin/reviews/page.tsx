import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDate, oneOf, pageFrom } from "@/lib/admin";
import { adminReviewAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";
import { Badge, Cell, DataList, FilterBar, Pagination, Row, UserLink } from "../_components/kit";

export const metadata: Metadata = { title: "Reviews" };

const FILTERS = ["reported", "removed", "visible"] as const;
const COLS = "md:grid-cols-[minmax(0,1.4fr)_minmax(0,2.6fr)_minmax(0,0.9fr)_minmax(0,1.2fr)]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminReviewsPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const filter = oneOf(sp.show, FILTERS);
  const page = pageFrom(sp.page);

  const where: Prisma.ReviewWhereInput =
    filter === "reported" ? { reports: { some: {} } } : filter === "removed" ? { removedAt: { not: null } } : filter === "visible" ? { removedAt: null } : {};

  const [total, rows] = await Promise.all([
    prisma.review.count({ where }),
    prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        rating: true,
        comment: true,
        createdAt: true,
        removedAt: true,
        removedById: true,
        reviewer: { select: { username: true, name: true } },
        reviewee: { select: { username: true, name: true } },
        transaction: { select: { listing: { select: { book: { select: { title: true } } } } } },
        _count: { select: { reports: true } },
      },
    }),
  ]);

  const removerIds = [...new Set(rows.map((r) => r.removedById).filter((v): v is string => !!v))];
  const removers = removerIds.length
    ? new Map((await prisma.user.findMany({ where: { id: { in: removerIds } }, select: { id: true, username: true } })).map((u) => [u.id, u.username]))
    : new Map<string, string>();

  return (
    <div>
      <PageHeader title="Reviews" subtitle="Removed reviews are hidden from profiles and left out of rating averages." />
      <FilterBar
        action="/admin/reviews"
        selects={[
          {
            name: "show",
            label: "Show",
            value: filter ?? "",
            options: [
              { value: "", label: "All reviews" },
              { value: "reported", label: "Reported" },
              { value: "removed", label: "Removed" },
              { value: "visible", label: "Visible" },
            ],
          },
        ]}
      />
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon="heart">No reviews match.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["People", "Review", "Status", "Actions"]}>
            {rows.map((r) => (
              <Row key={r.id} cols={COLS}>
                <Cell label="People">
                  <span className="block text-xs">
                    <UserLink username={r.reviewer.username} />
                    <span className="text-muted"> reviewed </span>
                    <UserLink username={r.reviewee.username} />
                  </span>
                  <span className="block text-[11px] text-muted">
                    {r.transaction.listing.book.title} · {fmtDate(r.createdAt)}
                  </span>
                </Cell>
                <Cell label="Review">
                  <span aria-label={`${r.rating} out of 5`} className="text-accent">
                    {"★".repeat(r.rating)}
                    {"☆".repeat(Math.max(0, 5 - r.rating))}
                  </span>
                  {r.comment ? <p className="mt-0.5 line-clamp-4 whitespace-pre-line text-sm">{r.comment}</p> : <p className="text-xs text-muted">No comment</p>}
                </Cell>
                <Cell label="Status">
                  <Badge value={r.removedAt ? "REMOVED" : "ACTIVE"} />
                  {r._count.reports > 0 && <span className="block text-[11px] text-danger">{r._count.reports} reports</span>}
                  {r.removedAt && (
                    <span className="block text-[11px] text-muted">
                      {fmtDate(r.removedAt)}
                      {r.removedById && removers.get(r.removedById) ? ` by @${removers.get(r.removedById)}` : ""}
                    </span>
                  )}
                </Cell>
                <Cell label="Actions">
                  {r.removedAt ? (
                    <ActionForm
                      action={adminReviewAction}
                      hidden={{ reviewId: r.id, op: "RESTORE" }}
                      label="Restore"
                      variant="secondary"
                      confirm="Restore this review? It shows on the profile and counts toward the average again."
                    />
                  ) : (
                    <ActionForm
                      action={adminReviewAction}
                      hidden={{ reviewId: r.id, op: "REMOVE" }}
                      label="Remove"
                      variant="danger"
                      confirm="Remove this review?"
                      reason={{ label: "Reason", required: true }}
                    />
                  )}
                </Cell>
              </Row>
            ))}
          </DataList>
        )}
        <Pagination path="/admin/reviews" params={{ show: filter }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
