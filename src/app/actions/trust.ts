"use server";

// Trust & safety actions (PRD Phase 5): reports, blocks, reviews and disputes.
// Every action re-checks who the caller is and what they may touch.

import { revalidatePath } from "next/cache";
import type { DisputeKind, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { audit } from "@/lib/audit";
import { DISPUTE_KINDS, REPORT_REASONS, canOpenDispute, disputeKindLabel } from "@/lib/trust-labels";
import type { FormState } from "./auth";

export type ActionResult = { error?: string; success?: string };

async function adminIds(): Promise<string[]> {
  const admins = await prisma.user.findMany({ where: { role: "ADMIN", status: "ACTIVE" }, select: { id: true } });
  return admins.map((a) => a.id);
}

// ─────────────────────────────── Reports ───────────────────────────────

type ReportInput = {
  target: "USER" | "LISTING" | "MESSAGE" | "REVIEW";
  targetId: string;
  reason: string;
  details?: string;
};

export async function reportAction(input: ReportInput): Promise<ActionResult> {
  const me = await requireUser();

  const target = input?.target;
  const targetId = typeof input?.targetId === "string" ? input.targetId.trim() : "";
  if (!["USER", "LISTING", "MESSAGE", "REVIEW"].includes(target) || !targetId || targetId.length > 64) {
    return { error: "We couldn't tell what you're reporting. Please refresh and try again." };
  }
  if (!REPORT_REASONS.includes(input.reason as (typeof REPORT_REASONS)[number])) {
    return { error: "Please pick a reason." };
  }
  const details = (typeof input.details === "string" ? input.details : "").trim();
  if (details.length > 1000) return { error: "Please keep the details under 1000 characters." };
  if (input.reason === "Other" && details.length < 5) return { error: "Please tell us a little about what's wrong." };

  if (!rateLimit(`report:${me.id}`, 10, 60 * 60_000)) {
    return { error: "You've sent a lot of reports recently. Please try again in a while." };
  }

  // Work out who is being reported, and which community it belongs to, from
  // the database rather than trusting the browser.
  let reportedUserId: string | null = null;
  let communityId: string | null = null;
  const link: Prisma.ReportUncheckedCreateInput = {
    reporterId: me.id,
    target,
    reason: "",
  };

  if (target === "USER") {
    const u = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, profile: { select: { communityId: true } } },
    });
    if (!u) return { error: "That member no longer exists." };
    reportedUserId = u.id;
    communityId = u.profile?.communityId ?? null;
  } else if (target === "LISTING") {
    const l = await prisma.bookListing.findUnique({
      where: { id: targetId },
      select: { id: true, ownerId: true, communityId: true, owner: { select: { profile: { select: { communityId: true } } } } },
    });
    if (!l) return { error: "That listing no longer exists." };
    reportedUserId = l.ownerId;
    communityId = l.communityId ?? l.owner.profile?.communityId ?? null;
    link.listingId = l.id;
  } else if (target === "MESSAGE") {
    const m = await prisma.message.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        senderId: true,
        conversation: { select: { userAId: true, userBId: true } },
        sender: { select: { profile: { select: { communityId: true } } } },
      },
    });
    // Only people in the conversation can report a message in it.
    if (!m || (m.conversation.userAId !== me.id && m.conversation.userBId !== me.id)) {
      return { error: "That message isn't available." };
    }
    reportedUserId = m.senderId;
    communityId = m.sender.profile?.communityId ?? null;
    link.messageId = m.id;
  } else {
    const r = await prisma.review.findUnique({
      where: { id: targetId },
      select: { id: true, reviewerId: true, removedAt: true, reviewer: { select: { profile: { select: { communityId: true } } } } },
    });
    if (!r || r.removedAt) return { error: "That review isn't available." };
    reportedUserId = r.reviewerId;
    communityId = r.reviewer.profile?.communityId ?? null;
    link.reviewId = r.id;
  }

  if (reportedUserId === me.id) return { error: "You can't report yourself." };

  const duplicate = await prisma.report.findFirst({
    where: {
      reporterId: me.id,
      target,
      status: "OPEN",
      ...(target === "USER" ? { reportedUserId } : {}),
      ...(target === "LISTING" ? { listingId: targetId } : {}),
      ...(target === "MESSAGE" ? { messageId: targetId } : {}),
      ...(target === "REVIEW" ? { reviewId: targetId } : {}),
    },
    select: { id: true },
  });
  if (duplicate) return { success: "You've already reported this. Our moderators will take a look." };

  const reason = (details ? `${input.reason}: ${details}` : input.reason).slice(0, 1000);
  const report = await prisma.report.create({
    data: { ...link, reason, reportedUserId, communityId },
    select: { id: true },
  });
  await audit({ actorId: me.id, action: "REPORT_CREATED", entityType: "Report", entityId: report.id, metadata: { target } });

  revalidatePath("/admin");
  return { success: "Thanks. Our moderators will take a look." };
}

// ─────────────────────────────── Blocks ───────────────────────────────

