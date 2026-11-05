import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Panel, StatTile } from "@/components/app/ui";
import { DONATION_STATUS_LABEL, DONATION_STATUS_TINT, REQUEST_STATUS_LABEL } from "@/lib/trust-labels";
import { getInstitutionAccess } from "./access";
import { DonationProgress, tally } from "./progress";

export const metadata: Metadata = { title: "Overview" };

export default async function InstitutionOverviewPage() {
  const access = await getInstitutionAccess();
  if (!access) return null; // the layout shows the notice
  const instId = access.institution.id;

  const [requests, recent] = await Promise.all([
    prisma.donationRequest.findMany({
      where: { institutionId: instId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        title: true,
        status: true,
        quantityGoal: true,
        donations: { select: { status: true, quantity: true } },
      },
    }),
    prisma.donation.findMany({
      where: { donationRequest: { institutionId: instId } },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: {
        id: true,
        quantity: true,
        status: true,
        description: true,
        createdAt: true,
        donor: { select: { name: true, username: true } },
        donationRequest: { select: { id: true, title: true } },
      },
    }),
  ]);

  const all = requests.flatMap((r) => r.donations);
  const totals = tally(all);
  const scheduled = all.filter((d) => d.status === "SCHEDULED").length;
  const open = requests.filter((r) => r.status === "OPEN");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        subtitle="Your donation requests and the books on their way."
        actions={
          <Link href="/institution/requests/new" className="btn-primary">
            New request
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Open requests" value={open.length} tint="sky" />
        <StatTile label="Books pledged" value={totals.pledged} tint="butter" />
        <StatTile label="Drop-offs scheduled" value={scheduled} tint="lavender" />
        <StatTile label="Books received" value={totals.received} tint="mint" />
      </div>

      <Panel
        title="Donation requests"
        tint="rose"
        icon="heart"
        action={
          <Link href="/institution/requests" className="text-sm text-brand hover:underline">
            See all
          </Link>
        }
      >
        {requests.length === 0 ? (
          <EmptyState icon="heart">
            No requests yet.{" "}
            <Link href="/institution/requests/new" className="text-brand underline">
              Publish your first one
            </Link>{" "}
            and neighbours can start pledging books.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2">
            {requests.slice(0, 6).map((r) => {
              const t = tally(r.donations);
              return (
                <li key={r.id} className="min-w-0">
                  <Link href={`/institution/requests/${r.id}`} className="card card-hover block h-full p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="heading break-words font-semibold">{r.title}</h3>
                      <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-xs">{REQUEST_STATUS_LABEL[r.status]}</span>
                    </div>
                    <div className="mt-3">
                      <DonationProgress received={t.received} pledged={t.pledged} goal={r.quantityGoal} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>

      <Panel title="Latest pledges" tint="butter" icon="inbox">
        {recent.length === 0 ? (
          <EmptyState icon="inbox">Pledges from neighbours will show up here.</EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {recent.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div className="min-w-0">
                  <p className="break-words text-sm">
                    <span className="font-medium">{d.donor.name ?? `@${d.donor.username}`}</span> pledged {d.quantity}{" "}
                    {d.quantity === 1 ? "book" : "books"} to{" "}
                    <Link href={`/institution/requests/${d.donationRequest.id}`} className="text-brand hover:underline">
                      {d.donationRequest.title}
                    </Link>
                  </p>
                  <p className="truncate text-xs text-muted">{d.description}</p>
                </div>
                <span className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${DONATION_STATUS_TINT[d.status]}`}>
                  {DONATION_STATUS_LABEL[d.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
