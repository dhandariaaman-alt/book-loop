"use server";

// Admin console actions (PRD Phase 6). Every action re-checks the ADMIN role,
// validates input with zod, audits the change and returns { error | success }.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notify";
import { SETTINGS, setNumberSetting, type SettingKey } from "@/lib/settings";
import { REPORT_OPS, applyReportOp, removeListingAsModerator, removeReviewAsModerator } from "@/lib/admin";
import type { FormState } from "./auth";

const id = z.string().trim().min(1, "Missing id.").max(40);
const reason = z.string().trim().min(3, "Please give a reason (at least 3 characters).").max(500, "Keep the reason under 500 characters.");
const optionalNote = z.string().trim().max(1000, "Keep the note under 1000 characters.").optional().transform((v) => v || undefined);

function fields(fd: FormData) {
  const o: Record<string, string> = {};
  fd.forEach((v, k) => {
    if (typeof v === "string") o[k] = v;
  });
  return o;
}

function firstError(e: z.ZodError) {
  return e.issues[0]?.message ?? "Please check the form.";
}

const admin = () => requireRole(["ADMIN"]);

// ───────────────────────────── Users ─────────────────────────────

const roleSchema = z.object({ userId: id, role: z.enum(["USER", "MODERATOR", "ADMIN"], { message: "Choose a role." }) });

export async function changeRoleAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = roleSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { userId, role } = parsed.data;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, username: true } });
  if (!user) return { error: "That user no longer exists." };
  if (user.role === role) return { error: `@${user.username} already has that role.` };
  if (user.id === me.id && role !== "ADMIN") return { error: "You can't remove your own admin role." };
  if (user.role === "ADMIN" && role !== "ADMIN") {
    const admins = await prisma.user.count({ where: { role: "ADMIN", status: "ACTIVE" } });
    if (admins <= 1) return { error: "BookLoop needs at least one active admin." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      role,
      // Moderators who lose the role stop moderating their communities.
      ...(role === "USER" ? { moderatedCommunities: { set: [] } } : {}),
    },
  });
  await prisma.moderationAction.create({
    data: { actorId: me.id, targetUserId: userId, action: "CHANGE_ROLE", reason: `${user.role} to ${role}`, entityType: "User", entityId: userId },
  });
  await audit({ actorId: me.id, action: "ROLE_CHANGED", entityType: "User", entityId: userId, metadata: { from: user.role, to: role } });
  await notify({
    userId,
    type: "ACCOUNT",
    title: "Your BookLoop role changed",
    body: `Your account role is now ${role.toLowerCase()}.`,
    link: "/dashboard",
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/moderators");
  return { success: `@${user.username} is now ${role.toLowerCase()}.` };
}

const statusSchema = z.object({ userId: id, status: z.enum(["ACTIVE", "SUSPENDED", "BANNED"]), reason });

const STATUS_AUDIT = { ACTIVE: "USER_REACTIVATED", SUSPENDED: "USER_SUSPENDED", BANNED: "USER_BANNED" } as const;
const STATUS_MOD = { ACTIVE: "REACTIVATE_USER", SUSPENDED: "SUSPEND_USER", BANNED: "BAN_USER" } as const;

/** Shared by the Users page and the "suspend user" report shortcut. */
async function setUserStatus(actorId: string, userId: string, status: "ACTIVE" | "SUSPENDED" | "BANNED", why: string): Promise<FormState> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, role: true, status: true, username: true } });
  if (!user) return { error: "That user no longer exists." };
  if (user.id === actorId) return { error: "You can't change your own account status." };
  if (user.role === "ADMIN" && status !== "ACTIVE") return { error: "Change this admin's role first, then suspend or ban them." };
  if (user.status === status) return { error: `@${user.username} is already ${status.toLowerCase()}.` };

  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { status } }),
    prisma.moderationAction.create({
      data: { actorId, targetUserId: userId, action: STATUS_MOD[status], reason: why, entityType: "User", entityId: userId },
    }),
  ]);
  await audit({ actorId, action: STATUS_AUDIT[status], entityType: "User", entityId: userId, metadata: { from: user.status, to: status, reason: why } });
  await notify({
    userId,
    type: "ACCOUNT",
    title:
      status === "ACTIVE"
        ? "Your BookLoop account is active again"
        : status === "SUSPENDED"
          ? "Your BookLoop account has been suspended"
          : "Your BookLoop account has been banned",
    body: `Reason: ${why}`,
  });
  return { success: `@${user.username} is now ${status.toLowerCase()}.` };
}

