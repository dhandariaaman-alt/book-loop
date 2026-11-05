"use client";

import { useActionState, useState } from "react";
import type { HandoverMethod } from "@prisma/client";
import { saveHandoverAction, type ActionResult } from "@/app/actions/requests";
import { FormMessage, SubmitButton } from "@/components/form-bits";

const METHODS: { value: HandoverMethod; label: string }[] = [
  { value: "PUBLIC_PLACE", label: "Public place" },
  { value: "INSTITUTION_POINT", label: "Library or institution point" },
  { value: "SELF_ARRANGED_DELIVERY", label: "Self-arranged delivery" },
  { value: "OTHER", label: "Other" },
];

const SPOTS = ["Local library", "Coffee shop", "Metro station", "Park entrance", "Bookshop", "Mall food court"];

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function HandoverForm({
  transactionId,
  initial,
  onDone,
}: {
  transactionId: string;
  initial: { method: HandoverMethod; placeName: string | null; scheduledAt: string | null; notes: string | null } | null;
  onDone?: () => void;
}) {
  const [state, action] = useActionState<ActionResult, FormData>(async (prev, fd) => {
    const res = await saveHandoverAction(transactionId, prev, fd);
    if (res.success) onDone?.();
    return res;
  }, {});
  const [method, setMethod] = useState<HandoverMethod>(initial?.method ?? "PUBLIC_PLACE");
  const [place, setPlace] = useState(initial?.placeName ?? "");
  const [when, setWhen] = useState(() => toLocalInput(initial?.scheduledAt ?? null));
  const iso = when && !Number.isNaN(new Date(when).getTime()) ? new Date(when).toISOString() : "";

  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="method" className="label">
          How will you hand it over?
        </label>
        <select
          id="method"
          name="method"
          value={method}
          onChange={(e) => setMethod(e.target.value as HandoverMethod)}
          className="input mt-1 w-full"
        >
          {METHODS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="placeName" className="label">
          Meeting place
        </label>
        <input
          id="placeName"
          name="placeName"
          value={place}
          onChange={(e) => setPlace(e.target.value)}
          maxLength={120}
          required={method === "PUBLIC_PLACE"}
          placeholder="e.g. Central Library, front steps"
          className="input mt-1 w-full"
        />
        <p className="mt-2 rounded-lg bg-butter px-3 py-2 text-xs">Pick a busy public spot. Never share a home address.</p>
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Suggested public spots">
          {SPOTS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setPlace(s)}
              className={`rounded-full border border-border px-3 py-1 text-xs transition-colors ${
                place === s ? "bg-mint font-semibold" : "bg-surface hover:bg-surface-2"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="scheduledAt" className="label">
          Date and time <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="scheduledAt"
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className="input mt-1 w-full"
        />
        <input type="hidden" name="scheduledAtIso" value={iso} />
      </div>

      <div>
        <label htmlFor="notes" className="label">
          Notes <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={2}
          maxLength={500}
          defaultValue={initial?.notes ?? ""}
          placeholder="e.g. I'll be wearing a green jacket."
          className="input mt-1 w-full resize-y"
        />
      </div>

      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving...">
        Save handover plan
      </SubmitButton>
    </form>
  );
}
