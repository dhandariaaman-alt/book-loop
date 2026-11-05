import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { PageHeader, Panel } from "@/components/app/ui";
import { fmtDateTime, humanize } from "@/lib/admin";
import { updateDisputeAction } from "@/app/actions/admin";
import { ActionForm } from "../../_components/action-form";
import { Badge, SelectField, UserLink } from "../../_components/kit";

export const metadata: Metadata = { title: "Dispute" };

export default async function AdminDisputePage({ params }: { params: Promise<{ id: string }> }) {
  await requireRole(["ADMIN"]);
  const { id } = await params;

  const d = await prisma.dispute.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      status: true,
      description: true,
      resolution: true,
      createdAt: true,
      resolvedAt: true,
      openedBy: { select: { username: true } },
      resolvedBy: { select: { username: true } },
      transaction: {
        select: {
          id: true,
          type: true,
          status: true,
          agreedDueDate: true,
          handedOverAt: true,
          returnedAt: true,
          completedAt: true,
          cancelledAt: true,
          createdAt: true,
          listing: { select: { id: true, book: { select: { title: true, author: true } } } },
          owner: { select: { username: true, name: true } },
          receiver: { select: { username: true, name: true } },
          handover: { select: { method: true, placeName: true, scheduledAt: true } },
          _count: { select: { disputes: true } },
        },
      },
    },
  });
  if (!d) notFound();

  const tx = d.transaction;
  const open = d.status === "OPEN" || d.status === "INVESTIGATING";
  const timeline = [
    { label: "Reserved", at: tx.createdAt },
    { label: "Handover scheduled", at: tx.handover?.scheduledAt },
    { label: "Handed over", at: tx.handedOverAt },
    { label: "Due back", at: tx.agreedDueDate },
    { label: "Returned", at: tx.returnedAt },
    { label: "Completed", at: tx.completedAt },
    { label: "Cancelled", at: tx.cancelledAt },
    { label: "Dispute opened", at: d.createdAt },
    { label: "Dispute closed", at: d.resolvedAt },
  ].filter((t): t is { label: string; at: Date } => !!t.at);
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  return (
    <div>
      <Link href="/admin/disputes" className="text-sm text-brand hover:underline">
        Back to disputes
      </Link>
      <div className="mt-2">
        <PageHeader
          title={`${humanize(d.kind)} dispute`}
          subtitle={
            <>
              About <span className="font-medium text-fg">{tx.listing.book.title}</span>, raised by @{d.openedBy.username}
            </>
          }
          actions={<Badge value={d.status} />}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Panel title="What happened" tint="peach" icon="chat">
            <p className="whitespace-pre-line text-sm">{d.description}</p>
            {d.resolution && (
              <div className="mt-4 rounded-xl bg-brand-soft p-3 text-sm">
                <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                  Resolution{d.resolvedBy ? ` by @${d.resolvedBy.username}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-line">{d.resolution}</p>
              </div>
            )}
          </Panel>

          {open && (
            <Panel title="Decide" tint="mint" icon="leaf">
              <p className="text-sm text-muted">Both people are notified of every change, with a link to the transaction.</p>
              <div className="mt-3 flex flex-wrap items-start gap-1.5">
                {d.status === "OPEN" && (
                  <ActionForm action={updateDisputeAction} hidden={{ disputeId: d.id, status: "INVESTIGATING" }} label="Mark investigating" variant="secondary" />
                )}
                <ActionForm
                  action={updateDisputeAction}
                  hidden={{ disputeId: d.id, status: "RESOLVED" }}
                  label="Resolve"
                  variant="primary"
                  confirm="Resolve this dispute?"
                  reason={{ name: "resolution", label: "Resolution (shared with both people)", required: true }}
                >
                  <SelectField
                    name="outcome"
                    label="Transaction"
                    defaultValue="NONE"
                    options={[
                      { value: "NONE", label: `Leave as ${humanize(tx.status).toLowerCase()}` },
                      { value: "COMPLETED", label: "Mark completed" },
                      { value: "CANCELLED", label: "Mark cancelled" },
                    ]}
                  />
                </ActionForm>
                <ActionForm
                  action={updateDisputeAction}
                  hidden={{ disputeId: d.id, status: "CLOSED" }}
                  label="Close without action"
                  variant="danger"
                  confirm="Close this dispute without changing anything?"
                  reason={{ name: "resolution", label: "Reason (shared with both people)", required: true }}
                />
              </div>
            </Panel>
          )}
        </div>

        <Panel title="Transaction" tint="sky" icon="swap">
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 text-sm">
            <dt className="text-muted">Book</dt>
            <dd>
              <Link href={`/books/${tx.listing.id}`} className="font-medium text-brand hover:underline">
                {tx.listing.book.title}
              </Link>
              <span className="block text-xs text-muted">{tx.listing.book.author}</span>
            </dd>
            <dt className="text-muted">Type</dt>
            <dd>{humanize(tx.type)}</dd>
            <dt className="text-muted">Status</dt>
            <dd>
              <Badge value={tx.status} />
            </dd>
            <dt className="text-muted">Owner</dt>
            <dd>
              <UserLink username={tx.owner.username} name={tx.owner.name} />
            </dd>
            <dt className="text-muted">Receiver</dt>
            <dd>
              <UserLink username={tx.receiver.username} name={tx.receiver.name} />
            </dd>
            {tx.handover && (
              <>
                <dt className="text-muted">Handover</dt>
                <dd>
                  {humanize(tx.handover.method)}
                  {tx.handover.placeName ? ` at ${tx.handover.placeName}` : ""}
                </dd>
              </>
            )}
            {tx._count.disputes > 1 && (
              <>
                <dt className="text-muted">Disputes</dt>
                <dd>{tx._count.disputes} on this transaction</dd>
              </>
            )}
          </dl>

          <h4 className="mt-5 font-mono text-[11px] uppercase tracking-wider text-muted">Timeline</h4>
          <ol className="mt-2 space-y-2 border-l border-border pl-4 text-sm">
            {timeline.map((t) => (
              <li key={t.label} className="relative">
                <span className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-brand" aria-hidden="true" />
                <span className="font-medium">{t.label}</span>
                <span className="block text-xs text-muted">{fmtDateTime(t.at)}</span>
              </li>
            ))}
          </ol>
          <Link href={`/transactions/${tx.id}`} className="btn-secondary mt-4 px-3 py-1.5">
            Open transaction page
          </Link>
        </Panel>
      </div>
    </div>
  );
}