export async function setUserStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = statusSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await setUserStatus(me.id, parsed.data.userId, parsed.data.status, parsed.data.reason);
  revalidatePath("/admin/users");
  revalidatePath("/admin");
  return res;
}

// ─────────────────────────── Institutions ───────────────────────────

const institutionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("VERIFY"), institutionId: id }),
  z.object({ decision: z.literal("REJECT"), institutionId: id, reason }),
]);

export async function reviewInstitutionAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = institutionSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const inst = await prisma.institution.findUnique({
    where: { id: d.institutionId },
    select: { id: true, name: true, verificationStatus: true, userId: true, user: { select: { role: true } } },
  });
  if (!inst) return { error: "That institution no longer exists." };

  if (d.decision === "VERIFY") {
    if (inst.verificationStatus === "VERIFIED") return { error: "Already verified." };
    await prisma.$transaction([
      prisma.institution.update({
        where: { id: inst.id },
        data: { verificationStatus: "VERIFIED", verifiedAt: new Date(), verifiedById: me.id },
      }),
      ...(inst.user.role === "ADMIN" ? [] : [prisma.user.update({ where: { id: inst.userId }, data: { role: "INSTITUTION" } })]),
    ]);
    await audit({ actorId: me.id, action: "INSTITUTION_VERIFIED", entityType: "Institution", entityId: inst.id, metadata: { name: inst.name } });
    await notify({
      userId: inst.userId,
      type: "ACCOUNT",
      title: `${inst.name} is verified`,
      body: "You can now post donation requests on BookLoop.",
      link: "/institution",
    });
    revalidatePath("/admin/institutions");
    revalidatePath("/admin");
    revalidatePath("/community");
    return { success: `${inst.name} is verified.` };
  }

  if (inst.verificationStatus === "REJECTED") return { error: "Already rejected." };
  await prisma.$transaction([
    prisma.institution.update({ where: { id: inst.id }, data: { verificationStatus: "REJECTED", verifiedAt: null, verifiedById: null } }),
    ...(inst.user.role === "INSTITUTION" ? [prisma.user.update({ where: { id: inst.userId }, data: { role: "USER" } })] : []),
  ]);
  await audit({ actorId: me.id, action: "INSTITUTION_REJECTED", entityType: "Institution", entityId: inst.id, metadata: { name: inst.name, reason: d.reason } });
  await notify({
    userId: inst.userId,
    type: "ACCOUNT",
    title: `${inst.name} could not be verified`,
    body: `Reason: ${d.reason}`,
    link: "/institution",
  });
  revalidatePath("/admin/institutions");
  revalidatePath("/admin");
  revalidatePath("/community");
  return { success: `${inst.name} was rejected.` };
}

// ───────────────────────────── Listings ─────────────────────────────

const removeListingSchema = z.object({ listingId: id, reason });

export async function adminRemoveListingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = removeListingSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const res = await removeListingAsModerator(me.id, parsed.data.listingId, parsed.data.reason);
  revalidatePath("/admin/listings");
  revalidatePath("/discover");
  revalidatePath(`/books/${parsed.data.listingId}`);
  return res;
}

// ───────────────────────────── Reports ─────────────────────────────

const reportSchema = z
  .object({
    reportId: id,
    op: z.enum(REPORT_OPS),
    note: optionalNote,
    shortcut: z.enum(["NONE", "REMOVE_LISTING", "REMOVE_REVIEW", "SUSPEND_USER"]).optional().default("NONE"),
  })
  .refine((d) => d.op !== "RESOLVE" || !!d.note, { message: "Add a resolution note.", path: ["note"] })
  .refine((d) => d.shortcut === "NONE" || d.op === "RESOLVE", { message: "Shortcuts only apply when resolving.", path: ["shortcut"] });

