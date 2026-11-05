/** Received vs goal for a donation request. */
export function DonationProgress({ received, pledged, goal }: { received: number; pledged: number; goal: number | null }) {
  const pct = goal ? Math.min(100, Math.round((received / goal) * 100)) : null;
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
        <span>
          <span className="font-semibold">{received}</span>
          {goal ? ` of ${goal}` : ""} books received
        </span>
        {pledged > 0 && <span className="text-xs text-muted">{pledged} more on the way</span>}
      </div>
      {pct != null && (
        <div
          className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
          aria-label="Progress towards goal"
        >
          <div className="h-full rounded-full bg-brand transition-[width] duration-500" style={{ width: `${pct}%` }} />
        </div>
      )}
    </div>
  );
}

export function tally(donations: { status: string; quantity: number }[]) {
  let received = 0;
  let pledged = 0;
  for (const d of donations) {
    if (d.status === "RECEIVED") received += d.quantity;
    else if (d.status === "PLEDGED" || d.status === "SCHEDULED") pledged += d.quantity;
  }
  return { received, pledged };
}
