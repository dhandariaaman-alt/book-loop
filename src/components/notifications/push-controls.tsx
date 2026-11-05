"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { sendTestNotificationAction } from "@/app/actions/notifications";

type Status = "checking" | "unsupported" | "unconfigured" | "blocked" | "enabled" | "off";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function getKey(): Promise<string | null> {
  try {
    const res = await fetch("/api/push/public-key", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as { key: string | null };
    return data.key;
  } catch {
    return null;
  }
}

const STATUS_TEXT: Record<Status, { text: string; tint: string }> = {
  checking: { text: "Checking this browser…", tint: "bg-surface-2" },
  unsupported: { text: "This browser doesn't support push notifications.", tint: "bg-surface-2" },
  unconfigured: { text: "Browser push isn't set up on this server yet.", tint: "bg-surface-2" },
  blocked: {
    text: "Notifications are blocked for this site. Allow them in your browser's site settings, then reload.",
    tint: "bg-rose",
  },
  enabled: { text: "Browser notifications are on for this device.", tint: "bg-mint" },
  off: { text: "Browser notifications are off for this device.", tint: "bg-butter" },
};

export function PushControls() {
  const [status, setStatus] = useState<Status>("checking");
  const [key, setKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testing, startTest] = useTransition();

  const refresh = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setStatus("unsupported");
      return;
    }
    const k = await getKey();
    setKey(k);
    if (!k) return setStatus("unconfigured");
    if (Notification.permission === "denied") return setStatus("blocked");
    const reg = await navigator.serviceWorker.getRegistration("/");
    const sub = await reg?.pushManager.getSubscription();
    setStatus(sub && Notification.permission === "granted" ? "enabled" : "off");
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function enable() {
    if (!key) return;
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      // Permission is only requested here, after the user clicks.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "blocked" : "off");
        return;
      }
      await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) });
      }
      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error("save failed");
      setStatus("enabled");
      setMsg({ ok: true, text: "Browser notifications are on." });
    } catch {
      setMsg({ ok: false, text: "We couldn't turn on notifications in this browser. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const reg = await navigator.serviceWorker.getRegistration("/");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        });
        await sub.unsubscribe();
      }
      setStatus("off");
    } catch {
      setMsg({ ok: false, text: "Couldn't turn off notifications. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  const s = STATUS_TEXT[status];
  const cannotEnable = busy || status === "checking" || status === "unsupported" || status === "unconfigured" || status === "blocked";

  return (
    <div className="space-y-3">
      <p className={`rounded-xl border border-border px-3 py-2 text-sm ${s.tint}`} role="status">
        {s.text}
      </p>
      <div className="flex flex-wrap gap-2">
        {status === "enabled" ? (
          <button type="button" className="btn-secondary" onClick={() => void disable()} disabled={busy} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Turn off on this device
          </button>
        ) : (
          <button type="button" className="btn-primary" onClick={() => void enable()} disabled={cannotEnable} aria-busy={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Enable browser notifications
          </button>
        )}
        <button
          type="button"
          className="btn-secondary"
          disabled={testing}
          aria-busy={testing}
          onClick={() =>
            startTest(async () => {
              const r = await sendTestNotificationAction();
              setMsg({ ok: r.ok, text: r.message });
            })
          }
        >
          {testing && <span className="spinner" aria-hidden="true" />}
          Send me a test notification
        </button>
      </div>
      {msg && (
        <p
          role={msg.ok ? "status" : "alert"}
          className={`animate-pop-in rounded-lg px-3 py-2 text-sm ${msg.ok ? "bg-success-soft text-success" : "bg-danger-soft text-danger"}`}
        >
          {msg.text}
        </p>
      )}
    </div>
  );
}
