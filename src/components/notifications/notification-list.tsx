"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NotificationType } from "@prisma/client";
import { Icon, type IconKind } from "@/components/app/ui";
import { markAllNotificationsReadAction, markNotificationReadAction } from "@/app/actions/notifications";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const TYPE_ICON: Record<NotificationType, { icon: IconKind; tint: string }> = {
  REQUEST_RECEIVED: { icon: "inbox", tint: "bg-peach" },
  REQUEST_ACCEPTED: { icon: "heart", tint: "bg-mint" },
  REQUEST_REJECTED: { icon: "book", tint: "bg-surface-2" },
  EXCHANGE_OFFER: { icon: "swap", tint: "bg-lavender" },
  RESERVATION_CONFIRMED: { icon: "pin", tint: "bg-mint" },
  RESERVATION_EXPIRED: { icon: "clock", tint: "bg-butter" },
  NEW_MESSAGE: { icon: "chat", tint: "bg-sky" },
  RETURN_REMINDER: { icon: "clock", tint: "bg-butter" },
  OVERDUE: { icon: "clock", tint: "bg-rose" },
  TRANSACTION_COMPLETED: { icon: "leaf", tint: "bg-mint" },
  DONATION_UPDATE: { icon: "heart", tint: "bg-rose" },
  DISPUTE_UPDATE: { icon: "compass", tint: "bg-peach" },
  ACCOUNT: { icon: "user", tint: "bg-lavender" },
};

function when(iso: string) {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24 && d.toDateString() === new Date().toDateString()) return `${hrs} h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

export function NotificationItem({ n }: { n: NotificationRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { icon, tint } = TYPE_ICON[n.type];

  return (
    <li>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const link = await markNotificationReadAction(n.id);
            if (link && link.startsWith("/") && !link.startsWith("//")) router.push(link);
            router.refresh();
          })
        }
        className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-2/70 focus-visible:bg-surface-2 focus-visible:outline-none disabled:opacity-70 ${
          n.read ? "" : "bg-brand-soft/40"
        }`}
      >
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl p-1.5 text-brand ${tint}`}>
          <Icon kind={icon} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block [overflow-wrap:anywhere] ${n.read ? "text-fg" : "font-semibold text-fg"}`}>
            {!n.read && <span className="sr-only">Unread: </span>}
            {n.title}
          </span>
          {n.body && <span className="mt-0.5 line-clamp-2 block text-sm text-muted [overflow-wrap:anywhere]">{n.body}</span>}
          <span className="mt-1 block text-xs text-muted" suppressHydrationWarning>
            {when(n.createdAt)}
          </span>
        </span>
        {!n.read && <span className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />}
        {pending && <span className="spinner mt-1.5" aria-hidden="true" />}
      </button>
    </li>
  );
}

export function MarkAllReadButton({ disabled }: { disabled?: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="btn-secondary"
      disabled={disabled || pending}
      aria-busy={pending}
      onClick={() =>
        start(async () => {
          await markAllNotificationsReadAction();
          router.refresh();
        })
      }
    >
      {pending && <span className="spinner" aria-hidden="true" />}
      Mark all as read
    </button>
  );
}
