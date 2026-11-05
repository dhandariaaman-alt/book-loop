// Rendered at the bottom of /transactions/[id]. Shows "Rate this hand-off"
// once the transaction is COMPLETED, both reviews, and "Report a problem"
// (open a dispute) while it's active or recently completed.
// Server component; viewerId is the signed-in user (owner or receiver).

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/app/ui";
import { ReportButton } from "./report-button";
import { DisputeForm, ReviewForm } from "./trust-forms";
import { DISPUTE_STATUS_LABEL, canOpenDispute, disputeKindLabel } from "@/lib/trust-labels";

const DISPUTE_STATUS_TINT: Record<string, string> = {
  OPEN: "bg-butter",
  INVESTIGATING: "bg-sky",
  RESOLVED: "bg-mint",
  CLOSED: "bg-surface-2",
};

function Stars({ rating }: { rating: number }) {
  return (
    <span className="text-accent" aria-label={`${rating} out of 5 stars`}>
      {"★".repeat(rating)}
      <span className="text-border">{"★".repeat(5 - rating)}</span>
    </span>
  );
}

const fmt = (d: Date) => d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export async function TransactionTrust({ transactionId, viewerId }: { transactionId: string; viewerId: string }) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      status: true,
      ownerId: true,
      receiverId: true,
      completedAt: true,
      owner: { select: { id: true, name: true, username: true } },
      receiver: { select: { id: true, name: true, username: true } },
      reviews: {
        where: { removedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          reviewerId: true,
          reviewer: { select: { name: true, username: true } },
        },
      },
      disputes: {
        orderBy: { createdAt: "desc" },
        select: { id: true, kind: true, status: true, description: true, resolution: true, createdAt: true, openedById: true },
      },
    },
  });
  if (!tx) return null;
  const isParty = tx.ownerId === viewerId || tx.receiverId === viewerId;
  if (!isParty) return null;

  const other = tx.ownerId === viewerId ? tx.receiver : tx.owner;
  const otherName = other.name ?? `@${other.username}`;

  // Includes removed reviews so the form doesn't reappear after moderation.
  const alreadyReviewed =
    tx.reviews.some((r) => r.reviewerId === viewerId) ||
    (await prisma.review.count({ where: { transactionId: tx.id, reviewerId: viewerId } })) > 0;
  const canReview = tx.status === "COMPLETED" && !alreadyReviewed;
  const canDispute = canOpenDispute(tx);
  const hasOpenDispute = tx.disputes.some((d) => d.openedById === viewerId && (d.status === "OPEN" || d.status === "INVESTIGATING"));

  return (
    <div className="mt-6 space-y-4">
      {canReview && (
        <Panel title="Rate this hand-off" tint="butter" icon="heart">
          <ReviewForm transactionId={tx.id} otherName={otherName} />
        </Panel>
      )}

      {tx.reviews.length > 0 && (
        <Panel title="Reviews" tint="mint" icon="chat">
          <ul className="space-y-3">
            {tx.reviews.map((r) => (
              <li key={r.id} className="rounded-xl border border-border bg-surface-2/60 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm">
                    <Stars rating={r.rating} /> by{" "}
                    {r.reviewerId === viewerId ? (
                      <span className="font-medium">you</span>
                    ) : (
                      <Link href={`/u/${r.reviewer.username}`} className="text-brand hover:underline">
                        {r.reviewer.name ?? r.reviewer.username}
                      </Link>
                    )}
                    <span className="text-muted"> · {fmt(r.createdAt)}</span>
                  </p>
                  {r.reviewerId !== viewerId && <ReportButton target="REVIEW" targetId={r.id} reportedUserId={r.reviewerId} />}
                </div>
                {r.comment && <p className="font-hand mt-1 break-words text-xl leading-7">{r.comment}</p>}
              </li>
            ))}
          </ul>
        </Panel>
      )}

      {(tx.disputes.length > 0 || canDispute) && (
        <Panel title="Report a problem" tint="rose" icon="inbox">
          {tx.disputes.length > 0 && (
            <ul className="mb-5 space-y-3">
              {tx.disputes.map((d) => (
                <li key={d.id} className="rounded-xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium">
                      {disputeKindLabel(d.kind)}
                      <span className="font-normal text-muted">
                        {" "}
                        · {d.openedById === viewerId ? "reported by you" : `reported by ${otherName}`} on {fmt(d.createdAt)}
                      </span>
                    </p>
                    <span className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${DISPUTE_STATUS_TINT[d.status]}`}>
                      {DISPUTE_STATUS_LABEL[d.status]}
                    </span>
                  </div>
                  <p className="mt-2 whitespace-pre-line break-words text-sm">{d.description}</p>
                  {d.resolution && (
                    <p className="mt-3 rounded-lg bg-brand-soft px-3 py-2 text-sm">
                      <span className="font-medium text-brand">Resolution: </span>
                      {d.resolution}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canDispute && !hasOpenDispute ? (
            <>
              <p className="mb-4 text-sm text-muted">
                Something didn&apos;t go to plan? Tell us and a BookLoop admin will look into it. {otherName} will be told that a
                problem was reported.
              </p>
              <DisputeForm transactionId={tx.id} />
            </>
          ) : canDispute && hasOpenDispute ? (
            <p className="text-sm text-muted">We&apos;re looking into your report and will keep you posted.</p>
          ) : null}
        </Panel>
      )}
    </div>
  );
}