export async function setBlockAction(userId: string, block: boolean): Promise<ActionResult & { blocked?: boolean }> {
  const me = await requireUser();
  if (typeof userId !== "string" || !userId) return { error: "Something went wrong. Please refresh and try again." };
  if (userId === me.id) return { error: "You can't block yourself." };
  if (!rateLimit(`block:${me.id}`, 30, 60 * 60_000)) return { error: "Too many changes. Please try again later." };

  const other = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, username: true } });
  if (!other) return { error: "That member no longer exists." };

  if (block) {
    await prisma.block.upsert({
      where: { blockerId_blockedId: { blockerId: me.id, blockedId: other.id } },
      create: { blockerId: me.id, blockedId: other.id },
      update: {},
    });
  } else {
    await prisma.block.deleteMany({ where: { blockerId: me.id, blockedId: other.id } });
  }
  await audit({ actorId: me.id, action: block ? "USER_BLOCKED" : "USER_UNBLOCKED", entityType: "User", entityId: other.id });

  revalidatePath("/settings/blocked");
  revalidatePath(`/u/${other.username}`);
  revalidatePath("/discover");
  revalidatePath("/messages");
  return { blocked: block, success: block ? `You blocked @${other.username}.` : `You unblocked @${other.username}.` };
}

// ─────────────────────────────── Reviews ───────────────────────────────

export async function submitReviewAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").trim();

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { error: "Please choose 1 to 5 stars." };
  if (comment.length > 1000) return { error: "Please keep your review under 1000 characters." };
  if (!rateLimit(`review:${me.id}`, 20, 60 * 60_000)) return { error: "Too many reviews at once. Please try again later." };

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: { id: true, status: true, ownerId: true, receiverId: true, listing: { select: { book: { select: { title: true } } } } },
  });
  if (!tx || (tx.ownerId !== me.id && tx.receiverId !== me.id)) return { error: "You can only review hand-offs you were part of." };
  if (tx.status !== "COMPLETED") return { error: "You can leave a review once the hand-off is completed." };

  const revieweeId = tx.ownerId === me.id ? tx.receiverId : tx.ownerId;
  const existing = await prisma.review.findUnique({
    where: { transactionId_reviewerId: { transactionId: tx.id, reviewerId: me.id } },
    select: { id: true },
  });
  if (existing) return { error: "You've already reviewed this hand-off." };

  try {
    await prisma.review.create({
      data: { transactionId: tx.id, reviewerId: me.id, revieweeId, rating, comment: comment || null },
    });
  } catch {
    return { error: "You've already reviewed this hand-off." };
  }

  await notify({
    userId: revieweeId,
    type: "TRANSACTION_COMPLETED",
    title: `You got a ${rating}-star review`,
    body: `For "${tx.listing.book.title}".`,
    link: `/transactions/${tx.id}`,
  });

  const reviewee = await prisma.user.findUnique({ where: { id: revieweeId }, select: { username: true } });
  revalidatePath(`/transactions/${tx.id}`);
  if (reviewee) revalidatePath(`/u/${reviewee.username}`);
  return { success: "Thanks for rating this hand-off." };
}

// ─────────────────────────────── Disputes ───────────────────────────────

export async function openDisputeAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const transactionId = String(formData.get("transactionId") ?? "");
  const kind = String(formData.get("kind") ?? "") as DisputeKind;
  const description = String(formData.get("description") ?? "").trim();

  if (!DISPUTE_KINDS.some((k) => k.value === kind)) return { error: "Please choose what went wrong." };
  if (description.length < 10) return { error: "Please describe what happened in a sentence or two." };
  if (description.length > 2000) return { error: "Please keep the description under 2000 characters." };
  if (!rateLimit(`dispute:${me.id}`, 5, 60 * 60_000)) return { error: "Too many reports at once. Please try again later." };

  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true,
      status: true,
      ownerId: true,
      receiverId: true,
      completedAt: true,
      listing: { select: { book: { select: { title: true } } } },
    },
  });
  if (!tx || (tx.ownerId !== me.id && tx.receiverId !== me.id)) return { error: "You can only report problems with your own hand-offs." };
  if (!canOpenDispute(tx)) return { error: "This hand-off can no longer be disputed." };

  const alreadyOpen = await prisma.dispute.findFirst({
    where: { transactionId: tx.id, openedById: me.id, status: { in: ["OPEN", "INVESTIGATING"] } },
    select: { id: true },
  });
  if (alreadyOpen) return { error: "You already have an open report for this hand-off. We'll be in touch." };

  const dispute = await prisma.$transaction(async (db) => {
    const d = await db.dispute.create({
      data: { transactionId: tx.id, openedById: me.id, kind, description },
      select: { id: true },
    });
    if (tx.status !== "COMPLETED" && tx.status !== "DISPUTED") {
      await db.transaction.update({ where: { id: tx.id }, data: { status: "DISPUTED" } });
    }
    return d;
  });

  await audit({ actorId: me.id, action: "DISPUTE_OPENED", entityType: "Dispute", entityId: dispute.id, metadata: { transactionId: tx.id, kind } });

  const otherId = tx.ownerId === me.id ? tx.receiverId : tx.ownerId;
  const title = tx.listing.book.title;
  await notify({
    userId: otherId,
    type: "DISPUTE_UPDATE",
    title: "A problem was reported with a hand-off",
    body: `${disputeKindLabel(kind)} for "${title}". A BookLoop admin will look into it.`,
    link: `/transactions/${tx.id}`,
  });
  for (const adminId of await adminIds()) {
    if (adminId === me.id) continue;
    await notify({
      userId: adminId,
      type: "DISPUTE_UPDATE",
      title: "New dispute to review",
      body: `${disputeKindLabel(kind)} for "${title}".`,
      link: "/admin/disputes",
    });
  }

  revalidatePath(`/transactions/${tx.id}`);
  revalidatePath("/activity");
  revalidatePath("/admin");
  return { success: "Thanks for letting us know. An admin will look into it and keep you posted." };
}
