// Book circulation (PRD 4.5-4.7, 6, 9, 10): requests, reservations,
// hand-overs, returns and expiry. Server-only domain logic and queries.

import type { HandoverMethod, ListingType, Prisma, TransactionStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "./prisma";
import { notify } from "./notify";
import { getNumberSetting } from "./settings";

type Tx = Prisma.TransactionClient;

export const ACTIVE_TX: TransactionStatus[] = ["RESERVED", "HANDED_OVER", "RETURN_PENDING", "DISPUTED"];
export const BORROW_DAY_OPTIONS = [7, 14, 21, 30] as const;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Display timezone for server-rendered dates and times. */
export const APP_TZ = process.env.APP_TIMEZONE || "Asia/Kolkata";

export const HANDOVER_METHODS: { value: HandoverMethod; label: string }[] = [
  { value: "PUBLIC_PLACE", label: "Public place" },
  { value: "INSTITUTION_POINT", label: "Library or institution point" },
  { value: "SELF_ARRANGED_DELIVERY", label: "Self-arranged delivery" },
  { value: "OTHER", label: "Other" },
];
export const handoverMethodLabel = (m: HandoverMethod) => HANDOVER_METHODS.find((x) => x.value === m)?.label ?? m;

export function formatDate(d: Date) {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: APP_TZ });
}
export function formatDateTime(d: Date) {
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: APP_TZ,
  });
}

// ───────────────────────── Validation ─────────────────────────

export const requestSchema = z
  .object({
    type: z.enum(["BORROW", "EXCHANGE", "GIVEAWAY", "SALE"], { message: "Choose a request type." }),
    message: z.string().trim().max(500, "Keep your message under 500 characters.").optional().or(z.literal("")),
    proposedDays: z.string().trim().optional().or(z.literal("")),
    customDays: z.string().trim().optional().or(z.literal("")),
    offeredListingId: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .transform((d, ctx) => {
    let days: number | null = null;
    if (d.type === "BORROW") {
      const raw = d.proposedDays === "custom" ? d.customDays : d.proposedDays;
      const n = Number(raw);
      if (!raw || !Number.isInteger(n) || n < 1 || n > 90) {
        ctx.addIssue({ code: "custom", message: "Choose how long you'd like to borrow it (1 to 90 days)." });
        return z.NEVER;
      }
      days = n;
    }
    if (d.type === "EXCHANGE" && !d.offeredListingId) {
      ctx.addIssue({ code: "custom", message: "Choose one of your books to offer in exchange." });
      return z.NEVER;
    }
    return {
      type: d.type as ListingType,
      message: d.message || null,
      proposedDays: days,
      offeredListingId: d.type === "EXCHANGE" ? d.offeredListingId || null : null,
    };
  });

export const handoverSchema = z.object({
  method: z.enum(["PUBLIC_PLACE", "INSTITUTION_POINT", "SELF_ARRANGED_DELIVERY", "OTHER"], {
    message: "Choose how you'll hand over the book.",
  }),
  placeName: z.string().trim().max(120, "Keep the place name short.").optional().or(z.literal("")),
  scheduledAt: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(500, "Keep notes under 500 characters.").optional().or(z.literal("")),
});

// ───────────────────────── Listing helpers ─────────────────────────

/** After a request leaves PENDING: if none remain, put REQUEST_PENDING listings back to AVAILABLE. */
export async function revertListingIfNoPending(tx: Tx, listingId: string) {
  const left = await tx.request.count({ where: { listingId, status: "PENDING" } });
  if (left === 0) {
    await tx.bookListing.updateMany({ where: { id: listingId, status: "REQUEST_PENDING" }, data: { status: "AVAILABLE" } });
  }
}

/** Release a reserved listing back to AVAILABLE unless another active transaction still holds it. */
export async function releaseListing(tx: Tx, listingId: string, exceptTxId: string) {
  const busy = await tx.transaction.count({
    where: {
      id: { not: exceptTxId },
      status: { in: ACTIVE_TX },
      OR: [{ listingId }, { request: { offeredListingId: listingId } }],
    },
  });
  if (busy === 0) {
    await tx.bookListing.updateMany({
      where: { id: listingId, status: { in: ["RESERVED", "REQUEST_PENDING"] } },
      data: { status: "AVAILABLE" },
    });
  }
}

// ───────────────────────── Expiry and reminders ─────────────────────────

/** ACTIVE reservations past expiresAt: expire, cancel the transaction, release listings, notify. Idempotent. */
export async function expireReservations(): Promise<number> {
  const due = await prisma.reservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: new Date() }, transaction: { status: "RESERVED" } },
    take: 100,
    select: {
      id: true,
      transaction: {
        select: {
          id: true,
          listingId: true,
          ownerId: true,
          receiverId: true,
          request: { select: { offeredListingId: true } },
          listing: { select: { book: { select: { title: true } } } },
        },
      },
    },
  });

  let expired = 0;
  for (const r of due) {
    const t = r.transaction;
    const done = await prisma.$transaction(async (tx) => {
      const res = await tx.reservation.updateMany({ where: { id: r.id, status: "ACTIVE" }, data: { status: "EXPIRED" } });
      if (res.count !== 1) return false;
      const moved = await tx.transaction.updateMany({
        where: { id: t.id, status: "RESERVED" },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (moved.count !== 1) return false;
      await releaseListing(tx, t.listingId, t.id);
      if (t.request.offeredListingId) await releaseListing(tx, t.request.offeredListingId, t.id);
      return true;
    });
    if (!done) continue;
    expired++;
    const title = t.listing.book.title;
    for (const userId of [t.ownerId, t.receiverId]) {
      await notify({
        userId,
        type: "RESERVATION_EXPIRED",
        title: `Reservation expired: ${title}`,
        body: "Nobody confirmed the meet-up in time, so the reservation was released.",
        link: `/transactions/${t.id}`,
      });
    }
  }
  return expired;
}

async function alreadyNotified(userId: string, type: "RETURN_REMINDER" | "OVERDUE", link: string) {
  const n = await prisma.notification.count({
    where: { userId, type, link, createdAt: { gte: new Date(Date.now() - DAY_MS) } },
  });
  return n > 0;
}

/** RETURN_REMINDER for borrows due soon, OVERDUE for past-due ones. At most one of each per day. */
export async function sendReturnReminders(): Promise<{ reminders: number; overdue: number }> {
  const days = await getNumberSetting("return_reminder_days");
  const now = new Date();
  const rows = await prisma.transaction.findMany({
    where: {
      type: "BORROW",
      status: "HANDED_OVER",
      agreedDueDate: { not: null, lte: new Date(now.getTime() + days * DAY_MS) },
    },
    take: 500,
    select: {
      id: true,
      ownerId: true,
      receiverId: true,
      agreedDueDate: true,
      listing: { select: { book: { select: { title: true } } } },
    },
  });

  let reminders = 0;
  let overdue = 0;
  for (const t of rows) {
    const link = `/transactions/${t.id}`;
    const title = t.listing.book.title;
    const due = t.agreedDueDate!;
    if (due.getTime() < now.getTime()) {
      for (const [userId, body] of [
        [t.receiverId, `"${title}" was due back on ${formatDate(due)}. Please arrange the return with the owner.`],
        [t.ownerId, `"${title}" was due back on ${formatDate(due)}. You can message the borrower from the hand-off page.`],
      ] as const) {
        if (await alreadyNotified(userId, "OVERDUE", link)) continue;
        await notify({ userId, type: "OVERDUE", title: `Overdue: ${title}`, body, link });
        overdue++;
      }
    } else {
      if (await alreadyNotified(t.receiverId, "RETURN_REMINDER", link)) continue;
      await notify({
        userId: t.receiverId,
        type: "RETURN_REMINDER",
        title: `Return soon: ${title}`,
        body: `Please return "${title}" by ${formatDate(due)}.`,
        link,
      });
      reminders++;
    }
  }
  return { reminders, overdue };
}

// ───────────────────────── Queries ─────────────────────────

const bookBits = {
  select: {
    id: true,
    type: true,
    status: true,
    pricePaise: true,
    book: { select: { title: true, author: true } },
    images: { orderBy: { position: "asc" as const }, take: 1, select: { url: true } },
  },
};

/** Pending requests for one of the owner's listings (book page panel). */
export async function pendingRequestsForListing(listingId: string) {
  return prisma.request.findMany({
    where: { listingId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      message: true,
      proposedDays: true,
      createdAt: true,
      requester: { select: { username: true, name: true, image: true } },
      offeredListing: { select: { id: true, book: { select: { title: true, author: true } } } },
    },
  });
}

/** What the book page needs for a non-owner: their pending request, active transaction, and swap candidates. */
export async function requesterContext(listingId: string, userId: string) {
  const [pending, active, myAvailable] = await Promise.all([
    prisma.request.findFirst({
      where: { listingId, requesterId: userId, status: "PENDING" },
      select: { id: true, createdAt: true },
    }),
    prisma.transaction.findFirst({
      where: { listingId, receiverId: userId, status: { in: ACTIVE_TX } },
      select: { id: true, status: true },
    }),
    prisma.bookListing.findMany({
      where: { ownerId: userId, status: "AVAILABLE", removedAt: null },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, book: { select: { title: true, author: true } } },
    }),
  ]);
  return {
    pending,
    active,
    myAvailable: myAvailable.map((l) => ({ id: l.id, label: `${l.book.title} by ${l.book.author}` })),
  };
}

