import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { OPEN_REPORT_STATUSES, PAGE_SIZE, oneOf, pageFrom, reportInclude } from "@/lib/admin";
import { FilterBar, Pagination, enumOptions } from "../_components/kit";
import { ReportCard } from "../_components/report-card";

export const metadata: Metadata = { title: "Reports" };

const STATUSES = ["OPEN", "UNDER_REVIEW", "ESCALATED", "RESOLVED", "DISMISSED"] as const;
const TARGETS = ["USER", "LISTING", "MESSAGE", "REVIEW"] as const;

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminReportsPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  // Default view: everything still open.
  const statusParam = typeof sp.status === "string" ? sp.status : "ACTIVE";
  const status = oneOf(statusParam, STATUSES);
  const target = oneOf(sp.target, TARGETS);
  const page = pageFrom(sp.page);

  const where: Prisma.ReportWhereInput = {
    status: status ? status : statusParam === "ALL" ? undefined : { in: OPEN_REPORT_STATUSES },
    ...(target ? { target } : {}),
  };

  const [total, reports] = await Promise.all([
    prisma.report.count({ where }),
    prisma.report.findMany({
      where,
      // Oldest first; escalations are lifted to the top of each page below.
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: reportInclude,
    }),
  ]);
  reports.sort((a, b) => Number(b.status === "ESCALATED") - Number(a.status === "ESCALATED"));

  return (
    <div>
      <PageHeader title="Reports" subtitle="Oldest first. Escalated reports sit at the top." />
      <FilterBar
        action="/admin/reports"
        selects={[
          {
            name: "status",
            label: "Status",
            value: status ?? (statusParam === "ALL" ? "ALL" : "ACTIVE"),
            options: [
              { value: "ACTIVE", label: "Needs action" },
              { value: "ALL", label: "All" },
              ...enumOptions(STATUSES).slice(1),
            ],
          },
          { name: "target", label: "Target", value: target ?? "", options: enumOptions(TARGETS, "Any target") },
        ]}
      />
      <div className="mt-4 space-y-4">
        {reports.length === 0 ? (
          <EmptyState icon="inbox">No reports here. The neighbourhood is behaving.</EmptyState>
        ) : (
          reports.map((r) => <ReportCard key={r.id} r={r} mode="admin" />)
        )}
        <Pagination
          path="/admin/reports"
          params={{ status: statusParam === "ACTIVE" ? undefined : statusParam, target }}
          page={page}
          total={total}
          pageSize={PAGE_SIZE}
        />
      </div>
    </div>
  );
}
