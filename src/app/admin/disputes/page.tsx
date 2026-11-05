import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDate, humanize, oneOf, pageFrom } from "@/lib/admin";
import { Badge, Cell, DataList, FilterBar, Pagination, Row, enumOptions } from "../_components/kit";

export const metadata: Metadata = { title: "Disputes" };

const STATUSES = ["OPEN", "INVESTIGATING", "RESOLVED", "CLOSED"] as const;
const KINDS = ["NO_SHOW", "FAILED_HANDOVER", "NOT_RETURNED", "DAMAGED", "OTHER"] as const;
const COLS = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminDisputesPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const status = oneOf(sp.status, STATUSES);
  const kind = oneOf(sp.kind, KINDS);
  const page = pageFrom(sp.page);

  const where: Prisma.DisputeWhereInput = { ...(status ? { status } : {}), ...(kind ? { kind } : {}) };

  const [total, rows] = await Promise.all([
    prisma.dispute.count({ where }),
    prisma.dispute.findMany({
      where,
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        kind: true,
        status: true,
        createdAt: true,
        openedBy: { select: { username: true } },
        transaction: {
          select: {
            type: true,
            listing: { select: { book: { select: { title: true } } } },
            owner: { select: { username: true } },
            receiver: { select: { username: true } },
          },
        },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Disputes" subtitle="Problems with a hand-off, raised by one of the two people involved." />
      <FilterBar
        action="/admin/disputes"
        selects={[
          { name: "status", label: "Status", value: status ?? "", options: enumOptions(STATUSES, "Any status") },
          { name: "kind", label: "Kind", value: kind ?? "", options: enumOptions(KINDS, "Any kind") },
        ]}
      />
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon="swap">No disputes match.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["Book", "People", "Kind", "Status", ""]}>
            {rows.map((d) => (
              <Row key={d.id} cols={COLS}>
                <Cell label="Book">
                  <span className="font-medium">{d.transaction.listing.book.title}</span>
                  <span className="block text-xs text-muted">
                    {humanize(d.transaction.type)} · opened {fmtDate(d.createdAt)}
                  </span>
                </Cell>
                <Cell label="People">
                  <span className="text-xs">
                    @{d.transaction.owner.username} and @{d.transaction.receiver.username}
                  </span>
                  <span className="block text-[11px] text-muted">Raised by @{d.openedBy.username}</span>
                </Cell>
                <Cell label="Kind">
                  <span className="text-xs">{humanize(d.kind)}</span>
                </Cell>
                <Cell label="Status">
                  <Badge value={d.status} />
                </Cell>
                <Cell label="">
                  <Link href={`/admin/disputes/${d.id}`} className="btn-secondary px-3 py-1.5">
                    Open
                  </Link>
                </Cell>
              </Row>
            ))}
          </DataList>
        )}
        <Pagination path="/admin/disputes" params={{ status, kind }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
