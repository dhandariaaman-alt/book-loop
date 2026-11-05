"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import type { ListingStatus } from "@prisma/client";
import { removeListingAction, setListingAvailabilityAction } from "@/app/actions/listings";

type Msg = { error?: string; success?: string } | null;

export function OwnerActions({ id, status }: { id: string; status: ListingStatus }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  const [confirming, setConfirming] = useState(false);
  const editable = status === "AVAILABLE" || status === "UNAVAILABLE";

  const toggle = () =>
    start(async () => {
      setMsg(null);
      const res = await setListingAvailabilityAction(id, status !== "AVAILABLE");
      setMsg(res);
    });

  const remove = () =>
    start(async () => {
      setMsg(null);
      const res = await removeListingAction(id);
      if (res?.error) {
        setMsg(res);
        setConfirming(false);
      }
    });

  return (
    <div className="card p-4 sm:p-5">
      <p className="text-xs uppercase tracking-wider text-muted">Your listing</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={`/books/${id}/edit`} className="btn-primary">
          Edit listing
        </Link>
        <button type="button" onClick={toggle} disabled={pending || !editable} className="btn-secondary">
          {status === "AVAILABLE" ? "Mark unavailable" : "Make available"}
        </button>
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={pending || !editable}
            className="btn-ghost text-danger hover:bg-danger-soft hover:text-danger"
          >
            Remove listing
          </button>
        )}
      </div>

      {confirming && (
        <div className="mt-3 rounded-xl border border-border bg-danger-soft p-3" role="alertdialog" aria-label="Confirm removal">
          <p className="text-sm font-medium text-danger">Remove this listing? It disappears from Discover.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button type="button" onClick={remove} disabled={pending} className="btn-primary bg-danger hover:bg-danger">
              {pending ? "Removing..." : "Remove"}
            </button>
            <button type="button" onClick={() => setConfirming(false)} disabled={pending} className="btn-secondary">
              Keep
            </button>
          </div>
        </div>
      )}

      {!editable && (
        <p className="mt-3 text-xs text-muted">This book has an active request, so you can&apos;t change its status or remove it right now.</p>
      )}

      <p aria-live="polite" className="text-sm">
        {msg?.success && <span className="mt-3 block text-brand">{msg.success}</span>}
        {msg?.error && <span className="mt-3 block text-danger">{msg.error}</span>}
      </p>
    </div>
  );
}
