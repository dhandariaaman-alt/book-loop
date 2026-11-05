"use client";

import { useActionState, useState, useTransition } from "react";
import { cancelPledgeAction, pledgeDonationAction } from "@/app/actions/institutions";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { HANDOVER_METHODS } from "@/lib/trust-labels";

export function PledgeForm({ requestId }: { requestId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(pledgeDonationAction, {});

  if (state.success) return <div className="mt-3"><FormMessage state={state} /></div>;

  if (!open) {
    return (
      <button type="button" className="btn-primary mt-3 !px-3 !py-2" onClick={() => setOpen(true)} aria-expanded={false}>
        Pledge books
      </button>
    );
  }

  return (
    <form action={action} className="animate-pop-in mt-3 space-y-3 rounded-xl border border-border bg-surface p-3">
      <input type="hidden" name="requestId" value={requestId} />
      <div>
        <label htmlFor={`pl-desc-${requestId}`} className="label">Which books?</label>
        <textarea
          id={`pl-desc-${requestId}`}
          name="description"
          required
          minLength={3}
          maxLength={1000}
          rows={2}
          className="input resize-y"
          placeholder="e.g. 5 Ruskin Bond paperbacks, good condition"
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-[6rem_1fr]">
        <div>
          <label htmlFor={`pl-qty-${requestId}`} className="label">How many</label>
          <input id={`pl-qty-${requestId}`} name="quantity" type="number" min={1} max={500} defaultValue={1} required className="input" />
        </div>
        <div>
          <label htmlFor={`pl-method-${requestId}`} className="label">Handover</label>
          <select id={`pl-method-${requestId}`} name="handoverMethod" defaultValue="INSTITUTION_POINT" className="input">
            {HANDOVER_METHODS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-2">
        <SubmitButton className="btn-primary !py-2" pendingText="Sending…">
          Send pledge
        </SubmitButton>
        <button type="button" className="btn-ghost !py-2" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  );
}

export function CancelPledgeButton({ donationId }: { donationId: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!confirm) {
    return (
      <button type="button" className="text-xs text-muted underline-offset-2 hover:text-fg hover:underline" onClick={() => setConfirm(true)}>
        Cancel pledge
      </button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-xs">
      <span>Cancel this pledge?</span>
      <button
        type="button"
        className="font-medium text-danger hover:underline"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const r = await cancelPledgeAction(donationId);
            if (r.error) setError(r.error);
          })
        }
      >
        {pending ? "Cancelling…" : "Yes, cancel"}
      </button>
      <button type="button" className="text-muted hover:underline" onClick={() => setConfirm(false)}>
        Keep it
      </button>
      {error && <span role="alert" className="text-danger">{error}</span>}
    </span>
  );
}
