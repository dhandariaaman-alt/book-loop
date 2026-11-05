"use client";

import { useActionState } from "react";
import { registerInstitutionAction, updateInstitutionProfileAction } from "@/app/actions/institutions";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { INSTITUTION_TYPES } from "@/lib/trust-labels";

export type InstitutionInitial = {
  name: string;
  type: string;
  description: string;
  publicAddress: string;
  neighbourhood: string;
  website: string;
};

export function InstitutionForm({
  mode,
  initial,
  submitLabel,
}: {
  mode: "register" | "edit";
  initial?: Partial<InstitutionInitial>;
  submitLabel: string;
}) {
  const [state, action] = useActionState(mode === "register" ? registerInstitutionAction : updateInstitutionProfileAction, {});

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inst-name" className="label">Name</label>
          <input id="inst-name" name="name" required minLength={3} maxLength={120} defaultValue={initial?.name} className="input" placeholder="e.g. Indiranagar Public Library" />
        </div>
        <div>
          <label htmlFor="inst-type" className="label">Type</label>
          <select id="inst-type" name="type" required defaultValue={initial?.type ?? ""} className="input">
            <option value="" disabled>Choose one</option>
            {INSTITUTION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="inst-desc" className="label">
          About <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea id="inst-desc" name="description" rows={3} maxLength={1000} defaultValue={initial?.description} className="input resize-y" placeholder="Who you serve and what kinds of books you collect." />
      </div>
      <div>
        <label htmlFor="inst-addr" className="label">
          Public drop-off address <span className="font-normal text-muted">(optional)</span>
        </label>
        <input id="inst-addr" name="publicAddress" maxLength={300} defaultValue={initial?.publicAddress} className="input" placeholder="The public entrance where donors can bring books" />
        <p className="mt-1 text-xs text-muted">This is shown to donors, so only use your institution&apos;s public address.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="inst-hood" className="label">
            Neighbourhood <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="inst-hood" name="neighbourhood" maxLength={80} defaultValue={initial?.neighbourhood} className="input" placeholder="e.g. Jayanagar" />
        </div>
        <div>
          <label htmlFor="inst-web" className="label">
            Website <span className="font-normal text-muted">(optional)</span>
          </label>
          <input id="inst-web" name="website" type="text" inputMode="url" maxLength={200} defaultValue={initial?.website} className="input" placeholder="library.example.org" />
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-primary w-full sm:w-auto" pendingText="Saving…">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
