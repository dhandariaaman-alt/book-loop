"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ReportButton } from "@/components/trust/report-button";
import { sendMessageAction } from "@/app/actions/messages";
import { Composer, type Outgoing } from "./composer";
import { formatDuration, messagePreview, type ChatMessage } from "./types";

type LocalMessage = ChatMessage & { pending?: boolean };

type Props = {
  conversationId: string;
  meId: string;
  otherName: string;
  otherUserId: string;
  initialMessages: ChatMessage[];
  initialSeenUpTo: string | null;
  initialBlocked: boolean;
  iBlocked: boolean;
};

const POLL_MS = 4000;

function merge(list: LocalMessage[], incoming: ChatMessage[]): LocalMessage[] {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) byId.set(m.id, { ...byId.get(m.id), ...m, pending: false });
  return [...byId.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

function nearBottom() {
  return window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 240;
}

export function ChatThread({
  conversationId,
  meId,
  otherName,
  initialMessages,
  initialSeenUpTo,
  initialBlocked,
  iBlocked,
}: Props) {
  const [messages, setMessages] = useState<LocalMessage[]>(initialMessages);
  const [seenUpTo, setSeenUpTo] = useState<string | null>(initialSeenUpTo);
  const [blocked, setBlocked] = useState(initialBlocked);
  const [announce, setAnnounce] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);
  // Before hydration, format dates in a fixed zone so server and client HTML match.
  const [mounted, setMounted] = useState(false);

  const inFlight = useRef(0);
  const lastId = useRef<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const tmpSeq = useRef(0);

  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
    const last = [...messages].reverse().find((m) => !m.pending);
    lastId.current = last?.id ?? null;
  }, [messages]);

  useEffect(() => {
    setMounted(true);
    endRef.current?.scrollIntoView({ block: "end" });
  }, []);

  const scrollToEnd = useCallback((smooth = true) => {
    requestAnimationFrame(() => endRef.current?.scrollIntoView({ block: "end", behavior: smooth ? "smooth" : "auto" }));
  }, []);

  // Poll for new messages every few seconds while the tab is visible.
  useEffect(() => {
    let cancelled = false;
    let busy = false;
    async function tick() {
      if (cancelled || busy || inFlight.current > 0 || document.visibilityState !== "visible") return;
      busy = true;
      try {
        const q = lastId.current ? `?after=${encodeURIComponent(lastId.current)}` : "";
        const res = await fetch(`/api/messages/${conversationId}${q}`, { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { messages: ChatMessage[]; seenUpTo: string | null; blocked: boolean };
        setSeenUpTo(data.seenUpTo);
        setBlocked(data.blocked);
        if (data.messages.length > 0) {
          const stick = nearBottom();
          const known = new Set(messagesRef.current.map((m) => m.id));
          const fresh = data.messages.filter((m) => !known.has(m.id) && m.senderId !== meId);
          if (fresh.length > 0) {
            setAnnounce(
              fresh.length === 1
                ? `New message from ${otherName}: ${messagePreview(fresh[0])}`
                : `${fresh.length} new messages from ${otherName}`,
            );
          }
          setMessages((prev) => merge(prev, data.messages));
          if (stick) scrollToEnd();
        }
      } catch {
        // Offline or server restarting; try again next tick.
      } finally {
        busy = false;
      }
    }
    const timer = window.setInterval(tick, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, meId, otherName, scrollToEnd]);

  const send = useCallback(
    async (out: Outgoing): Promise<boolean> => {
      setError(null);
      const tmpId = `tmp-${++tmpSeq.current}`;
      const optimistic: LocalMessage = {
        id: tmpId,
        senderId: meId,
        type: out.type,
        body: out.body ?? null,
        mediaUrl: out.previewUrl ?? null,
        durationSec: out.durationSec ?? null,
        readAt: null,
        createdAt: new Date().toISOString(),
        pending: true,
      };
      setMessages((prev) => [...prev, optimistic]);
      scrollToEnd();

      const fd = new FormData();
      fd.set("conversationId", conversationId);
      fd.set("type", out.type);
      if (out.body) fd.set("body", out.body);
      if (out.file) fd.set("file", out.file);
      if (out.durationSec) fd.set("durationSec", String(out.durationSec));

      inFlight.current += 1;
      try {
        const res = await sendMessageAction(fd);
        if (!res.ok) {
          setMessages((prev) => prev.filter((m) => m.id !== tmpId));
          setError(res.error);
          return false;
        }
        setMessages((prev) => merge(prev.filter((m) => m.id !== tmpId), [res.message]));
        return true;
      } catch {
        setMessages((prev) => prev.filter((m) => m.id !== tmpId));
        setError("Your message didn't send. Check your connection and try again.");
        return false;
      } finally {
        inFlight.current -= 1;
      }
    },
    [conversationId, meId, scrollToEnd],
  );

  // Open/close the photo viewer.
  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (lightbox && !d.open) d.showModal();
    if (!lightbox && d.open) d.close();
  }, [lightbox]);

  const tz = mounted ? undefined : "Asia/Kolkata";
  const groups = useMemo(() => groupByDay(messages, tz), [messages, tz]);
  const myLast = [...messages].reverse().find((m) => m.senderId === meId && !m.pending);
  const seenId = myLast && seenUpTo && myLast.createdAt <= seenUpTo ? myLast.id : null;

  return (
    <div className="mt-4">
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announce}
      </div>

      <section aria-label={`Conversation with ${otherName}`} className="space-y-6">
        {messages.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border bg-surface-2/70 px-4 py-8 text-center text-sm text-muted">
            <p className="font-hand text-2xl text-accent">say hello</p>
            <p className="mt-1">No messages yet. Introduce yourself and plan a safe hand-off.</p>
          </div>
        )}

        {groups.map((g) => (
          <div key={g.key}>
            <div className="sticky top-16 z-10 flex justify-center py-2">
              <span className="rounded-full border border-border bg-surface/95 px-3 py-0.5 text-xs text-muted backdrop-blur" suppressHydrationWarning>
                {g.label}
              </span>
            </div>
            <ol className="space-y-2">
              {g.items.map((m) => {
                const mine = m.senderId === meId;
                return (
                  <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed sm:max-w-[75%] ${
                        mine
                          ? "rounded-br-md bg-brand-soft text-fg"
                          : "rounded-bl-md border border-border bg-surface text-fg"
                      } ${m.pending ? "opacity-70" : ""}`}
                    >
                      <span className="sr-only">{mine ? "You:" : `${otherName}:`} </span>
                      <Body m={m} onOpenImage={setLightbox} />
                    </div>
                    <div className={`mt-0.5 flex items-center gap-2 px-1 text-[11px] text-muted ${mine ? "flex-row-reverse" : ""}`}>
                      <time dateTime={m.createdAt} suppressHydrationWarning>
                        {m.pending ? "Sending…" : timeOf(m.createdAt, tz)}
                      </time>
                      {mine && seenId === m.id && <span className="font-medium text-brand">Seen</span>}
                      {!mine && !m.pending && (
                        <ReportButton
                          target="MESSAGE"
                          targetId={m.id}
                          reportedUserId={m.senderId}
                          label="Report"
                          className="text-[11px] text-muted underline-offset-2 hover:text-danger hover:underline"
                        />
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
        <div ref={endRef} className="scroll-mb-56" />
      </section>

      <div className="sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-20 mt-4 lg:bottom-4">
        {error && (
          <p role="alert" className="animate-pop-in mb-2 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {error}
          </p>
        )}
        {blocked ? (
          <div className="card bg-surface-2 p-4 text-center text-sm text-muted" role="status">
            {iBlocked
              ? `You blocked ${otherName}. Unblock them from the menu above to send messages.`
              : "You can't send messages in this conversation."}
          </div>
        ) : (
          <Composer onSend={send} onError={setError} />
        )}
      </div>

      <dialog
        ref={dialogRef}
        onClose={() => setLightbox(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setLightbox(null);
        }}
        className="m-auto max-h-[92vh] max-w-[94vw] rounded-2xl border border-border bg-surface p-2 backdrop:bg-black/70"
        aria-label="Photo"
      >
        {lightbox && (
          <div className="relative">
            <img src={lightbox} alt="Shared photo, full size" className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" />
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="btn-secondary absolute right-2 top-2 px-3 py-1.5 text-xs"
              autoFocus
            >
              Close
            </button>
          </div>
        )}
      </dialog>
    </div>
  );
}

function Body({ m, onOpenImage }: { m: LocalMessage; onOpenImage: (url: string) => void }) {
  if (m.type === "IMAGE") {
    return (
      <>
        {m.mediaUrl && (
          <button
            type="button"
            onClick={() => onOpenImage(m.mediaUrl!)}
            className="block overflow-hidden rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            aria-label="Open photo full size"
          >
            <img src={m.mediaUrl} alt="Shared photo" className="max-h-72 w-auto max-w-full object-cover" loading="lazy" />
          </button>
        )}
        {m.body && <p className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>}
      </>
    );
  }
  if (m.type === "VOICE") {
    return (
      <div className="flex flex-col gap-1">
        {m.mediaUrl && (
          <audio controls preload="metadata" src={m.mediaUrl} className="h-10 w-56 max-w-full sm:w-64">
            Your browser can&apos;t play this voice message.
          </audio>
        )}
        <span className="text-xs text-muted">Voice message{m.durationSec ? ` · ${formatDuration(m.durationSec)}` : ""}</span>
      </div>
    );
  }
  return <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>;
}

function dayKey(iso: string, tz?: string) {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
}

function timeOf(iso: string, tz?: string) {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: tz });
}

function groupByDay(list: LocalMessage[], tz?: string) {
  const now = new Date();
  const today = dayKey(now.toISOString(), tz);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString(), tz);
  const groups: { key: string; label: string; items: LocalMessage[] }[] = [];
  for (const m of list) {
    const key = dayKey(m.createdAt, tz);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) {
      const d = new Date(m.createdAt);
      const label =
        key === today
          ? "Today"
          : key === yesterday
            ? "Yesterday"
            : d.toLocaleDateString("en-IN", {
                weekday: "short",
                day: "numeric",
                month: "short",
                year: d.getFullYear() === now.getFullYear() ? undefined : "numeric",
                timeZone: tz,
              });
      g = { key, label, items: [] };
      groups.push(g);
    }
    g.items.push(m);
  }
  return groups;
}
