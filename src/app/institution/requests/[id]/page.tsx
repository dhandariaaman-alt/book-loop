import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { DONATION_STATUS_LABEL, DONATION_STATUS_TINT, REQUEST_STATUS_LABEL, handoverLabel } from "@/lib/trust-labels";
import { getInstitutionAccess } from "../../access";
import { DonationRequestForm, DonationStatusForm, RequestStatusButtons } from "../../forms";
import { DonationProgress, tally } from "../../progress";

export const metadata: Metadata = { title: "Donation request" };

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const fmtTime = (d: Date) => d.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

export default async function DonationRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const access = await getInstitutionAccess();
  if (!access) return null;
  const { id } = await params;

  const [req, genres] = await Promise.all([
    prisma.donationRequest.findUnique({
      where: { id },
      select: {
        id: true,
        institutionId: true,
        title: true,
        description: true,
        booksWanted: true,
        quantityGoal: true,
        dropOffInfo: true,
        status: true,
        createdAt: true,
        genres: { select: { id: true } },
        donations: {
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            description: true,
            quantity: true,
            status: true,
            handoverMethod: true,
            scheduledAt: true,
            receivedAt: true,
            createdAt: true,
            donor: { select: { name: true, username: true } },
          },
        },
      },
    }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!req || req.institutionId !== access.institution.id) notFound();

  const t = tally(req.donations);
  const active = req.donations.filter((d) => d.status === "PLEDGED" || d.status === "SCHEDULED");
  const done = req.donations.filter((d) => d.status === "RECEIVED" || d.status === "CANCELLED");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/institution/requests" className="text-sm text-brand hover:underline">
          ← All requests
        </Link>
        <div className="mt-2">
          <PageHeader title={req.title} subtitle={`${REQUEST_STATUS_LABEL[req.status]} · posted ${fmt(req.createdAt)}`} />
        </div>
      </div>

      <section className="card space-y-4 p-5">
        <DonationProgress received={t.received} pledged={t.pledged} goal={req.quantityGoal} />
        <RequestStatusButtons requestId={req.id} status={req.status} />
      </section>

      <Panel title={`Incoming donations (${active.length})`} tint="butter" icon="inbox">
        {active.length === 0 ? (
          <EmptyState icon="inbox">No active pledges right now.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {active.map((d) => (
              <DonationRow key={d.id} d={d} />
            ))}
          </ul>
        )}
      </Panel>

      {done.length > 0 && (
        <Panel title="Received and cancelled" tint="mint" icon="book">
          <ul className="space-y-3">
            {done.map((d) => (
              <DonationRow key={d.id} d={d} />
            ))}
          </ul>
        </Panel>
      )}

      <Panel title="Edit request" tint="sky" icon="book">
        <DonationRequestForm
          genres={genres}
          initial={{
            id: req.id,
            title: req.title,
            description: req.description ?? "",
            booksWanted: req.booksWanted ?? "",
            quantityGoal: req.quantityGoal,
            dropOffInfo: req.dropOffInfo ?? "",
            genreIds: req.genres.map((g) => g.id),
          }}
        />
      </Panel>
    </div>
  );
}

type Row = {
  id: string;
  description: string;
  quantity: number;
  status: "PLEDGED" | "SCHEDULED" | "RECEIVED" | "CANCELLED";
  handoverMethod: "PUBLIC_PLACE" | "INSTITUTION_POINT" | "SELF_ARRANGED_DELIVERY" | "OTHER";
  scheduledAt: Date | null;
  receivedAt: Date | null;
  createdAt: Date;
  donor: { name: string | null; username: string };
};

function DonationRow({ d }: { d: Row }) {
  return (
    <li className="rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm">
            <Link href={`/u/${d.donor.username}`} className="font-medium text-brand hover:underline">
              {d.donor.name ?? `@${d.donor.username}`}
            </Link>{" "}
            · {d.quantity} {d.quantity === 1 ? "book" : "books"}
          </p>
          <p className="mt-1 whitespace-pre-line break-words text-sm">{d.description}</p>
          <p className="mt-1 text-xs text-muted">
            {handoverLabel(d.handoverMethod)} · pledged {fmt(d.createdAt)}
            {d.scheduledAt && d.status === "SCHEDULED" && ` · drop-off ${fmtTime(d.scheduledAt)}`}
            {d.receivedAt && d.status === "RECEIVED" && ` · received ${fmt(d.receivedAt)}`}
          </p>
        </div>
        <span className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${DONATION_STATUS_TINT[d.status]}`}>
          {DONATION_STATUS_LABEL[d.status]}
        </span>
      </div>
      <DonationStatusForm donationId={d.id} status={d.status} />
    </li>
  );
}
