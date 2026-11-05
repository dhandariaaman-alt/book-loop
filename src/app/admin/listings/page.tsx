import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDate, humanize, oneOf, pageFrom, str } from "@/lib/admin";
import { adminRemoveListingAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";
import { Badge, Cell, DataList, FilterBar, Pagination, Row, UserLink, enumOptions } from "../_components/kit";

export const metadata: Metadata = { title: "Listings" };

const STATUSES = ["AVAILABLE", "REQUEST_PENDING", "RESERVED", "HANDED_OVER", "COMPLETED", "UNAVAILABLE", "REMOVED"] as const;
const COLS = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.4fr)]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminListingsPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const q = str(sp.q);
  const status = oneOf(sp.status, STATUSES);
  const page = pageFrom(sp.page);

  const where: Prisma.BookListingWhereInput = {
    ...(status ? { status } : {}),
    ...(q ? { book: { title: { contains: q, mode: "insensitive" } } } : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.bookListing.count({ where }),
    prisma.bookListing.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        type: true,
        status: true,
        neighbourhood: true,
        createdAt: true,
        removedAt: true,
        book: { select: { title: true, author: true } },
        owner: { select: { username: true, name: true } },
        community: { select: { name: true } },
        _count: { select: { reports: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Listings" subtitle="Find listings and remove ones that break the rules." />
      <FilterBar
        action="/admin/listings"
        search={{ name: "q", value: q, label: "Book title", placeholder: "Search by title" }}
        selects={[{ name: "status", label: "Status", value: status ?? "", options: enumOptions(STATUSES, "Any status") }]}
      />
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState>No listings match.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["Book", "Owner", "Status", "Listed", "Actions"]}>
            {rows.map((l) => (
              <Row key={l.id} cols={COLS}>
                <Cell label="Book">
                  <Link href={`/books/${l.id}`} className="font-medium text-brand hover:underline">
                    {l.book.title}
                  </Link>
                  <span className="block text-xs text-muted">
                    {l.book.author} · {humanize(l.type)}
                  </span>
                  <span className="block text-[11px] text-muted">
                    {[l.neighbourhood, l.community?.name].filter(Boolean).join(" · ")}
                    {l._count.reports > 0 && <span className="ml-1 text-danger">{l._count.reports} reports</span>}
                  </span>
                </Cell>
                <Cell label="Owner">
                  <UserLink username={l.owner.username} name={l.owner.name} />
                </Cell>
                <Cell label="Status">
                  <Badge value={l.status} />
                </Cell>
                <Cell label="Listed">
                  <span className="text-xs">{fmtDate(l.createdAt)}</span>
                  {l.removedAt && <span className="block text-[11px] text-danger">Removed {fmtDate(l.removedAt)}</span>}
                </Cell>
                <Cell label="Actions">
                  {l.status === "REMOVED" ? (
                    <span className="text-xs text-muted">Removed</span>
                  ) : (
                    <ActionForm
                      action={adminRemoveListingAction}
                      hidden={{ listingId: l.id }}
                      label="Remove listing"
                      variant="danger"
                      confirm={`Remove "${l.book.title}"? It disappears from Discover and the owner is notified.`}
                      reason={{ label: "Reason (sent to the owner)", required: true }}
                    />
                  )}
                </Cell>
              </Row>
            ))}
          </DataList>
        )}
        <Pagination path="/admin/listings" params={{ q, status }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
