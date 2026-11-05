/* eslint-disable @next/next/no-img-element */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getOrCreateConversation } from "@/lib/conversations";
import {
  dueState,
  expireReservations,
  formatDate,
  formatDateTime,
  getTransactionForViewer,
  handoverMethodLabel,
  type TransactionView,
} from "@/lib/transactions";
import { formatPrice, typeLabel } from "@/lib/listing-labels";
import { Avatar } from "@/components/avatar";
import { Icon, Panel } from "@/components/app/ui";
import { DrawnCover } from "@/components/listings/listing-card";
import { Countdown } from "@/components/requests/countdown";
import { HandoverCard } from "@/components/requests/handover-card";
import { TxActions } from "@/components/requests/tx-actions";
import { TransactionTrust } from "@/components/trust/transaction-trust";
import { TX_STATUS } from "../../activity/labels";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const t = await prisma.transaction.findUnique({ where: { id }, select: { listing: { select: { book: { select: { title: true } } } } } });
  return { title: t ? `Hand-off: ${t.listing.book.title}` : "Hand-off" };
}

type Step = { key: string; label: string; detail?: React.ReactNode; done: boolean; tone?: "end" | "bad" };

function buildSteps(t: TransactionView, now: number): Step[] {
  const res = t.reservations[0] ?? null;
  const expired = t.status === "CANCELLED" && res?.status === "EXPIRED";
  const finished = t.status === "COMPLETED";
  const handedOver = !!t.handedOverAt;

  const steps: Step[] = [
    { key: "requested", label: "Requested", detail: formatDateTime(t.request.createdAt), done: true },
    {
      key: "accepted",
      label: "Accepted",
      done: true,
      detail:
        t.status === "RESERVED" && res ? (
          res.status === "CONFIRMED" ? (
            <>Meet-up confirmed{res.confirmedAt ? ` ${formatDateTime(res.confirmedAt)}` : ""}</>
          ) : (
            <span className="inline-flex flex-wrap items-center gap-2">
              Reserved until {formatDateTime(res.expiresAt)}
              <Countdown to={res.expiresAt.toISOString()} serverNow={now} />
            </span>
          )
        ) : (
          t.request.respondedAt && formatDateTime(t.request.respondedAt)
        ),
    },
    {
      key: "planned",
      label: "Handover planned",
      done: !!t.handover || handedOver,
      detail: t.handover
        ? [t.handover.placeName ?? handoverMethodLabel(t.handover.method), t.handover.scheduledAt && formatDateTime(t.handover.scheduledAt)]
            .filter(Boolean)
            .join(", ")
        : undefined,
    },
    { key: "handed", label: "Handed over", done: handedOver, detail: t.handedOverAt ? formatDateTime(t.handedOverAt) : undefined },
  ];

  if (t.type === "BORROW") {
    steps.push(
      {
        key: "due",
        label: "Due date",
        done: !!t.returnedAt || finished,
        detail: t.agreedDueDate ? formatDate(t.agreedDueDate) : undefined,
      },
      { key: "returned", label: "Returned", done: !!t.returnedAt || finished, detail: t.returnedAt ? formatDateTime(t.returnedAt) : undefined },
    );
  }
  steps.push({ key: "completed", label: "Completed", done: finished, detail: t.completedAt ? formatDateTime(t.completedAt) : undefined, tone: "end" });

  if (t.status === "CANCELLED") {
    const kept = steps.filter((s) => s.done);
    kept.push({
      key: "cancelled",
      label: expired ? "Expired" : "Cancelled",
      done: true,
      tone: "bad",
      detail: expired ? "Nobody confirmed the meet-up in time." : t.cancelledAt ? formatDateTime(t.cancelledAt) : undefined,
    });
    return kept;
  }
  return steps;
}

