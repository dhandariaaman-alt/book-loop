"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { DonationStatus } from "@prisma/client";
import {
  saveDonationRequestAction,
  setDonationRequestStatusAction,
  updateDonationStatusAction,
} from "@/app/actions/institutions";
import { FormMessage, SubmitButton } from "@/components/form-bits";

const CHIP_FILLS = [
  "peer-checked:bg-mint",
  "peer-checked:bg-peach",
  "peer-checked:bg-lavender",
  "peer-checked:bg-sky",
  "peer-checked:bg-butter",
  "peer-checked:bg-rose",
];

export type RequestInitial = {
  id?: string;
  title: string;
  description: string;
  booksWanted: string;
  quantityGoal: number | null;
  dropOffInfo: string;
  genreIds: string[];
};

export function DonationRequestForm({
  genres,
  initial,
}: {
  genres: { id: string; name: string }[];
  initial?: RequestInitial;
}) {
  const [state, action] = useActionState(saveDonationRequestAction, {});
  const router = useRouter();

  useEffect(() => {
    if (state.success && state.id && !initial?.id) router.push(`/institution/requests/${state.id}`);
  }, [state, initial?.id, router]);

  return (
    <form action={action} className="space-y-4">
      {initial?.id && <input type="hidden" name="id" value={initial.id} />}
      <div>
        <label htmlFor="dr-title" className="label">Title</label>
        <input id="dr-title" name="title" required minLength={3} maxLength={120} defaultValue={initial?.title} className="input" placeholder="e.g. Picture books for our reading corner" />
      </div>
      <div>
        <label htmlFor="dr-desc" className="label">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="dr-desc" name="description" rows={3} maxLength={2000} defaultValue={initial?.description} className="input resize-y" placeholder="Who the books are for and why they matter." />
      </div>
      <div>
        <label htmlFor="dr-wanted" className="label">
          Books wanted <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="dr-wanted" name="booksWanted" rows={2} maxLength={1000} defaultValue={initial?.booksWanted} className="input resize-y" placeholder="Titles, authors or kinds of books" />
      </div>
      {genres.length > 0 && (
        <fieldset>
          <legend className="label">
            Genres <span className="font-normal text-muted">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {genres.map((g, i) => (
              <label key={g.id} className="cursor-pointer">
                <input
                  type="checkbox"
                  name="genres"
                  value={g.id}
                  defaultChecked={initial?.genreIds.includes(g.id)}
                  className="peer sr-only"
                />
                <span
                  className={`inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-2 peer-checked:border-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 ${CHIP_FILLS[i % CHIP_FILLS.length]}`}
                >
                  {g.name}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label htmlFor="dr-goal" className="label">
            Goal <span className="font-normal text-muted">(books)</span>
          </label>
          <input id="dr-goal" name="quantityGoal" type="number" min={1} max={10000} defaultValue={initial?.quantityGoal ?? ""} className="input" placeholder="50" />
        </div>
        <div>
          <label htmlFor="dr-drop" className="label">
            Drop-off details <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="dr-drop" name="dropOffInfo" maxLength={500} defaultValue={initial?.dropOffInfo} className="input" placeholder="e.g. Front desk, weekdays 10am to 5pm" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving…">
        {initial?.id ? "Save changes" : "Publish request"}
      </SubmitButton>
    </form>
  );
}

export function RequestStatusButtons({ requestId, status }: { requestId: string; status: "OPEN" | "FULFILLED" | "CLOSED" }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = (s: "OPEN" | "FULFILLED" | "CLOSED") =>
    start(async () => {
      setError(null);
      const r = await setDonationRequestStatusAction(requestId, s);
      if (r.error) setError(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "OPEN" ? (
        <>
          <button type="button" className="btn-secondary" disabled={pending} onClick={() => set("FULFILLED")}>
            Mark fulfilled
          </button>
          <button type="button" className="btn-ghost" disabled={pending} onClick={() => set("CLOSED")}>
            Close request
          </button>
        </>
      ) : (
        <button type="button" className="btn-secondary" disabled={pending} onClick={() => set("OPEN")}>
          Reopen request
        </button>
      )}
      {pending && <span className="spinner opacity-70" aria-hidden="true" />}
      {error && (
        <span role="alert" className="text-sm text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

export function DonationStatusForm({ donationId, status }: { donationId: string; status: DonationStatus }) {
  const [state, action] = useActionState(updateDonationStatusAction, {});
  const [local, setLocal] = useState("");
  const iso = (() => {
    if (!local) return "";
    const d = new Date(local);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  })();

  if (status === "RECEIVED" || status === "CANCELLED") return null;

  return (
    <div className="mt-3 space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <form action={action} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="donationId" value={donationId} />
          <input type="hidden" name="status" value="SCHEDULED" />
          <input type="hidden" name="scheduledAt" value={iso} />
          <div>
            <label htmlFor={`when-${donationId}`} className="mb-1 block text-xs text-muted">
              {status === "SCHEDULED" ? "Reschedule drop-off" : "Schedule drop-off"}
            </label>
            <input
              id={`when-${donationId}`}
              type="datetime-local"
              required
              value={local}
              onChange={(e) => setLocal(e.target.value)}
              className="input !py-1.5"
            />
          </div>
          <SubmitButton className="btn-secondary !py-2" pendingText="Saving…">
            {status === "SCHEDULED" ? "Update" : "Schedule"}
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="donationId" value={donationId} />
          <input type="hidden" name="status" value="RECEIVED" />
          <SubmitButton className="btn-primary !py-2" pendingText="Saving…">
            Mark received
          </SubmitButton>
        </form>
        <form action={action}>
          <input type="hidden" name="donationId" value={donationId} />
          <input type="hidden" name="status" value="CANCELLED" />
          <SubmitButton className="btn-ghost !py-2" pendingText="Saving…">
            Cancel
          </SubmitButton>
        </form>
      </div>
      <FormMessage state={state} />
    </div>
  );
}
