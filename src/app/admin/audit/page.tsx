import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDateTime, pageFrom, str } from "@/lib/admin";
import { Cell, DataList, FilterBar, Pagination, Row } from "../_components/kit";

export const metadata: Metadata = { title: "Audit log" };

const COLS = "md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_minmax(0,2fr)]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminAuditPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const action = str(sp.action);
  const actor = str(sp.actor).replace(/^@/, "");
  const page = pageFrom(sp.page);

  const where: Prisma.AuditLogWhereInput = {
    ...(action ? { action } : {}),
    ...(actor ? { actor: { username: { contains: actor, mode: "insensitive" } } } : {}),
  };

  const [actions, total, rows] = await Promise.all([
    prisma.auditLog.groupBy({ by: ["action"], orderBy: { action: "asc" } }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        metadata: true,
        createdAt: true,
        actor: { select: { username: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Audit log" subtitle="Append-only record of sensitive actions, newest first." />
      <FilterBar
        action="/admin/audit"
        search={{ name: "actor", value: actor, label: "Actor username", placeholder: "username" }}
        selects={[
          {
            name: "action",
            label: "Action",
            value: action,
            options: [{ value: "", label: "Any action" }, ...actions.map((a) => ({ value: a.action, label: a.action }))],
          },
        ]}
      />
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon="clock">Nothing logged with those filters.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["Time", "Actor", "Action", "Entity", "Details"]}>
            {rows.map((r) => (
              <Row key={r.id} cols={COLS}>
                <Cell label="Time">
                  <time dateTime={r.createdAt.toISOString()} className="text-xs">
                    {fmtDateTime(r.createdAt)}
                  </time>
                </Cell>
                <Cell label="Actor">
                  <span className="text-xs">{r.actor ? `@${r.actor.username}` : "System"}</span>
                </Cell>
                <Cell label="Action">
                  <code className="break-all rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[11px]">{r.action}</code>
                </Cell>
                <Cell label="Entity">
                  {r.entityType ? (
                    <span className="text-xs">
                      {r.entityType}
                      {r.entityId && <span className="block break-all font-mono text-[10px] text-muted">{r.entityId}</span>}
                    </span>
                  ) : (
                    <span className="text-xs text-muted">None</span>
                  )}
                </Cell>
                <Cell label="Details">
                  {r.metadata == null ? (
                    <span className="text-xs text-muted">None</span>
                  ) : (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-brand">Show metadata</summary>
                      <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap break-all rounded-lg bg-surface-2/70 p-2 font-mono text-[11px]">
                        {JSON.stringify(r.metadata, null, 2)}
                      </pre>
                    </details>
                  )}
                </Cell>
              </Row>
            ))}
          </DataList>
        )}
        <Pagination path="/admin/audit" params={{ action: action || undefined, actor: actor || undefined }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