export async function adminReportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = reportSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const report = await prisma.report.findUnique({
    where: { id: d.reportId },
    select: {
      status: true,
      listingId: true,
      reviewId: true,
      reportedUserId: true,
      listing: { select: { ownerId: true } },
      review: { select: { reviewerId: true } },
      message: { select: { senderId: true } },
    },
  });
  if (!report) return { error: "That report no longer exists." };
  if (report.status === "RESOLVED" || report.status === "DISMISSED") return { error: "That report is already closed." };

  const why = d.note ?? "Resolved from a report";
  let extra = "";
  if (d.shortcut === "REMOVE_LISTING") {
    if (!report.listingId) return { error: "This report has no listing to remove." };
    const r = await removeListingAsModerator(me.id, report.listingId, why);
    if (r.error) return r;
    extra = " The listing was removed.";
  } else if (d.shortcut === "REMOVE_REVIEW") {
    if (!report.reviewId) return { error: "This report has no review to remove." };
    const r = await removeReviewAsModerator(me.id, report.reviewId, why);
    if (r.error) return r;
    extra = " The review was removed.";
  } else if (d.shortcut === "SUSPEND_USER") {
    const target = report.reportedUserId ?? report.listing?.ownerId ?? report.review?.reviewerId ?? report.message?.senderId;
    if (!target) return { error: "This report has no user to suspend." };
    const r = await setUserStatus(me.id, target, "SUSPENDED", why);
    if (r.error) return r;
    extra = " The user was suspended.";
  }

  const res = await applyReportOp(me.id, d.reportId, d.op, d.note);
  if (!res.ok) return { error: res.error };

  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  revalidatePath("/moderator");
  const label = { UNDER_REVIEW: "Marked under review.", ESCALATE: "Escalated.", DISMISS: "Report dismissed.", RESOLVE: "Report resolved." }[d.op];
  return { success: label + extra };
}

// ───────────────────────────── Disputes ─────────────────────────────

const disputeSchema = z
  .object({
    disputeId: id,
    status: z.enum(["INVESTIGATING", "RESOLVED", "CLOSED"]),
    resolution: optionalNote,
    outcome: z.enum(["NONE", "COMPLETED", "CANCELLED"]).optional().default("NONE"),
  })
  .refine((d) => d.status === "INVESTIGATING" || !!d.resolution, { message: "Write a resolution for both parties.", path: ["resolution"] })
  .refine((d) => d.outcome === "NONE" || d.status === "RESOLVED", { message: "The transaction can only change when resolving.", path: ["outcome"] });

