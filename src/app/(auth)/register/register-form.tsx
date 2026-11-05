"use client";

import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";

export function RegisterForm() {
  const [state, action] = useActionState(registerAction, {});
  return (
    <form action={action} className="space-y-4">
      <div>
        <label htmlFor="name" className="label">Full name</label>
        <input id="name" name="name" autoComplete="name" required minLength={2} maxLength={80} className="input" />
      </div>
      <div>
        <label htmlFor="username" className="label">Username</label>
        <div className="flex items-center rounded-lg border border-border bg-surface focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/25">
          <span className="pl-3 text-sm text-muted">@</span>
          <input
            id="username"
            name="username"
            autoComplete="username"
            required
            pattern="[a-zA-Z0-9_]{3,20}"
            title="3–20 letters, numbers or underscores"
            className="w-full bg-transparent px-1.5 py-2.5 text-sm outline-none"
            aria-describedby="username-hint"
          />
        </div>
        <p id="username-hint" className="mt-1 text-xs text-muted">3–20 letters, numbers or underscores.</p>
      </div>
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required className="input" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          maxLength={72}
          className="input"
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="mt-1 text-xs text-muted">At least 8 characters, with a letter and a number.</p>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}
