"use client";

import { useState, useTransition } from "react";
import type { NotificationChannel, NotificationType } from "@prisma/client";
import { setNotificationPreferenceAction } from "@/app/actions/notifications";

export type PrefRow = { type: NotificationType; label: string; values: Record<NotificationChannel, boolean> };

const CHANNELS: { key: NotificationChannel; label: string }[] = [
  { key: "IN_APP", label: "In-app" },
  { key: "EMAIL", label: "Email" },
  { key: "PUSH", label: "Push" },
  { key: "SMS", label: "SMS" },
];

/** In-app is always kept, and important account notices always go by email (see lib/notify). */
function locked(type: NotificationType, channel: NotificationChannel) {
  return channel === "IN_APP" || (type === "ACCOUNT" && channel === "EMAIL");
}

type Values = Record<NotificationType, Record<NotificationChannel, boolean>>;

export function PreferenceGrid({ rows }: { rows: PrefRow[] }) {
  const [state, setState] = useState<Values>(() => Object.fromEntries(rows.map((r) => [r.type, r.values])) as Values);
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();

  function toggle(type: NotificationType, channel: NotificationChannel, enabled: boolean) {
    setError(null);
    setState((s) => ({ ...s, [type]: { ...s[type], [channel]: enabled } }));
    start(async () => {
      const res = await setNotificationPreferenceAction(type, channel, enabled).catch(() => ({
        ok: false,
        error: "Couldn't save. Try again.",
      }));
      if (!res.ok) {
        setState((s) => ({ ...s, [type]: { ...s[type], [channel]: !enabled } }));
        setError(res.error ?? "Couldn't save. Try again.");
      }
    });
  }

  return (
    <div>
      <div
        className="hidden grid-cols-[minmax(0,1fr)_repeat(4,4.25rem)] items-center gap-2 border-b border-border px-4 pb-2 text-xs font-medium uppercase tracking-wider text-muted sm:grid"
        aria-hidden="true"
      >
        <span>Notify me about</span>
        {CHANNELS.map((c) => (
          <span key={c.key} className="text-center">
            {c.label}
          </span>
        ))}
      </div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.type} className="px-4 py-3 sm:grid sm:grid-cols-[minmax(0,1fr)_repeat(4,4.25rem)] sm:items-center sm:gap-2">
            <p className="text-sm font-medium" id={`pref-${r.type}`}>
              {r.label}
            </p>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:contents" role="group" aria-labelledby={`pref-${r.type}`}>
              {CHANNELS.map((c) => {
                const isLocked = locked(r.type, c.key);
                const on = isLocked ? true : state[r.type][c.key];
                return (
                  <label
                    key={c.key}
                    className={`flex flex-col items-center gap-1 text-[11px] text-muted sm:justify-center ${
                      isLocked ? "cursor-not-allowed" : "cursor-pointer"
                    }`}
                  >
                    <span className="sm:sr-only">{c.label}</span>
                    <input
                      type="checkbox"
                      role="switch"
                      className="peer sr-only"
                      checked={on}
                      disabled={isLocked}
                      aria-label={`${r.label}: ${c.label}${isLocked ? " (always on)" : ""}`}
                      onChange={(e) => toggle(r.type, c.key, e.target.checked)}
                    />
                    <span
                      aria-hidden="true"
                      className={`relative inline-flex h-6 w-10 shrink-0 rounded-full border transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-brand/60 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface ${
                        on ? "border-brand bg-brand" : "border-border bg-surface-2"
                      } ${isLocked ? "opacity-50" : ""}`}
                    >
                      <span
                        className={`absolute top-0.5 h-[1.125rem] w-[1.125rem] rounded-full bg-surface shadow transition-transform duration-200 ${
                          on ? "translate-x-[1.05rem]" : "translate-x-0.5"
                        }`}
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="mx-4 mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      )}
      <p className="px-4 pt-3 text-xs text-muted">
        In-app notifications are always kept, and important account notices always go by email too.
      </p>
    </div>
  );
}
