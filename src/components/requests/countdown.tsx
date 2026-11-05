"use client";

import { useEffect, useState } from "react";

function left(ms: number) {
  if (ms <= 0) return "expired";
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h left`;
  if (h > 0) return `${h}h ${m}m left`;
  return `${Math.max(1, m)}m left`;
}

/** "1d 4h left" style countdown, ticking every 30 seconds. */
export function Countdown({ to, serverNow }: { to: string; serverNow: number }) {
  const target = new Date(to).getTime();
  const [now, setNow] = useState(serverNow);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);
  const ms = target - now;
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border border-border px-2 py-0.5 font-mono text-xs ${
        ms < 6 * 3600_000 ? "bg-butter" : "bg-surface"
      }`}
    >
      {left(ms)}
    </span>
  );
}