export async function updateDisputeAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = disputeSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  const dispute = await prisma.dispute.findUnique({
    where: { id: d.disputeId },
    select: {
      id: true,
      status: true,
      transaction: { select: { id: true, status: true, type: true, ownerId: true, receiverId: true, listingId: true, listing: { select: { book: { select: { title: true } } } } } },
    },
  });
  if (!dispute) return { error: "That dispute no longer exists." };
  if (dispute.status === "RESOLVED" || dispute.status === "CLOSED") return { error: "That dispute is already closed." };
  if (dispute.status === d.status) return { error: "The dispute already has that status." };

  const tx = dispute.transaction;
  const now = new Date();
  const closing = d.status !== "INVESTIGATING";
  const ops: Prisma.PrismaPromise<unknown>[] = [
    prisma.dispute.update({
      where: { id: dispute.id },
      data: {
        status: d.status,
        ...(closing ? { resolution: d.resolution, resolvedById: me.id, resolvedAt: now } : {}),
      },
    }),
  ];
  if (d.outcome === "COMPLETED") {
    ops.push(
      prisma.transaction.update({ where: { id: tx.id }, data: { status: "COMPLETED", completedAt: now, ...(tx.type === "BORROW" ? { returnedAt: now } : {}) } }),
      // A finished borrow puts the book back on the shelf; other types are done for good.
      prisma.bookListing.update({ where: { id: tx.listingId }, data: { status: tx.type === "BORROW" ? "AVAILABLE" : "COMPLETED" } }),
    );
  } else if (d.outcome === "CANCELLED") {
    ops.push(
      prisma.transaction.update({ where: { id: tx.id }, data: { status: "CANCELLED", cancelledAt: now } }),
      prisma.reservation.updateMany({ where: { transactionId: tx.id, status: "ACTIVE" }, data: { status: "CANCELLED" } }),
      prisma.bookListing.updateMany({ where: { id: tx.listingId, status: { not: "REMOVED" } }, data: { status: "AVAILABLE" } }),
    );
  }
  await prisma.$transaction(ops);

  await audit({
    actorId: me.id,
    action: d.status === "INVESTIGATING" ? "DISPUTE_INVESTIGATING" : d.status === "RESOLVED" ? "DISPUTE_RESOLVED" : "DISPUTE_CLOSED",
    entityType: "Dispute",
    entityId: dispute.id,
    metadata: { from: dispute.status, to: d.status, resolution: d.resolution ?? null, transactionOutcome: d.outcome, transactionId: tx.id, previousTransactionStatus: tx.status },
  });

  const title =
    d.status === "INVESTIGATING"
      ? `We're looking into your dispute about "${tx.listing.book.title}"`
      : `Your dispute about "${tx.listing.book.title}" was ${d.status === "RESOLVED" ? "resolved" : "closed"}`;
  await Promise.all(
    [tx.ownerId, tx.receiverId].map((userId) =>
      notify({ userId, type: "DISPUTE_UPDATE", title, body: d.resolution, link: `/transactions/${tx.id}` }),
    ),
  );

  revalidatePath("/admin/disputes");
  revalidatePath(`/admin/disputes/${dispute.id}`);
  revalidatePath(`/transactions/${tx.id}`);
  revalidatePath("/admin");
  return { success: d.status === "INVESTIGATING" ? "Marked as investigating. Both parties were notified." : "Dispute updated. Both parties were notified." };
}

// ───────────────────────────── Reviews ─────────────────────────────

const reviewSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("REMOVE"), reviewId: id, reason }),
  z.object({ op: z.literal("RESTORE"), reviewId: id }),
]);

export async function adminReviewAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = reviewSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const d = parsed.data;

  let res: FormState;
  if (d.op === "REMOVE") {
    res = await removeReviewAsModerator(me.id, d.reviewId, d.reason);
  } else {
    const review = await prisma.review.findUnique({ where: { id: d.reviewId }, select: { removedAt: true, reviewerId: true } });
    if (!review) return { error: "That review no longer exists." };
    if (!review.removedAt) return { error: "That review is not removed." };
    await prisma.$transaction([
      prisma.review.update({ where: { id: d.reviewId }, data: { removedAt: null, removedById: null } }),
      prisma.moderationAction.create({
        data: { actorId: me.id, targetUserId: review.reviewerId, action: "RESTORE_REVIEW", entityType: "Review", entityId: d.reviewId },
      }),
    ]);
    await audit({ actorId: me.id, action: "REVIEW_RESTORED", entityType: "Review", entityId: d.reviewId });
    res = { success: "Review restored." };
  }
  revalidatePath("/admin/reviews");
  return res;
}

// ──────────────────────────── Moderators ────────────────────────────

const promoteSchema = z.object({
  username: z
    .string()
    .trim()
    .min(1, "Enter a username.")
    .max(40)
    .transform((u) => u.replace(/^@/, "").toLowerCase()),
});

