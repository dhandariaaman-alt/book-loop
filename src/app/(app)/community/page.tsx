import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { blockedUserIds } from "@/lib/blocks";
import { Reveal } from "@/components/landing/reveal";
import { EmptyState, PageHeader, Panel, SoonBadge } from "@/components/app/ui";
import { CancelPledgeButton, PledgeForm } from "@/components/trust/pledge-form";
import { DONATION_STATUS_LABEL, DONATION_STATUS_TINT, handoverLabel } from "@/lib/trust-labels";

export const metadata: Metadata = { title: "Community" };

const TYPE_LABEL: Record<string, string> = {
  LIBRARY: "Library",
  COMMUNITY_CENTRE: "Community centre",
  SCHOOL: "School",
  OTHER: "Organisation",
};

export default async function CommunityPage() {
  const me = await requireUser();
  const hidden = await blockedUserIds(me.id);

  const [requests, institutions, myPledges] = await Promise.all([
    prisma.donationRequest.findMany({
      where: {
        status: "OPEN",
        institution: { verificationStatus: "VERIFIED", userId: { notIn: hidden } },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        title: true,
        description: true,
        booksWanted: true,
        quantityGoal: true,
        dropOffInfo: true,
        institution: { select: { name: true, userId: true, publicAddress: true, neighbourhood: true } },
        genres: { select: { id: true, name: true } },
        donations: { where: { status: "RECEIVED" }, select: { quantity: true } },
      },
    }),
    prisma.institution.findMany({
      where: { verificationStatus: "VERIFIED" },
      orderBy: { name: "asc" },
      take: 6,
      select: { id: true, name: true, type: true, neighbourhood: true },
    }),
    prisma.donation.findMany({
      where: { donorId: me.id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        description: true,
        quantity: true,
        status: true,
        handoverMethod: true,
        scheduledAt: true,
        donationRequest: { select: { title: true, dropOffInfo: true, institution: { select: { name: true, publicAddress: true } } } },
      },
    }),
  ]);

  return (
    <div className="min-w-0">
      <Reveal>
        <PageHeader
          title="Community"
          note="share the shelf ✶"
          subtitle="Libraries, community centres and neighbours swapping books."
        />
      </Reveal>

      <Reveal delay={60}>
        <div className="mt-6">
          <Panel title="Donation requests" tint="rose" icon="heart">
            {requests.length === 0 ? (
              <EmptyState icon="heart">No libraries or community centres are asking for books right now.</EmptyState>
            ) : (
              <ul className="grid gap-4 sm:grid-cols-2">
                {requests.map((r, i) => (
                  <li
                    key={r.id}
                    className={`relative min-w-0 rounded-md border border-border bg-[#fffaf0] p-4 pt-6 shadow-sm ${
                      i % 2 ? "sm:rotate-[0.5deg]" : "sm:-rotate-[0.5deg]"
                    }`}
                  >
                    <span
                      className="absolute left-1/2 top-2 h-3 w-3 -translate-x-1/2 rounded-full border border-border bg-accent"
                      aria-hidden="true"
                    />
                    <p className="text-xs text-muted">{r.institution.name}</p>
                    <h4 className="heading mt-0.5 break-words font-semibold">{r.title}</h4>
                    {r.description && <p className="mt-2 line-clamp-3 break-words text-sm text-muted">{r.description}</p>}
                    {r.booksWanted && <p className="mt-2 break-words text-sm">Wanted: {r.booksWanted}</p>}
                    {r.quantityGoal != null && (
                      <p className="mt-1 text-sm text-muted">
                        Goal: {r.quantityGoal} books · {r.donations.reduce((n, d) => n + d.quantity, 0)} received so far
                      </p>
                    )}
                    {(r.dropOffInfo || r.institution.publicAddress) && (
                      <p className="mt-1 break-words text-xs text-muted">
                        Drop-off: {[r.institution.publicAddress, r.dropOffInfo].filter(Boolean).join(". ")}
                      </p>
                    )}
                    {r.genres.length > 0 && (
                      <ul className="mt-3 flex flex-wrap gap-1.5">
                        {r.genres.map((g) => (
                          <li key={g.id} className="rounded-full border border-border bg-mint px-2.5 py-0.5 text-xs">
                            {g.name}
                          </li>
                        ))}
                      </ul>
                    )}
                    {r.institution.userId !== me.id && <PledgeForm requestId={r.id} />}
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Reveal>

      {myPledges.length > 0 && (
        <Reveal delay={70}>
          <div className="mt-4">
            <Panel title="My pledges" tint="mint" icon="leaf">
              <ul className="divide-y divide-border">
                {myPledges.map((d) => (
                  <li key={d.id} className="flex flex-wrap items-start justify-between gap-2 py-3">
                    <div className="min-w-0">
                      <p className="break-words text-sm">
                        <span className="font-medium">
                          {d.quantity} {d.quantity === 1 ? "book" : "books"}
                        </span>{" "}
                        for {d.donationRequest.institution.name}: {d.donationRequest.title}
                      </p>
                      <p className="break-words text-xs text-muted">
                        {d.description} · {handoverLabel(d.handoverMethod)}
                      </p>
                      {d.status === "SCHEDULED" && d.scheduledAt && (
                        <p className="mt-1 break-words text-xs">
                          Drop-off on{" "}
                          {d.scheduledAt.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          {d.donationRequest.institution.publicAddress && ` at ${d.donationRequest.institution.publicAddress}`}
                        </p>
                      )}
                      {(d.status === "PLEDGED" || d.status === "SCHEDULED") && (
                        <div className="mt-1">
                          <CancelPledgeButton donationId={d.id} />
                        </div>
                      )}
                    </div>
                    <span className={`shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs ${DONATION_STATUS_TINT[d.status]}`}>
                      {DONATION_STATUS_LABEL[d.status]}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          </div>
        </Reveal>
      )}

      <Reveal delay={80}>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <Panel title="Exchange opportunities" tint="butter" icon="swap" action={<SoonBadge phase={2} />}>
            <EmptyState icon="swap">Exchange listings near you will appear here.</EmptyState>
          </Panel>
          <Panel title="Institutions near you" tint="sky" icon="home">
            {institutions.length === 0 ? (
              <EmptyState icon="home">No verified libraries or community centres nearby yet.</EmptyState>
            ) : (
              <ul className="divide-y divide-border">
                {institutions.map((s) => (
                  <li key={s.id} className="py-2.5">
                    <p className="break-words text-sm font-medium">{s.name}</p>
                    <p className="text-xs text-muted">
                      {TYPE_LABEL[s.type] ?? "Organisation"}
                      {s.neighbourhood ? ` · ${s.neighbourhood}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </Reveal>

      <Reveal delay={80}>
        <div className="card mt-4 flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="min-w-0">
            <h3 className="heading font-semibold">Are you a library or community centre?</h3>
            <p className="mt-1 text-sm text-muted">
              Institutional accounts are verified by BookLoop admins before they can post donation requests.
            </p>
          </div>
          <Link href="/settings/institution" className="btn-secondary">
            Register your institution
          </Link>
        </div>
      </Reveal>
    </div>
  );
}
