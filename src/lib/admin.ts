// Shared helpers for the admin console and the moderator dashboard (PRD 5.3, 5.4, Phase 6).
// Server only: callers must check the role before using the mutation helpers.

import type { Prisma, ReportStatus, Role } from "@prisma/client";
import { prisma } from "./prisma";
import { audit } from "./audit";
import { notify } from "./notify";

export const PAGE_SIZE = 20;

export type ActionResult = { error?: string; success?: string };

export function pageFrom(v: string | string[] | undefined) {
  const n = Number(Array.isArray(v) ? v[0] : v);
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function str(v: string | string[] | undefined) {
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

/** Pick a value only if it is one of the allowed options. */
export function oneOf<T extends string>(v: string | string[] | undefined, options: readonly T[]): T | undefined {
  const s = str(v);
  return (options as readonly string[]).includes(s) ? (s as T) : undefined;
}

export function fmtDate(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function fmtDateTime(d: Date | null | undefined) {
  if (!d) return "";
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export function humanize(s: string) {
  const t = s.replace(/_/g, " ").toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}

export function pct(part: number, whole: number) {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "n/a";
}

export const OPEN_REPORT_STATUSES: ReportStatus[] = ["OPEN", "UNDER_REVIEW", "ESCALATED"];

// ───────────────────────── Moderator scope ─────────────────────────

/**
 * Which reports a moderator may see and act on.
 * Admins see everything. Moderators see reports in their communities,
 * or unassigned reports if they have no communities yet.
 */
export async function moderatorScope(user: { id: string; role: Role }) {
  if (user.role === "ADMIN") {
    const communities = await prisma.community.findMany({ select: { id: true, name: true, city: true }, orderBy: { name: "asc" } });
    return { isAdmin: true, communities, reportWhere: {} as Prisma.ReportWhereInput };
  }
  const communities = await prisma.community.findMany({
    where: { moderators: { some: { id: user.id } } },
    select: { id: true, name: true, city: true },
    orderBy: { name: "asc" },
  });
  const ids = communities.map((c) => c.id);
  const reportWhere: Prisma.ReportWhereInput = ids.length > 0 ? { communityId: { in: ids } } : { communityId: null };
  return { isAdmin: false, communities, reportWhere };
}

// ───────────────────────── Moderation helpers ─────────────────────────

/** Remove a listing (soft), record the moderation action, notify the owner and audit. */
export async function removeListingAsModerator(actorId: string, listingId: string, reason: string, auditAction = "LISTING_REMOVED_BY_ADMIN"): Promise<ActionResult> {
  const listing = await prisma.bookListing.findUnique({
    where: { id: listingId },
    select: { id: true, ownerId: true, status: true, book: { select: { title: true } } },
  });
  if (!listing) return { error: "That listing no longer exists." };
  if (listing.status === "REMOVED") return { error: "That listing is already removed." };

  await prisma.$transaction([
    prisma.bookListing.update({ where: { id: listingId }, data: { status: "REMOVED", removedAt: new Date() } }),
    prisma.moderationAction.create({
      data: { actorId, targetUserId: listing.ownerId, action: "REMOVE_LISTING", reason, entityType: "BookListing", entityId: listingId },
    }),
  ]);
  await notify({
    userId: listing.ownerId,
    type: "ACCOUNT",
    title: `Your listing "${listing.book.title}" was removed`,
    body: `A moderator removed it. Reason: ${reason}`,
    link: "/activity?tab=books",
  });
  await audit({ actorId, action: auditAction, entityType: "BookListing", entityId: listingId, metadata: { reason, title: listing.book.title, previousStatus: listing.status } });
  return { success: "Listing removed." };
}

/** Hide a review from profiles and averages. */
export async function removeReviewAsModerator(actorId: string, reviewId: string, reason: string): Promise<ActionResult> {
  const review = await prisma.review.findUnique({ where: { id: reviewId }, select: { id: true, reviewerId: true, removedAt: true } });
  if (!review) return { error: "That review no longer exists." };
  if (review.removedAt) return { error: "That review is already removed." };
  await prisma.$transaction([
    prisma.review.update({ where: { id: reviewId }, data: { removedAt: new Date(), removedById: actorId } }),
    prisma.moderationAction.create({
      data: { actorId, targetUserId: review.reviewerId, action: "REMOVE_REVIEW", reason, entityType: "Review", entityId: reviewId },
    }),
  ]);
  await audit({ actorId, action: "REVIEW_REMOVED", entityType: "Review", entityId: reviewId, metadata: { reason } });
  return { success: "Review removed." };
}

export const REPORT_OPS = ["UNDER_REVIEW", "ESCALATE", "DISMISS", "RESOLVE"] as const;
export type ReportOp = (typeof REPORT_OPS)[number];

const OP_STATUS: Record<ReportOp, ReportStatus> = {
  UNDER_REVIEW: "UNDER_REVIEW",
  ESCALATE: "ESCALATED",
  DISMISS: "DISMISSED",
  RESOLVE: "RESOLVED",
};

const OP_AUDIT: Record<ReportOp, string> = {
  UNDER_REVIEW: "REPORT_UNDER_REVIEW",
  ESCALATE: "REPORT_ESCALATED",
  DISMISS: "REPORT_DISMISSED",
  RESOLVE: "REPORT_RESOLVED",
};

/** Change a report's status, record a ModerationAction and audit it. */
export async function applyReportOp(actorId: string, reportId: string, op: ReportOp, note: string | undefined) {
  const report = await prisma.report.findUnique({
    where: { id: reportId },
    select: {
      id: true,
      status: true,
      target: true,
      reportedUserId: true,
      listing: { select: { ownerId: true } },
      review: { select: { reviewerId: true } },
      message: { select: { senderId: true } },
    },
  });
  if (!report) return { ok: false as const, error: "That report no longer exists." };
  if (report.status === "RESOLVED" || report.status === "DISMISSED") return { ok: false as const, error: "That report is already closed." };

  const closing = op === "RESOLVE" || op === "DISMISS";
  const targetUserId = report.reportedUserId ?? report.listing?.ownerId ?? report.review?.reviewerId ?? report.message?.senderId ?? null;
  await prisma.$transaction([
    prisma.report.update({
      where: { id: reportId },
      data: {
        status: OP_STATUS[op],
        handledById: actorId,
        ...(note ? { resolution: note } : {}),
        ...(closing ? { resolvedAt: new Date() } : {}),
      },
    }),
    prisma.moderationAction.create({
      data: { actorId, targetUserId, action: OP_AUDIT[op], reason: note || null, entityType: "Report", entityId: reportId },
    }),
  ]);
  await audit({ actorId, action: OP_AUDIT[op], entityType: "Report", entityId: reportId, metadata: { from: report.status, to: OP_STATUS[op], note: note ?? null } });

  if (op === "ESCALATE") {
    const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
    await Promise.all(
      admins
        .filter((a) => a.id !== actorId)
        .map((a) =>
          notify({
            userId: a.id,
            type: "ACCOUNT",
            title: "A report was escalated to admins",
            body: note ? `Note: ${note}` : `A ${report.target.toLowerCase()} report needs an admin decision.`,
            link: "/admin/reports?status=ESCALATED",
          }),
        ),
    );
  }
  return { ok: true as const, targetUserId };
}

/** Load the report and everything needed to show the reported content inline. */
export const reportInclude = {
  reporter: { select: { username: true, name: true } },
  reportedUser: { select: { id: true, username: true, name: true, status: true, role: true } },
  listing: { select: { id: true, status: true, ownerId: true, book: { select: { title: true, author: true } }, owner: { select: { username: true } } } },
  message: { select: { id: true, body: true, type: true, deletedAt: true, sender: { select: { username: true } } } },
  review: { select: { id: true, rating: true, comment: true, removedAt: true, reviewer: { select: { username: true } }, reviewee: { select: { username: true } } } },
  community: { select: { name: true } },
  handledBy: { select: { username: true } },
} satisfies Prisma.ReportInclude;

export type ReportRow = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;
