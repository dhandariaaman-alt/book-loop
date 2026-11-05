import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDate, humanize, oneOf, pageFrom } from "@/lib/admin";
import { reviewInstitutionAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";
import { Badge, Cell, DataList, FilterBar, Pagination, Row, UserLink, enumOptions } from "../_components/kit";

export const metadata: Metadata = { title: "Institutions" };

const STATUSES = ["PENDING", "VERIFIED", "REJECTED"] as const;
const COLS = "md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,1.8fr)]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminInstitutionsPage({ searchParams }: { searchParams: SP }) {
  await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const status = oneOf(sp.status, STATUSES);
  const page = pageFrom(sp.page);
  const where = status ? { verificationStatus: status } : {};

  const [total, rows] = await Promise.all([
    prisma.institution.count({ where }),
    prisma.institution.findMany({
      where,
      // Enum order puts PENDING first.
      orderBy: [{ verificationStatus: "asc" }, { createdAt: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        type: true,
        description: true,
        publicAddress: true,
        neighbourhood: true,
        website: true,
        verificationStatus: true,
        verifiedAt: true,
        createdAt: true,
        user: { select: { username: true, name: true, email: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Institutions" subtitle="Verify libraries, schools and community centres before they ask for donations." />
      <FilterBar
        action="/admin/institutions"
        selects={[{ name: "status", label: "Status", value: status ?? "", options: enumOptions(STATUSES, "All, pending first") }]}
      />
      <div className="mt-4">
        {rows.length === 0 ? (
          <EmptyState icon="home">No institutions here.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["Institution", "Account", "Status", "Actions"]}>
            {rows.map((i) => (
              <Row key={i.id} cols={COLS}>
                <Cell label="Institution">
                  <span className="font-medium">{i.name}</span>
                  <span className="block text-xs text-muted">
                    {humanize(i.type)}
                    {i.neighbourhood ? ` · ${i.neighbourhood}` : ""}
                  </span>
                  {i.publicAddress && <span className="block text-xs text-muted">{i.publicAddress}</span>}
                  {i.website && /^https?:\/\//i.test(i.website) && (
                    <a href={i.website} target="_blank" rel="noopener noreferrer nofollow" className="block truncate text-xs text-brand hover:underline">
                      {i.website}
                    </a>
                  )}
                  {i.description && <p className="mt-1 line-clamp-3 text-xs">{i.description}</p>}
                </Cell>
                <Cell label="Account">
                  <UserLink username={i.user.username} name={i.user.name} />
                  <span className="block truncate text-xs text-muted">{i.user.email}</span>
                  <span className="block text-[11px] text-muted">Applied {fmtDate(i.createdAt)}</span>
                </Cell>
                <Cell label="Status">
                  <Badge value={i.verificationStatus} />
                  {i.verifiedAt && <span className="block text-[11px] text-muted">{fmtDate(i.verifiedAt)}</span>}
                </Cell>
                <Cell label="Actions">
                  <div className="flex flex-wrap items-start gap-1.5">
                    {i.verificationStatus !== "VERIFIED" && (
                      <ActionForm
                        action={reviewInstitutionAction}
                        hidden={{ institutionId: i.id, decision: "VERIFY" }}
                        label="Verify"
                        variant="primary"
                        confirm={`Verify ${i.name}? The account becomes an institution account and can post donation requests.`}
                      />
                    )}
                    {i.verificationStatus !== "REJECTED" && (
                      <ActionForm
                        action={reviewInstitutionAction}
                        hidden={{ institutionId: i.id, decision: "REJECT" }}
                        label={i.verificationStatus === "VERIFIED" ? "Revoke" : "Reject"}
                        variant="danger"
                        confirm={`Reject ${i.name}?`}
                        reason={{ label: "Reason (sent to the institution)", required: true }}
                      />
                    )}
                  </div>
                </Cell>
              </Row>
            ))}
          </DataList>
        )}
        <Pagination path="/admin/institutions" params={{ status }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
