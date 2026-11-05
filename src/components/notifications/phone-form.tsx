"use client";

import { useActionState } from "react";
import { savePhoneAction } from "@/app/actions/notifications";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import type { FormState } from "@/app/actions/auth";

export function PhoneForm({ phone, smsReady }: { phone: string | null; smsReady: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(savePhoneAction, {});
  return (
    <form action={action} className="space-y-3">
      {!smsReady && (
        <p className="rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm text-muted" role="status">
          SMS isn&apos;t set up on this server, so texts won&apos;t be sent yet. You can still save your number.
        </p>
      )}
      <div>
        <label htmlFor="phone" className="label">
          Mobile number
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          placeholder="+919876543210"
          className="input"
          aria-describedby="phone-hint"
        />
        <p id="phone-hint" className="mt-1.5 text-xs text-muted">
          International format with your country code, for example +919876543210. Only used for texts you turn on, and
          never shown to other readers. Leave it empty to remove it.
        </p>
      </div>
      <FormMessage state={state} />
      <SubmitButton className="btn-secondary" pendingText="Saving…">
        Save number
      </SubmitButton>
    </form>
  );
}
