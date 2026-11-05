"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, pendingText, className = "btn-primary w-full" }: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending} aria-busy={pending}>
      {pending ? (
        <>
          <span className="spinner opacity-80" aria-hidden="true" />
          {pendingText ?? "Please wait…"}
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function FormMessage({ state }: { state: { error?: string; success?: string } }) {
  if (state.error) {
    return (
      <p key={state.error} role="alert" className="animate-pop-in rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p key={state.success} role="status" className="animate-pop-in rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
        {state.success}
      </p>
    );
  }
  return null;
}