/** The owner's active transaction for a listing, if any. */
export async function activeTransactionForListing(listingId: string) {
  return prisma.transaction.findFirst({
    where: { listingId, status: { in: ACTIVE_TX } },
    select: { id: true, status: true, receiver: { select: { username: true } } },
  });
}

/** Full transaction for its page, only when the viewer is the owner or receiver. */
export async function getTransactionForViewer(id: string, userId: string) {
  return prisma.transaction.findFirst({
    where: { id, OR: [{ ownerId: userId }, { receiverId: userId }] },
    include: {
      listing: bookBits,
      owner: { select: { id: true, username: true, name: true, image: true } },
      receiver: { select: { id: true, username: true, name: true, image: true } },
      request: {
        select: {
          id: true,
          message: true,
          proposedDays: true,
          createdAt: true,
          respondedAt: true,
          offeredListing: bookBits,
        },
      },
      reservations: { orderBy: { createdAt: "desc" }, take: 1 },
      handover: true,
    },
  });
}

export type TransactionView = NonNullable<Awaited<ReturnType<typeof getTransactionForViewer>>>;

/** Borrow due state for badges. */
export function dueState(due: Date | null, status: TransactionStatus, now = new Date()): "overdue" | "soon" | null {
  if (!due || status !== "HANDED_OVER") return null;
  const diff = due.getTime() - now.getTime();
  if (diff < 0) return "overdue";
  if (diff <= 3 * DAY_MS) return "soon";
  return null;
}
