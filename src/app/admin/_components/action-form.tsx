"use client";

import { startTransition, useActionState, useEffect, useId, useState } from "react";
import type { FormState } from "@/app/actions/auth";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  danger: "btn-ghost text-danger hover:bg-danger-soft hover:text-danger",
};

const SUBMIT: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-primary",
  ghost: "btn-primary",
  danger: "btn-primary bg-danger hover:bg-danger",
};

function Submit({ children, className, pending }: { children: React.ReactNode; className: string; pending: boolean }) {
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending && <span className="spinner opacity-80" aria-hidden="true" />}
      {pending ? "Saving..." : children}
    </button>
  );
}

/**
 * A small form that calls an admin/moderator server action.
 * Plain actions submit straight away. Destructive ones (`confirm`), or ones
 * that need a reason or extra fields, open an inline confirm step first.
 */
export function ActionForm({
  action,
  hidden = {},
  label,
  variant = "secondary",
  confirm,
  reason,
  children,
  submitLabel,
  alwaysOpen = false,
  className = "",
}: {
  action: (prev: FormState, fd: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  label: string;
  variant?: Variant;
  /** Text shown in the confirm step. */
  confirm?: string;
  /** Adds a reason/note textarea. */
  reason?: { name?: string; label: string; required?: boolean; placeholder?: string };
  /** Extra fields shown in the confirm step. */
  children?: React.ReactNode;
  submitLabel?: string;
  /** Render the form open, without a toggle or cancel button. */
  alwaysOpen?: boolean;
  className?: string;
}) {
  const [state, dispatch, pending] = useActionState(action, {} as FormState);
  // Submit manually so fields keep their values when the server returns an error.
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    startTransition(() => dispatch(fd));
  };
  const [open, setOpen] = useState(alwaysOpen);
  const fieldId = useId();
  const needsStep = alwaysOpen || !!confirm || !!reason || !!children;

  useEffect(() => {
    if (state.success && !alwaysOpen) setOpen(false);
  }, [state, alwaysOpen]);

  const hiddenInputs = Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />);
  const small = "px-3 py-1.5";

  const message = (
    <p aria-live="polite" className="text-xs">
      {state.error && <span className="mt-1.5 block text-danger">{state.error}</span>}
      {state.success && !open && <span className="mt-1.5 block text-brand">{state.success}</span>}
      {state.success && open && alwaysOpen && <span className="mt-1.5 block text-brand">{state.success}</span>}
    </p>
  );

  if (!needsStep) {
    return (
      <form onSubmit={onSubmit} className={className}>
        {hiddenInputs}
        <Submit pending={pending} className={`${VARIANT[variant]} ${small}`}>{label}</Submit>
        {message}
      </form>
    );
  }

  if (!open) {
    return (
      <div className={className}>
        <button type="button" onClick={() => setOpen(true)} className={`${VARIANT[variant]} ${small}`}>
          {label}
        </button>
        {message}
      </div>
    );
  }

  const danger = variant === "danger";
  return (
    <form
      onSubmit={onSubmit}
      className={`${alwaysOpen ? "" : `animate-pop-in w-full rounded-xl border border-border p-3 ${danger ? "bg-danger-soft" : "bg-surface-2/60"}`} ${className}`}
      role={alwaysOpen ? undefined : "group"}
      aria-label={alwaysOpen ? undefined : label}
    >
      {hiddenInputs}
      {confirm && <p className={`text-sm font-medium ${danger ? "text-danger" : ""}`}>{confirm}</p>}
      {children && <div className="mt-2 space-y-2">{children}</div>}
      {reason && (
        <div className="mt-2">
          <label htmlFor={fieldId} className="label text-xs">
            {reason.label}
            {reason.required ? "" : " (optional)"}
          </label>
          <textarea
            id={fieldId}
            name={reason.name ?? "reason"}
            required={reason.required}
            minLength={reason.required ? 3 : undefined}
            maxLength={1000}
            rows={2}
            placeholder={reason.placeholder}
            className="input"
          />
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <Submit pending={pending} className={`${SUBMIT[variant]} ${small}`}>{submitLabel ?? label}</Submit>
        {!alwaysOpen && (
          <button type="button" onClick={() => setOpen(false)} className={`btn-secondary ${small}`}>
            Cancel
          </button>
        )}
      </div>
      {message}
    </form>
  );
}
