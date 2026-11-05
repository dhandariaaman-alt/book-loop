import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { assignCommunityAction, changeRoleAction, createCommunityAction, promoteModeratorAction } from "@/app/actions/admin";
import { ActionForm } from "../_components/action-form";
import { SelectField, UserLink } from "../_components/kit";

export const metadata: Metadata = { title: "Moderators" };

function Field({ name, label, type = "text", placeholder, step, required = true }: { name: string; label: string; type?: string; placeholder?: string; step?: string; required?: boolean }) {
  return (
    <label className="block min-w-0 text-xs">
      <span className="label text-xs">{label}</span>
      <input name={name} type={type} step={step} placeholder={placeholder} required={required} className="input" />
    </label>
  );
}

export default async function AdminModeratorsPage() {
  await requireRole(["ADMIN"]);

  const [moderators, communities] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MODERATOR" },
      orderBy: { username: "asc" },
      select: {
        id: true,
        username: true,
        name: true,
        status: true,
        moderatedCommunities: { select: { id: true, name: true, city: true }, orderBy: { name: "asc" } },
      },
    }),
    prisma.community.findMany({
      orderBy: [{ city: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        city: true,
        radiusKm: true,
        _count: { select: { members: true, listings: true, moderators: true } },
      },
    }),
  ]);

  const communityLabel = (c: { name: string; city: string | null }) => (c.city ? `${c.name}, ${c.city}` : c.name);

  return (
    <div>
      <PageHeader title="Moderators" subtitle="Community moderators handle reports in their neighbourhoods and escalate to admins." />

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="Promote a user" tint="mint" icon="user">
            <ActionForm action={promoteModeratorAction} label="Make moderator" variant="primary" alwaysOpen>
              <Field name="username" label="Username" placeholder="@username" />
            </ActionForm>
          </Panel>

          <Panel title={`Moderators (${moderators.length})`} tint="sky" icon="heart">
            {moderators.length === 0 ? (
              <EmptyState icon="user">No moderators yet. Promote someone trusted above.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {moderators.map((m) => {
                  const assigned = new Set(m.moderatedCommunities.map((c) => c.id));
                  const available = communities.filter((c) => !assigned.has(c.id));
                  return (
                    <li key={m.id} className="py-4 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <UserLink username={m.username} name={m.name} />
                          {m.status !== "ACTIVE" && <span className="ml-2 text-xs text-danger">{m.status.toLowerCase()}</span>}
                        </div>
                        <ActionForm
                          action={changeRoleAction}
                          hidden={{ userId: m.id, role: "USER" }}
                          label="Remove moderator role"
                          variant="danger"
                          confirm={`Make @${m.username} a regular user? They are unassigned from all communities.`}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-start gap-2">
                        {m.moderatedCommunities.length === 0 && <span className="text-xs text-muted">No communities. They see unassigned reports.</span>}
                        {m.moderatedCommunities.map((c) => (
                          <div key={c.id} className="flex items-start gap-1 rounded-xl border border-border bg-mint px-2 py-1 text-xs">
                            <span className="py-1.5">{communityLabel(c)}</span>
                            <ActionForm
                              action={assignCommunityAction}
                              hidden={{ userId: m.id, communityId: c.id, op: "UNASSIGN" }}
                              label="Unassign"
                              variant="ghost"
                              confirm={`Unassign @${m.username} from ${c.name}?`}
                            />
                          </div>
                        ))}
                      </div>
                      {available.length > 0 && (
                        <div className="mt-2">
                          <ActionForm
                            action={assignCommunityAction}
                            hidden={{ userId: m.id, op: "ASSIGN" }}
                            label="Assign community"
                            variant="secondary"
                            submitLabel="Assign"
                          >
                            <SelectField
                              name="communityId"
                              label="Community"
                              options={available.map((c) => ({ value: c.id, label: communityLabel(c) }))}
                            />
                          </ActionForm>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="New community" tint="butter" icon="pin">
            <ActionForm action={createCommunityAction} label="Create community" variant="primary" alwaysOpen>
              <Field name="name" label="Name" placeholder="Indiranagar" />
              <Field name="city" label="City" placeholder="Bengaluru" required={false} />
              <div className="grid grid-cols-2 gap-2">
                <Field name="centerLat" label="Centre latitude" type="number" step="any" placeholder="12.9719" />
                <Field name="centerLng" label="Centre longitude" type="number" step="any" placeholder="77.6412" />
              </div>
              <Field name="radiusKm" label="Radius (km)" type="number" step="0.5" placeholder="3" />
              <p className="text-[11px] text-muted">Use the approximate centre of the neighbourhood, never someone&apos;s home.</p>
            </ActionForm>
          </Panel>

          <Panel title={`Communities (${communities.length})`} tint="lavender" icon="home">
            {communities.length === 0 ? (
              <EmptyState icon="pin">No communities yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-border text-sm">
                {communities.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-2">
                    <span className="font-medium">{communityLabel(c)}</span>
                    <span className="text-xs text-muted">
                      {c.radiusKm} km · {c._count.members} members · {c._count.listings} listings ·{" "}
                      <span className={c._count.moderators === 0 ? "text-danger" : ""}>{c._count.moderators} mods</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