export async function promoteModeratorAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = promoteSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const user = await prisma.user.findFirst({
    where: { username: { equals: parsed.data.username, mode: "insensitive" } },
    select: { id: true, role: true, status: true, username: true },
  });
  if (!user) return { error: "No user with that username." };
  if (user.role === "MODERATOR") return { error: `@${user.username} is already a moderator.` };
  if (user.role === "ADMIN") return { error: `@${user.username} is an admin and can already moderate.` };
  if (user.role === "INSTITUTION") return { error: "Institution accounts can't be moderators." };
  if (user.status !== "ACTIVE") return { error: `@${user.username} is ${user.status.toLowerCase()}.` };

  await prisma.$transaction([
    prisma.user.update({ where: { id: user.id }, data: { role: "MODERATOR" } }),
    prisma.moderationAction.create({
      data: { actorId: me.id, targetUserId: user.id, action: "CHANGE_ROLE", reason: `${user.role} to MODERATOR`, entityType: "User", entityId: user.id },
    }),
  ]);
  await audit({ actorId: me.id, action: "ROLE_CHANGED", entityType: "User", entityId: user.id, metadata: { from: user.role, to: "MODERATOR" } });
  await notify({
    userId: user.id,
    type: "ACCOUNT",
    title: "You're now a BookLoop moderator",
    body: "Thanks for helping keep your neighbourhood friendly. Your moderator dashboard is ready.",
    link: "/moderator",
  });
  revalidatePath("/admin/moderators");
  revalidatePath("/admin/users");
  return { success: `@${user.username} is now a moderator.` };
}

const assignSchema = z.object({ userId: id, communityId: id, op: z.enum(["ASSIGN", "UNASSIGN"]) });

export async function assignCommunityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = assignSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { userId, communityId, op } = parsed.data;

  const [user, community] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { role: true, username: true } }),
    prisma.community.findUnique({ where: { id: communityId }, select: { name: true } }),
  ]);
  if (!user || !community) return { error: "That user or community no longer exists." };
  if (op === "ASSIGN" && user.role !== "MODERATOR" && user.role !== "ADMIN") return { error: "Only moderators can be assigned to communities." };

  await prisma.community.update({
    where: { id: communityId },
    data: { moderators: op === "ASSIGN" ? { connect: { id: userId } } : { disconnect: { id: userId } } },
  });
  await audit({
    actorId: me.id,
    action: op === "ASSIGN" ? "MODERATOR_ASSIGNED" : "MODERATOR_UNASSIGNED",
    entityType: "Community",
    entityId: communityId,
    metadata: { userId, username: user.username, community: community.name },
  });
  revalidatePath("/admin/moderators");
  revalidatePath("/moderator");
  return { success: op === "ASSIGN" ? `@${user.username} now moderates ${community.name}.` : `@${user.username} no longer moderates ${community.name}.` };
}

const communitySchema = z.object({
  name: z.string().trim().min(2, "Name the community.").max(80),
  city: z.string().trim().max(80).optional().transform((v) => v || null),
  centerLat: z.coerce.number({ message: "Enter a latitude." }).min(-90, "Latitude must be between -90 and 90.").max(90, "Latitude must be between -90 and 90."),
  centerLng: z.coerce.number({ message: "Enter a longitude." }).min(-180, "Longitude must be between -180 and 180.").max(180, "Longitude must be between -180 and 180."),
  radiusKm: z.coerce.number({ message: "Enter a radius." }).min(0.5, "Radius must be at least 0.5 km.").max(50, "Radius must be 50 km or less."),
});

export async function createCommunityAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = communitySchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  try {
    const c = await prisma.community.create({ data: parsed.data, select: { id: true, name: true } });
    await audit({ actorId: me.id, action: "COMMUNITY_CREATED", entityType: "Community", entityId: c.id, metadata: parsed.data });
    revalidatePath("/admin/moderators");
    return { success: `${c.name} created.` };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "A community with that name already exists in this city." };
    throw e;
  }
}

// ───────────────────────────── Settings ─────────────────────────────

const settingSchema = z.object({
  key: z.enum(Object.keys(SETTINGS) as [SettingKey, ...SettingKey[]]),
  value: z.coerce.number({ message: "Enter a number." }).int("Use a whole number."),
});

export async function updateSettingAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await admin();
  const parsed = settingSchema.safeParse(fields(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { key, value } = parsed.data;
  const before = await prisma.platformSetting.findUnique({ where: { key } });
  try {
    await setNumberSetting(key, value);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not save the setting." };
  }
  await audit({ actorId: me.id, action: "SETTING_CHANGED", entityType: "PlatformSetting", entityId: key, metadata: { from: before?.value ?? null, to: String(value) } });
  revalidatePath("/admin/settings");
  return { success: `${SETTINGS[key].label} saved.` };
}
