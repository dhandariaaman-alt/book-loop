"use client";

import { useId, useState, useTransition } from "react";
import { reportAction } from "@/app/actions/trust";
import { REPORT_REASONS } from "@/lib/trust-labels";
import { TrustDialog } from "./trust-dialog";

export type ReportTarget = "USER" | "LISTING" | "MESSAGE" | "REVIEW";

const NOUN: Record<ReportTarget, string> = {
  USER: "this member",
  LISTING: "this listing",
  MESSAGE: "this message",
  REVIEW: "this review",
};

/** A small, quiet "Report" button that opens a short form in a dialog. */
export function ReportButton({
  target,
  targetId,
  label = "Report",
  className,
}: {
  target: ReportTarget;
  targetId: string;
  /** The user being reported. Optional: the server works it out from the target. */
  reportedUserId?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [details, setDetails] = useState("");
  const [result, setResult] = useState<{ error?: string; success?: string }>({});
  const [pending, start] = useTransition();
  const id = useId();

  function openDialog(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setResult({});
    setOpen(true);
  }

  function close() {
    setOpen(false);
    if (result.success) {
      setReason("");
      setDetails("");
      setResult({});
    }
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!reason) {
      setResult({ error: "Please pick a reason." });
      return;
    }
    start(async () => {
      const r = await reportAction({ target, targetId, reason, details });
      setResult(r);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
        }
        aria-haspopup="dialog"
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 17V3.5M4 4h10l-2 3.5 2 3.5H4" />
        </svg>
        {label}
      </button>

      {open && (
        <TrustDialog title={`Report ${NOUN[target]}`} onClose={close}>
          {result.success ? (
            <div className="space-y-4">
              <p role="status" className="animate-pop-in rounded-lg bg-success-soft px-3 py-2.5 text-sm text-success">
                {result.success}
              </p>
              <p className="text-sm text-muted">
                Reports are private. The person you reported won&apos;t see who sent it.
              </p>
              <button type="button" className="btn-secondary w-full" onClick={close}>
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <fieldset>
                <legend className="label">What&apos;s the problem?</legend>
                <div className="flex flex-wrap gap-2">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className="cursor-pointer">
                      <input
                        type="radio"
                        name={`${id}-reason`}
                        value={r}
                        checked={reason === r}
                        onChange={() => setReason(r)}
                        className="peer sr-only"
                      />
                      <span className="inline-block rounded-full border border-border bg-surface px-3 py-1.5 text-sm transition-colors hover:bg-surface-2 peer-checked:border-brand peer-checked:bg-brand-soft peer-checked:text-brand peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50">
                        {r}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <div>
                <label htmlFor={`${id}-details`} className="label">
                  Anything else we should know? <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id={`${id}-details`}
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1000}
                  rows={3}
                  className="input resize-y"
                  placeholder="A short description helps our moderators."
                />
                <p className="mt-1 text-right text-xs text-muted">{details.length}/1000</p>
              </div>
              {result.error && (
                <p role="alert" className="animate-pop-in rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
                  {result.error}
                </p>
              )}
              <div className="flex flex-wrap justify-end gap-2">
                <button type="button" className="btn-ghost" onClick={close}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary" disabled={pending} aria-busy={pending}>
                  {pending && <span className="spinner opacity-80" aria-hidden="true" />}
                  {pending ? "Sending…" : "Send report"}
                </button>
              </div>
            </form>
          )}
        </TrustDialog>
      )}
    </>
  );
}
