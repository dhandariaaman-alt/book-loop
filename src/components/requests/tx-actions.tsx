"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import type { ListingType, ReservationStatus, TransactionStatus } from "@prisma/client";
import {
  cancelTransactionAction,
  confirmReservationAction,
  confirmReturnAction,
  markHandedOverAction,
  markReturnedAction,
  type ActionResult,
} from "@/app/actions/requests";
import { FormMessage, SubmitButton } from "@/components/form-bits";

type Props = {
  transactionId: string;
  isOwner: boolean;
  type: ListingType;
  status: TransactionStatus;
  reservationStatus: ReservationStatus | null;
  proposedDays: number | null;
};

function isoDate(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function HandedOverForm({ transactionId, type, proposedDays }: Pick<Props, "transactionId" | "type" | "proposedDays">) {
  const [state, action] = useActionState<ActionResult, FormData>(markHandedOverAction.bind(null, transactionId), {});
  const [due, setDue] = useState("");
  const [min, setMin] = useState("");
  useEffect(() => {
    const today = new Date();
    setMin(isoDate(new Date(today.getTime() + 86400000)));
    setDue(isoDate(new Date(today.getTime() + (proposedDays ?? 14) * 86400000)));
  }, [proposedDays]);
  const dueIso = due ? new Date(`${due}T23:59:59`).toISOString() : "";

  return (
    <form action={action} className="space-y-3">
      {type === "BORROW" && (
        <div>
          <label htmlFor="dueDate" className="label">
            Agreed return date
          </label>
          <input
            id="dueDate"
            type="date"
            required
            min={min || undefined}
            value={due}
            onChange={(e) => setDue(e.target.value)}
            className="input mt-1 w-full sm:w-auto"
          />
          <input type="hidden" name="dueDateIso" value={dueIso} />
          <p className="mt-1 text-xs text-muted">
            {proposedDays ? `They asked for ${proposedDays} days. ` : ""}Agree this together before you hand it over.
          </p>
        </div>
      )}
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving...">
        {type === "BORROW" ? "Mark as handed over" : "Handed over, complete it"}
      </SubmitButton>
    </form>
  );
}

export function TxActions({ transactionId, isOwner, type, status, reservationStatus, proposedDays }: Props) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [which, setWhich] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = (key: string, fn: (id: string) => Promise<ActionResult>) =>
    start(async () => {
      setWhich(key);
      setMsg(null);
      setMsg(await fn(transactionId));
      setConfirmCancel(false);
    });

  const btn = (key: string, label: string, busy: string, fn: (id: string) => Promise<ActionResult>, cls = "btn-primary") => (
    <button type="button" className={cls} disabled={pending} aria-busy={pending && which === key} onClick={() => run(key, fn)}>
      {pending && which === key ? busy : label}
    </button>
  );

  let body: React.ReactNode = null;

  if (status === "RESERVED") {
    const confirmed = reservationStatus === "CONFIRMED";
    body = (
      <div className="space-y-4">
        {!confirmed && (
          <div>
            <p className="text-sm text-muted">
              Confirm you&apos;ll meet so the reservation doesn&apos;t expire. Either of you can confirm.
            </p>
            <div className="mt-2">{btn("confirm", "Confirm the meet-up", "Confirming...", confirmReservationAction)}</div>
          </div>
        )}
        {isOwner ? (
          <div className={confirmed ? "" : "border-t border-border pt-4"}>
            <p className="mb-2 text-sm text-muted">Once the book is in their hands, mark it here.</p>
            <HandedOverForm transactionId={transactionId} type={type} proposedDays={proposedDays} />
          </div>
        ) : (
          confirmed && <p className="text-sm text-muted">Meet-up confirmed. The owner will mark the book as handed over when you meet.</p>
        )}
        <div className="border-t border-border pt-3">
          {!confirmCancel ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              disabled={pending}
              className="btn-ghost px-3 py-1.5 text-sm text-danger hover:bg-danger-soft hover:text-danger"
            >
              Cancel reservation
            </button>
          ) : (
            <div className="rounded-xl bg-danger-soft p-3" role="alertdialog" aria-label="Confirm cancellation">
              <p className="text-sm font-medium text-danger">Cancel this reservation? The book becomes available again.</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {btn("cancel", "Yes, cancel", "Cancelling...", cancelTransactionAction, "btn-primary bg-danger hover:bg-danger")}
                <button type="button" className="btn-secondary" onClick={() => setConfirmCancel(false)} disabled={pending}>
                  Keep it
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  } else if (status === "HANDED_OVER" && type === "BORROW") {
    body = isOwner ? (
      <div>
        <p className="text-sm text-muted">Got the book back already? You can confirm the return directly.</p>
        <div className="mt-2">{btn("confirmReturn", "Confirm return", "Confirming...", confirmReturnAction, "btn-secondary")}</div>
      </div>
    ) : (
      <div>
        <p className="text-sm text-muted">Finished reading? Return it to the owner, then mark it here.</p>
        <div className="mt-2">{btn("returned", "Mark as returned", "Saving...", markReturnedAction)}</div>
      </div>
    );
  } else if (status === "RETURN_PENDING") {
    body = isOwner ? (
      <div>
        <p className="text-sm text-muted">The borrower says they&apos;ve returned it. Confirm once it&apos;s back with you.</p>
        <div className="mt-2">{btn("confirmReturn", "Confirm I have it back", "Confirming...", confirmReturnAction)}</div>
      </div>
    ) : (
      <p className="text-sm text-muted">Waiting for the owner to confirm they have the book back.</p>
    );
  } else if (status === "COMPLETED") {
    body = <p className="text-sm text-muted">All done. Thanks for keeping books moving.</p>;
  } else if (status === "CANCELLED") {
    body = <p className="text-sm text-muted">This hand-off is closed. The book went back on the shelf.</p>;
  } else if (status === "DISPUTED") {
    body = <p className="text-sm text-muted">A problem was reported. Our moderators will be in touch.</p>;
  }

  return (
    <div>
      {body}
      <p aria-live="polite" className="text-sm">
        {msg?.success && <span className="mt-3 block text-brand">{msg.success}</span>}
        {msg?.error && <span className="mt-3 block text-danger">{msg.error}</span>}
      </p>
    </div>
  );
}
