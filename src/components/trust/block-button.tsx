"use client";

import { useState, useTransition } from "react";
import { setBlockAction } from "@/app/actions/trust";
import { TrustDialog } from "./trust-dialog";

/** Block / Unblock toggle for another member. Blocking asks for confirmation first. */
export function BlockButton({
  userId,
  username,
  initiallyBlocked = false,
  className,
}: {
  userId: string;
  username: string;
  initiallyBlocked?: boolean;
  className?: string;
}) {
  const [blocked, setBlocked] = useState(initiallyBlocked);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function run(block: boolean) {
    setError(null);
    start(async () => {
      const r = await setBlockAction(userId, block);
      if (r.error) {
        setError(r.error);
        return;
      }
      setBlocked(block);
      setConfirming(false);
    });
  }

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (blocked) run(false);
    else {
      setError(null);
      setConfirming(true);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className={
          className ??
          "inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50 disabled:opacity-60"
        }
      >
        <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <circle cx="10" cy="10" r="6.5" />
          <path d="M5.5 14.5l9-9" />
        </svg>
        {pending && !confirming ? "Please wait…" : blocked ? "Unblock" : "Block"}
      </button>
      {error && !confirming && (
        <span role="alert" className="text-xs text-danger">
          {error}
        </span>
      )}

      {confirming && (
        <TrustDialog title={`Block @${username}?`} onClose={() => setConfirming(false)}>
          <p className="text-sm text-muted">
            They won&apos;t be able to message you or request your books, and you won&apos;t see each other&apos;s listings.
            They aren&apos;t told that you blocked them. You can unblock them any time from Settings.
          </p>
          {error && (
            <p role="alert" className="mt-3 rounded-lg bg-danger-soft px-3 py-2.5 text-sm text-danger">
              {error}
            </p>
          )}
          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <button type="button" className="btn-ghost" onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary !bg-danger hover:!bg-danger/90"
              onClick={() => run(true)}
              disabled={pending}
              aria-busy={pending}
            >
              {pending && <span className="spinner opacity-80" aria-hidden="true" />}
              {pending ? "Blocking…" : `Block @${username}`}
            </button>
          </div>
        </TrustDialog>
      )}
    </>
  );
}
