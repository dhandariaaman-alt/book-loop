"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  acceptRequestAction,
  cancelRequestAction,
  rejectRequestAction,
  type ActionResult,
} from "@/app/actions/requests";

function Result({ msg }: { msg: ActionResult | null }) {
  return (
    <p aria-live="polite" className="text-sm">
      {msg?.success && (
        <span className="mt-2 block text-brand">
          {msg.success}{" "}
          {msg.transactionId && (
            <Link href={`/transactions/${msg.transactionId}`} className="font-semibold underline underline-offset-2">
              Plan the handover
            </Link>
          )}
        </span>
      )}
      {msg?.error && <span className="mt-2 block text-danger">{msg.error}</span>}
    </p>
  );
}

/** Accept / Decline for the owner of a listing. */
export function RequestDecision({ requestId, compact = false }: { requestId: string; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  const [which, setWhich] = useState<"accept" | "decline" | null>(null);
  const done = !!msg?.success;

  const run = (kind: "accept" | "decline") =>
    start(async () => {
      setWhich(kind);
      setMsg(null);
      const res = kind === "accept" ? await acceptRequestAction(requestId) : await rejectRequestAction(requestId);
      setMsg(res);
    });

  return (
    <div>
      {!done && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => run("accept")}
            disabled={pending}
            className={`btn-primary ${compact ? "px-3 py-1.5 text-sm" : ""}`}
            aria-busy={pending && which === "accept"}
          >
            {pending && which === "accept" ? "Accepting..." : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => run("decline")}
            disabled={pending}
            className={`btn-secondary ${compact ? "px-3 py-1.5 text-sm" : ""}`}
            aria-busy={pending && which === "decline"}
          >
            {pending && which === "decline" ? "Declining..." : "Decline"}
          </button>
        </div>
      )}
      <Result msg={msg} />
    </div>
  );
}

/** Cancel for the requester's own pending request. */
export function CancelRequestButton({ requestId, label = "Cancel request" }: { requestId: string; label?: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<ActionResult | null>(null);
  return (
    <div>
      {!msg?.success && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              setMsg(null);
              setMsg(await cancelRequestAction(requestId));
            })
          }
          className="btn-ghost px-3 py-1.5 text-sm text-danger hover:bg-danger-soft hover:text-danger"
        >
          {pending ? "Cancelling..." : label}
        </button>
      )}
      <Result msg={msg} />
    </div>
  );
}
