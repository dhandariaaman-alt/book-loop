"use client";

import Link from "next/link";
import { useActionState } from "react";
import { forgotPasswordAction } from "@/app/actions/auth";
import { AuthShell } from "@/components/auth-shell";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export default function ForgotPasswordPage() {
  const [state, action] = useActionState(forgotPasswordAction, {});
  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      <form action={action} className="space-y-4">
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" autoComplete="email" required className="input" />
        </div>
        <FormMessage state={state} />
        <SubmitButton pendingText="Sending…">Send reset link</SubmitButton>
      </form>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-brand hover:underline">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
