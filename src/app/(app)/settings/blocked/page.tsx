import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { EmptyState, PageHeader, Panel } from "@/components/app/ui";
import { BlockButton } from "@/components/trust/block-button";

export const metadata: Metadata = { title: "Blocked members" };

export default async function BlockedPage() {
  const me = await requireUser();
  const blocks = await prisma.block.findMany({
    where: { blockerId: me.id },
    orderBy: { createdAt: "desc" },
    select: {
      createdAt: true,
      blocked: { select: { id: true, name: true, username: true, image: true } },
    },
  });

  return (
    <div className="min-w-0">
      <PageHeader
        title="Blocked members"
        subtitle="People you've blocked can't message you or request your books, and you won't see each other's listings."
        actions={
          <Link href="/settings/profile" className="btn-secondary">
            Back to settings
          </Link>
        }
      />
      <div className="mt-6">
        <Panel title={`Blocked (${blocks.length})`} tint="lavender" icon="user">
          {blocks.length === 0 ? (
            <EmptyState icon="leaf">You haven&apos;t blocked anyone. Nice and peaceful.</EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {blocks.map((b) => (
                <li key={b.blocked.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <Link href={`/u/${b.blocked.username}`} className="flex min-w-0 items-center gap-3 hover:underline">
                    <Avatar name={b.blocked.name ?? b.blocked.username} image={b.blocked.image} size={40} />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{b.blocked.name ?? b.blocked.username}</span>
                      <span className="block truncate text-xs text-muted">
                        @{b.blocked.username} · blocked {b.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </span>
                  </Link>
                  <BlockButton
                    userId={b.blocked.id}
                    username={b.blocked.username}
                    initiallyBlocked
                    className="btn-secondary !px-3 !py-1.5 text-sm"
                  />
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
