import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { REQUEST_STATUS_LABEL } from "@/lib/trust-labels";
import { getInstitutionAccess } from "../access";
import { DonationProgress, tally } from "../progress";

export const metadata: Metadata = { title: "Donation requests" };

const STATUS_TINT = { OPEN: "bg-mint", FULFILLED: "bg-sky", CLOSED: "bg-surface-2" } as const;

export default async function InstitutionRequestsPage() {
  const access = await getInstitutionAccess();
  if (!access) return null;

  const requests = await prisma.donationRequest.findMany({
    where: { institutionId: access.institution.id },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      quantityGoal: true,
      createdAt: true,
      genres: { select: { id: true, name: true } },
      donations: { select: { status: true, quantity: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Donation requests"
        subtitle="Publish what you need. Neighbours see open requests on the Community page."
        actions={
          <Link href="/institution/requests/new" className="btn-primary">
            New request
          </Link>
        }
      />
      {requests.length === 0 ? (
        <EmptyState icon="heart">You haven&apos;t published any requests yet.</EmptyState>
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => {
            const t = tally(r.donations);
            const pledges = r.donations.filter((d) => d.status === "PLEDGED" || d.status === "SCHEDULED").length;
            return (
              <li key={r.id}>
                <Link href={`/institution/requests/${r.id}`} className="card card-hover block p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="heading break-words text-lg font-semibold">{r.title}</h2>
                      <p className="text-xs text-muted">
                        Posted {r.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                        {pledges > 0 && ` · ${pledges} active ${pledges === 1 ? "pledge" : "pledges"}`}
                      </p>
                    </div>
                    <span className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${STATUS_TINT[r.status]}`}>
                      {REQUEST_STATUS_LABEL[r.status]}
                    </span>
                  </div>
                  {r.genres.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-1.5">
                      {r.genres.map((g) => (
                        <li key={g.id} className="rounded-full border border-border bg-surface-2 px-2 py-0.5 text-xs">
                          {g.name}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-3">
                    <DonationProgress received={t.received} pledged={t.pledged} goal={r.quantityGoal} />
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
