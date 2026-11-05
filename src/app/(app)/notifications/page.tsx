import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { EmptyState, PageHeader } from "@/components/app/ui";
import { MarkAllReadButton, NotificationItem, type NotificationRow } from "@/components/notifications/notification-list";

export const metadata: Metadata = { title: "Notifications" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const me = await requireUser();
  const rows = await prisma.notification.findMany({
    where: { userId: me.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { id: true, type: true, title: true, body: true, link: true, readAt: true, createdAt: true },
  });

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const list: NotificationRow[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    link: n.link,
    read: n.readAt != null,
    createdAt: n.createdAt.toISOString(),
  }));
  const today = list.filter((_, i) => rows[i].createdAt >= startOfToday);
  const earlier = list.filter((_, i) => rows[i].createdAt < startOfToday);
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <PageHeader
        title="Notifications"
        note="what's new on your shelf"
        subtitle={unread > 0 ? `${unread} unread` : "You're all caught up."}
        actions={
          <>
            <MarkAllReadButton disabled={unread === 0} />
            <Link href="/settings/notifications" className="btn-ghost">
              Settings
            </Link>
          </>
        }
      />

      {list.length === 0 ? (
        <div className="mt-8">
          <EmptyState icon="inbox">
            <p className="font-medium text-fg">No notifications yet</p>
            <p className="mt-1">Requests, messages and reminders will show up here.</p>
          </EmptyState>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          {[
            { label: "Today", items: today },
            { label: "Earlier", items: earlier },
          ]
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.label} aria-labelledby={`n-${g.label}`}>
                <h2 id={`n-${g.label}`} className="mb-2 px-1 text-xs font-medium uppercase tracking-wider text-muted">
                  {g.label}
                </h2>
                <ul className="card divide-y divide-border overflow-hidden">
                  {g.items.map((n) => (
                    <NotificationItem key={n.id} n={n} />
                  ))}
                </ul>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
