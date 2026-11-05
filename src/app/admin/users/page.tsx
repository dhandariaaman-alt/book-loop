import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { PAGE_SIZE, fmtDate, oneOf, pageFrom, str } from "@/lib/admin";
import { changeRoleAction, setUserStatusAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";
import { Badge, Cell, DataList, FilterBar, Pagination, Row, SelectField, UserLink, enumOptions } from "../_components/kit";

export const metadata: Metadata = { title: "Users" };

const ROLES = ["USER", "INSTITUTION", "MODERATOR", "ADMIN"] as const;
const STATUSES = ["ACTIVE", "SUSPENDED", "BANNED"] as const;
const COLS = "md:grid-cols-[minmax(0,2.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_minmax(0,2.4fr)]";

type SP = Promise<Record<string, string | string[] | undefined>>;

export default async function AdminUsersPage({ searchParams }: { searchParams: SP }) {
  const me = await requireRole(["ADMIN"]);
  const sp = await searchParams;
  const q = str(sp.q);
  const role = oneOf(sp.role, ROLES);
  const status = oneOf(sp.status, STATUSES);
  const page = pageFrom(sp.page);

  const where: Prisma.UserWhereInput = {
    ...(role ? { role } : {}),
    ...(status ? { status } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q.replace(/^@/, ""), mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        _count: { select: { listings: true, reportsAgainst: true } },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader title="Users" subtitle="Search people, change roles and handle suspensions." />
      <FilterBar
        action="/admin/users"
        search={{ name: "q", value: q, label: "Search", placeholder: "Name, username or email" }}
        selects={[
          { name: "role", label: "Role", value: role ?? "", options: enumOptions(ROLES, "Any role") },
          { name: "status", label: "Status", value: status ?? "", options: enumOptions(STATUSES, "Any status") },
        ]}
      />

      <div className="mt-4">
        {users.length === 0 ? (
          <EmptyState icon="user">No users match those filters.</EmptyState>
        ) : (
          <DataList cols={COLS} headers={["User", "Role", "Status", "Joined", "Actions"]}>
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <Row key={u.id} cols={COLS}>
                  <Cell label="User">
                    <UserLink username={u.username} name={u.name} />
                    <span className="block truncate text-xs text-muted">{u.email}</span>
                    <span className="block text-[11px] text-muted">
                      {u._count.listings} listings · {u._count.reportsAgainst} reports against
                    </span>
                  </Cell>
                  <Cell label="Role">
                    <Badge value={u.role} />
                  </Cell>
                  <Cell label="Status">
                    <Badge value={u.status} />
                  </Cell>
                  <Cell label="Joined">
                    <span className="text-xs">{fmtDate(u.createdAt)}</span>
                  </Cell>
                  <Cell label="Actions">
                    {self ? (
                      <span className="text-xs text-muted">This is you.</span>
                    ) : (
                      <div className="flex flex-wrap items-start gap-1.5">
                        <ActionForm
                          action={changeRoleAction}
                          hidden={{ userId: u.id }}
                          label="Change role"
                          variant="secondary"
                          confirm={`Change @${u.username}'s role?`}
                          submitLabel="Save role"
                        >
                          <SelectField
                            name="role"
                            label="New role"
                            defaultValue={u.role === "INSTITUTION" ? "USER" : u.role}
                            options={[
                              { value: "USER", label: "User" },
                              { value: "MODERATOR", label: "Moderator" },
                              { value: "ADMIN", label: "Admin" },
                            ]}
                          />
                        </ActionForm>
                        {u.status === "ACTIVE" ? (
                          <>
                            <ActionForm
                              action={setUserStatusAction}
                              hidden={{ userId: u.id, status: "SUSPENDED" }}
                              label="Suspend"
                              variant="danger"
                              confirm={`Suspend @${u.username}? They are signed out and can't sign in until reactivated.`}
                              reason={{ label: "Reason (sent to the user)", required: true }}
                            />
                            <ActionForm
                              action={setUserStatusAction}
                              hidden={{ userId: u.id, status: "BANNED" }}
                              label="Ban"
                              variant="danger"
                              confirm={`Ban @${u.username}? This is for serious or repeated abuse.`}
                              reason={{ label: "Reason (sent to the user)", required: true }}
                            />
                          </>
                        ) : (
                          <ActionForm
                            action={setUserStatusAction}
                            hidden={{ userId: u.id, status: "ACTIVE" }}
                            label="Reactivate"
                            variant="primary"
                            confirm={`Reactivate @${u.username}?`}
                            reason={{ label: "Reason (sent to the user)", required: true }}
                          />
                        )}
                      </div>
                    )}
                  </Cell>
                </Row>
              );
            })}
          </DataList>
        )}
        <Pagination path="/admin/users" params={{ q, role, status }} page={page} total={total} pageSize={PAGE_SIZE} />
      </div>
    </div>
  );
}
