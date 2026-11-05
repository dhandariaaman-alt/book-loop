"use client";

import Link from "next/link";
import { useActionState } from "react";
import { resetPasswordAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function ResetForm({ token }: { token: string }) {
  const [state, action] = useActionState(resetPasswordAction, {});
  if (state.success) {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/login" className="btn-primary w-full">Sign in</Link>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="label">New password</label>
        <input id="password" name="password" type="password" autoComplete="new-password" required minLength={8} maxLength={72} className="input" />
        <p className="mt-1 text-xs text-muted">At least 8 characters, with a letter and a number.</p>
      </div>
      <div>
        <label htmlFor="confirm" className="label">Confirm new password</label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="input" />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Saving…">Update password</SubmitButton>
    </form>
  );
}