function Timeline({ steps, active }: { steps: Step[]; active: boolean }) {
  const current = active ? steps.findIndex((s) => !s.done) : -1;
  return (
    <ol className="relative">
      {steps.map((s, i) => {
        const isCurrent = i === current;
        const dot = s.tone === "bad"
          ? "border-danger bg-danger-soft"
          : s.done
            ? "border-brand bg-brand"
            : isCurrent
              ? "border-brand bg-butter ring-4 ring-brand-soft"
              : "border-border bg-surface";
        return (
          <li key={s.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={isCurrent ? "step" : undefined}>
            {i < steps.length - 1 && (
              <span
                className={`absolute bottom-0 left-[7px] top-4 w-0.5 ${s.done ? "bg-brand/60" : "bg-border"}`}
                aria-hidden="true"
              />
            )}
            <span className={`relative mt-1 h-4 w-4 shrink-0 rounded-full border-2 ${dot}`} aria-hidden="true" />
            <div className="min-w-0">
              <p
                className={`text-sm ${
                  s.tone === "bad" ? "font-semibold text-danger" : isCurrent ? "font-semibold text-fg" : s.done ? "text-fg" : "text-muted"
                }`}
              >
                {s.label}
                {isCurrent && <span className="font-hand ml-2 text-lg text-accent">up next</span>}
                <span className="sr-only">{s.done ? " (done)" : isCurrent ? " (current)" : ""}</span>
              </p>
              {s.detail && <p className="text-xs text-muted">{s.detail}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export default async function TransactionPage({ params }: Props) {
  const [{ id }, me] = await Promise.all([params, requireUser()]);
  await expireReservations();
  const t = await getTransactionForViewer(id, me.id);
  if (!t) notFound();

  const isOwner = t.ownerId === me.id;
  const other = isOwner ? t.receiver : t.owner;
  const otherName = other.name ?? other.username;
  const res = t.reservations[0] ?? null;
  const now = Date.now();
  const steps = buildSteps(t, now);
  const active = ["RESERVED", "HANDED_OVER", "RETURN_PENDING"].includes(t.status);
  const due = t.type === "BORROW" ? dueState(t.agreedDueDate, t.status) : null;
  const expired = t.status === "CANCELLED" && res?.status === "EXPIRED";
  const statusPill = expired ? { label: "Expired", pill: "bg-surface-2" } : TX_STATUS[t.status];

  let conversationId: string | null = null;
  try {
    conversationId = await getOrCreateConversation(t.ownerId, t.receiverId, t.requestId);
  } catch (e) {
    console.error("[transactions] conversation lookup failed", e);
  }

  const cover = t.listing.images[0]?.url;
  const price = t.type === "SALE" ? formatPrice(t.listing.pricePaise) : null;
  const offered = t.request.offeredListing;

  const handoverSummary = t.handover ? (
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs uppercase tracking-wider text-muted">Method</dt>
        <dd className="mt-0.5">{handoverMethodLabel(t.handover.method)}</dd>
      </div>
      {t.handover.placeName && (
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">Place</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 [overflow-wrap:anywhere]">
            <span className="h-4 w-4 shrink-0 text-brand">
              <Icon kind="pin" />
            </span>
            {t.handover.placeName}
          </dd>
        </div>
      )}
      {t.handover.scheduledAt && (
        <div>
          <dt className="text-xs uppercase tracking-wider text-muted">When</dt>
          <dd className="mt-0.5">{formatDateTime(t.handover.scheduledAt)}</dd>
        </div>
      )}
      {t.handover.notes && (
        <div className="sm:col-span-2">
          <dt className="text-xs uppercase tracking-wider text-muted">Notes</dt>
          <dd className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]">{t.handover.notes}</dd>
        </div>
      )}
    </dl>
  ) : t.status === "RESERVED" ? null : (
    <p className="text-sm text-muted">No handover plan was saved.</p>
  );

  return (
    <div className="min-w-0">
      <Link href="/activity?tab=borrowing" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-fg">
        <span aria-hidden="true">←</span> Back to activity
      </Link>

      <header className="card mt-4 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
        <Link
          href={`/books/${t.listingId}`}
          className="block h-28 w-20 shrink-0 overflow-hidden rounded-l-sm rounded-r-md border border-border shadow-md [container-type:inline-size]"
        >
          {cover ? (
            <img src={cover} alt={`Cover of ${t.listing.book.title}`} className="h-full w-full object-cover" />
          ) : (
            <DrawnCover title={t.listing.book.title} author={t.listing.book.author} />
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
              {typeLabel(t.type)}
              {price && ` · ${price}`}
            </span>
            <span className={`rounded-full border border-border px-2.5 py-0.5 text-xs ${statusPill.pill}`}>{statusPill.label}</span>
            {due === "overdue" && <span className="rounded-full bg-danger-soft px-2.5 py-0.5 text-xs font-semibold text-danger">Overdue</span>}
            {due === "soon" && <span className="rounded-full bg-butter px-2.5 py-0.5 text-xs font-semibold">Due soon</span>}
          </div>
          <h1 className="heading mt-2 text-2xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-3xl">{t.listing.book.title}</h1>
          <p className="text-sm text-muted">by {t.listing.book.author}</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <Avatar name={otherName} image={other.image} size={28} />
            <span className="min-w-0 truncate">
              {isOwner ? "With " : "From "}
              <Link href={`/u/${other.username}`} className="font-medium text-brand hover:underline">
                {otherName}
              </Link>{" "}
              <span className="text-muted">@{other.username}</span>
            </span>
          </div>
        </div>
        {conversationId && (
          <Link href={`/messages/${conversationId}`} className="btn-secondary self-start sm:self-center">
            <Icon kind="chat" className="h-4 w-4" />
            Open chat
          </Link>
        )}
      </header>

      {offered && (
        <p className="mt-4 rounded-2xl border border-border bg-lavender p-4 text-sm">
          In exchange:{" "}
          <Link href={`/books/${offered.id}`} className="font-semibold underline underline-offset-2">
            {offered.book.title}
          </Link>{" "}
          by {offered.book.author}
          {isOwner ? " comes to you." : " goes to the owner."}
        </p>
      )}
      {due === "overdue" && t.agreedDueDate && (
        <p role="status" className="mt-4 rounded-2xl bg-danger-soft p-4 text-sm text-danger">
          This book was due back on {formatDate(t.agreedDueDate)}.{" "}
          {isOwner ? "Send a friendly message to arrange the return." : "Please arrange the return with the owner soon."}
        </p>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <Panel title="Progress" tint="sky" icon="clock">
          <Timeline steps={steps} active={active} />
        </Panel>

        <div className="min-w-0 space-y-6">
          <Panel title={active ? "What's next" : "Status"} tint="peach" icon="compass">
            <TxActions
              transactionId={t.id}
              isOwner={isOwner}
              type={t.type}
              status={t.status}
              reservationStatus={res?.status ?? null}
              proposedDays={t.request.proposedDays}
            />
          </Panel>

          {(t.handover || t.status === "RESERVED") && (
            <Panel title="Handover plan" tint="mint" icon="pin">
              <HandoverCard
                transactionId={t.id}
                editable={t.status === "RESERVED"}
                summary={handoverSummary}
                initial={
                  t.handover
                    ? {
                        method: t.handover.method,
                        placeName: t.handover.placeName,
                        scheduledAt: t.handover.scheduledAt?.toISOString() ?? null,
                        notes: t.handover.notes,
                      }
                    : null
                }
              />
            </Panel>
          )}

          <p className="flex items-start gap-2 rounded-xl bg-butter p-3 text-sm">
            <span className="mt-0.5 h-4 w-4 shrink-0">
              <Icon kind="pin" />
            </span>
            Meet in a busy public place in daylight. Never share your home address.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <TransactionTrust transactionId={t.id} viewerId={me.id} />
      </div>
    </div>
  );
}
