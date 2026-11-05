"use client";

import { useState, useTransition } from "react";
import { clearLocationAction, saveLocationAction } from "@/app/actions/profile";

type Props = { hasLocation: boolean; neighbourhood: string | null; city: string | null; updatedAt: string | null };

export function LocationCard({ hasLocation, neighbourhood, city }: Props) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "error" | "info"; text: string } | null>(null);

  function share() {
    setStatus(null);
    if (!("geolocation" in navigator)) {
      setStatus({ kind: "error", text: "Your browser doesn't support location. Enter your neighbourhood below instead." });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        startTransition(async () => {
          const res = await saveLocationAction(pos.coords.latitude, pos.coords.longitude);
          if (!res.ok) setStatus({ kind: "error", text: res.error });
          else if (!res.neighbourhood) setStatus({ kind: "info", text: "Location saved. We couldn't name your area, so please type your neighbourhood below." });
        }),
      (err) =>
        setStatus({
          kind: "error",
          text:
            err.code === err.PERMISSION_DENIED
              ? "Location access was blocked. Nearby discovery needs your approximate location. Allow it in your browser's site settings and try again."
              : "We couldn't get your location. Please try again.",
        }),
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 10 * 60_000 },
    );
  }

  return (
    <section className="card p-6" aria-labelledby="loc-heading">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-md">
          <h2 id="loc-heading" className="text-lg font-semibold">Your area</h2>
          {hasLocation ? (
            <p className="mt-1 text-sm">
              <span aria-hidden>📍 </span>
              {[neighbourhood, city].filter(Boolean).join(", ") || "Location saved"}
            </p>
          ) : (
            <p className="mt-1 text-sm text-muted">Share your location to see books within 1, 5 or 10 km of you.</p>
          )}
          <p className="mt-2 text-xs text-muted">
            We store a rounded location (about 100 m) and never show it to anyone. Other readers only see your
            neighbourhood and an approximate distance.
          </p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={share} disabled={pending} className={hasLocation ? "btn-secondary" : "btn-primary"}>
            {pending ? "Saving…" : hasLocation ? "Update location" : "Use my location"}
          </button>
          {hasLocation && (
            <button type="button" disabled={pending} onClick={() => startTransition(() => clearLocationAction())} className="btn-ghost">
              Remove
            </button>
          )}
        </div>
      </div>
      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={`mt-4 rounded-lg px-3 py-2.5 text-sm ${status.kind === "error" ? "bg-danger-soft text-danger" : "bg-brand-soft text-brand"}`}
        >
          {status.text}
        </p>
      )}
    </section>
  );
}
