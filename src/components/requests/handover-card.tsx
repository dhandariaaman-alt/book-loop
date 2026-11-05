"use client";

import { useState } from "react";
import type { HandoverMethod } from "@prisma/client";
import { HandoverForm } from "./handover-form";

/** Shows the saved handover plan (rendered on the server) with an Edit toggle, or the form when there's no plan yet. */
export function HandoverCard({
  transactionId,
  editable,
  summary,
  initial,
}: {
  transactionId: string;
  editable: boolean;
  summary: React.ReactNode | null;
  initial: { method: HandoverMethod; placeName: string | null; scheduledAt: string | null; notes: string | null } | null;
}) {
  const [editing, setEditing] = useState(false);

  if (!editable) return <>{summary}</>;
  if (summary && !editing) {
    return (
      <div>
        {summary}
        <button type="button" onClick={() => setEditing(true)} className="btn-secondary mt-4 text-sm">
          Edit plan
        </button>
      </div>
    );
  }
  return (
    <div>
      <HandoverForm transactionId={transactionId} initial={initial} onDone={() => setEditing(false)} />
      {summary && (
        <button type="button" onClick={() => setEditing(false)} className="btn-ghost mt-2 text-sm">
          Keep current plan
        </button>
      )}
    </div>
  );
}
