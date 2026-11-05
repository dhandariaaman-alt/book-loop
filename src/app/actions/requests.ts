"use server";

import { revalidatePath } from "next/cache";
import type { HandoverMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { notify } from "@/lib/notify";
import { getOrCreateConversation, postConversationNote } from "@/lib/conversations";
import { getNumberSetting } from "@/lib/settings";
import { isBlockedEitherWay } from "@/lib/blocks";
import {
  DAY_MS,
  expireReservations,
  formatDate,
  formatDateTime,
  handoverMethodLabel,
  handoverSchema,
  releaseListing,
  requestSchema,
  revertListingIfNoPending,
} from "@/lib/transactions";

export type ActionResult = { error?: string; success?: string; transactionId?: string };

class Abort extends Error {}

function refresh(...paths: (string | null | undefined)[]) {
  revalidatePath("/activity");
  revalidatePath("/discover");
  for (const p of paths) if (p) revalidatePath(p);
}

async function safeNote(userA: string, userB: string, requestId: string, senderId: string, body: string) {
  try {
    const conv = await getOrCreateConversation(userA, userB, requestId);
    await postConversationNote(conv, senderId, body);
  } catch (e) {
    console.error("[requests] could not post conversation note", e);
  }
}

// ───────────────────────── Requests ─────────────────────────

export async function createRequestAction(listingId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  if (!rateLimit(`request:${me.id}`, 15, 60 * 60_000)) {
    return { error: "You're sending requests very quickly. Please wait a little and try again." };
  }

  const parsed = requestSchema.safeParse({
    type: formData.get("type") ?? "",
    message: formData.get("message") ?? "",
    proposedDays: formData.get("proposedDays") ?? "",
    customDays: formData.get("customDays") ?? "",
    offeredListingId: formData.get("offeredListingId") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const listing = await prisma.bookListing.findFirst({
    where: { id: listingId, removedAt: null },
    select: { id: true, ownerId: true, type: true, status: true, book: { select: { title: true } } },
  });
  if (!listing) return { error: "This book isn't available any more." };
  if (listing.ownerId === me.id) return { error: "This is your own book, so you can't request it." };
  if (d.type !== listing.type) return { error: "That request type doesn't match this listing." };
  if (listing.status !== "AVAILABLE" && listing.status !== "REQUEST_PENDING") {
    return { error: "This book isn't open for requests right now." };
  }
  if (await isBlockedEitherWay(me.id, listing.ownerId)) {
    return { error: "You can't request books from this member." };
  }
  const dup = await prisma.request.count({ where: { listingId, requesterId: me.id, status: "PENDING" } });
  if (dup > 0) return { error: "You've already requested this book. Waiting for the owner." };

  if (d.offeredListingId) {
    const offered = await prisma.bookListing.findFirst({
      where: { id: d.offeredListingId, ownerId: me.id, status: "AVAILABLE", removedAt: null },
      select: { id: true },
    });
    if (!offered) return { error: "The book you offered isn't one of your available listings." };
  }

  const request = await prisma.$transaction(async (tx) => {
    const r = await tx.request.create({
      data: {
        listingId,
        requesterId: me.id,
        type: d.type,
        message: d.message,
        proposedDays: d.proposedDays,
        offeredListingId: d.offeredListingId,
      },
      select: { id: true },
    });
    await tx.bookListing.updateMany({ where: { id: listingId, status: "AVAILABLE" }, data: { status: "REQUEST_PENDING" } });
    return r;
  });

  if (d.message) await safeNote(me.id, listing.ownerId, request.id, me.id, d.message);
  else {
    try {
      await getOrCreateConversation(me.id, listing.ownerId, request.id);
    } catch (e) {
      console.error("[requests] could not create conversation", e);
    }
  }

  const who = me.name || "A neighbour";
  const title = listing.book.title;
  await notify({
    userId: listing.ownerId,
    type: d.type === "EXCHANGE" ? "EXCHANGE_OFFER" : "REQUEST_RECEIVED",
    title: d.type === "EXCHANGE" ? `Exchange offer for "${title}"` : `New request for "${title}"`,
    body:
      d.type === "BORROW"
        ? `${who} would like to borrow it for ${d.proposedDays} days.`
        : d.type === "EXCHANGE"
          ? `${who} offered one of their books in exchange.`
          : `${who} would like this book.`,
    link: `/books/${listingId}`,
  });

  refresh(`/books/${listingId}`);
  return { success: "Request sent. Waiting for the owner." };
}

export async function acceptRequestAction(requestId: string): Promise<ActionResult> {
  const me = await requireUser();
  const req = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      type: true,
      listingId: true,
      requesterId: true,
      offeredListingId: true,
      listing: { select: { ownerId: true, book: { select: { title: true } } } },
    },
  });
  if (!req || req.listing.ownerId !== me.id) return { error: "That request doesn't exist or isn't for your book." };
  if (req.status !== "PENDING") return { error: "This request has already been answered." };
  if (await isBlockedEitherWay(me.id, req.requesterId)) return { error: "You can't accept a request from this member." };

  const hours = await getNumberSetting("reservation_expiry_hours");
  const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
  const now = new Date();

  let result: { transactionId: string; autoRejected: { id: string; requesterId: string; listingId: string }[] };
  try {
    result = await prisma.$transaction(async (tx) => {
      const claimed = await tx.request.updateMany({
        where: { id: req.id, status: "PENDING" },
        data: { status: "ACCEPTED", respondedAt: now },
      });
      if (claimed.count !== 1) throw new Abort("This request has already been answered.");

      const reserved = await tx.bookListing.updateMany({
        where: { id: req.listingId, status: { in: ["AVAILABLE", "REQUEST_PENDING"] } },
        data: { status: "RESERVED" },
      });
      if (reserved.count !== 1) throw new Abort("This book is already reserved for someone else.");

      const reservedListings = [req.listingId];
      if (req.type === "EXCHANGE") {
        if (!req.offeredListingId) throw new Abort("This exchange request has no book offered.");
        const swap = await tx.bookListing.updateMany({
          where: {
            id: req.offeredListingId,
            ownerId: req.requesterId,
            removedAt: null,
            status: { in: ["AVAILABLE", "REQUEST_PENDING"] },
          },
          data: { status: "RESERVED" },
        });
        if (swap.count !== 1) {
          throw new Abort("The book offered in exchange is no longer available. You can decline this request.");
        }
        reservedListings.push(req.offeredListingId);
      }

      const t = await tx.transaction.create({
        data: {
          requestId: req.id,
          listingId: req.listingId,
          ownerId: me.id,
          receiverId: req.requesterId,
          type: req.type,
          status: "RESERVED",
          reservations: { create: { expiresAt } },
        },
        select: { id: true },
      });

      const autoRejected = await tx.request.findMany({
        where: { listingId: { in: reservedListings }, status: "PENDING" },
        select: { id: true, requesterId: true, listingId: true },
      });
      if (autoRejected.length) {
        await tx.request.updateMany({
          where: { id: { in: autoRejected.map((r) => r.id) } },
          data: { status: "REJECTED", respondedAt: now },
        });
      }
      return { transactionId: t.id, autoRejected };
    });
  } catch (e) {
    if (e instanceof Abort) return { error: e.message };
    throw e;
  }

  const title = req.listing.book.title;
  const link = `/transactions/${result.transactionId}`;
  await notify({
    userId: req.requesterId,
    type: "REQUEST_ACCEPTED",
    title: `Request accepted: ${title}`,
    body: `The book is reserved for you until ${formatDateTime(expiresAt)}. Plan the handover and confirm the meet-up.`,
    link,
  });
  for (const r of result.autoRejected) {
    await notify({
      userId: r.requesterId,
      type: "REQUEST_REJECTED",
      title: "Your request was declined",
      body: "This book was reserved for someone else. There are plenty more nearby.",
      link: `/books/${r.listingId}`,
    });
  }
  await safeNote(me.id, req.requesterId, req.id, me.id, "Request accepted. Let's plan the handover.");

  refresh(`/books/${req.listingId}`, link, req.offeredListingId ? `/books/${req.offeredListingId}` : null);
  return { success: "Accepted. The book is reserved.", transactionId: result.transactionId };
}

async function closePending(requestId: string, as: "owner" | "requester"): Promise<ActionResult> {
  const me = await requireUser();
  const req = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      status: true,
      listingId: true,
      requesterId: true,
      listing: { select: { ownerId: true, book: { select: { title: true } } } },
    },
  });
  const allowed = req && (as === "owner" ? req.listing.ownerId === me.id : req.requesterId === me.id);
  if (!req || !allowed) return { error: "That request doesn't exist or isn't yours to change." };
  if (req.status !== "PENDING") return { error: "This request is no longer pending." };

  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.request.updateMany({
      where: { id: req.id, status: "PENDING" },
      data: as === "owner" ? { status: "REJECTED", respondedAt: new Date() } : { status: "CANCELLED", cancelledAt: new Date() },
    });
    if (r.count !== 1) return false;
    await revertListingIfNoPending(tx, req.listingId);
    return true;
  });
  if (!ok) return { error: "This request is no longer pending." };

  const title = req.listing.book.title;
  if (as === "owner") {
    await notify({
      userId: req.requesterId,
      type: "REQUEST_REJECTED",
      title: "Your request was declined",
      body: `The owner of "${title}" declined this time. There are plenty more books nearby.`,
      link: `/books/${req.listingId}`,
    });
  }
  refresh(`/books/${req.listingId}`);
  return { success: as === "owner" ? "Request declined." : "Request cancelled." };
}

export async function rejectRequestAction(requestId: string): Promise<ActionResult> {
  return closePending(requestId, "owner");
}

export async function cancelRequestAction(requestId: string): Promise<ActionResult> {
  return closePending(requestId, "requester");
}

// ───────────────────────── Transactions ─────────────────────────

async function loadTx(transactionId: string, userId: string) {
  const t = await prisma.transaction.findFirst({
    where: { id: transactionId, OR: [{ ownerId: userId }, { receiverId: userId }] },
    select: {
      id: true,
      status: true,
      type: true,
      ownerId: true,
      receiverId: true,
      listingId: true,
      requestId: true,
      request: { select: { offeredListingId: true, proposedDays: true } },
      listing: { select: { book: { select: { title: true } } } },
      reservations: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true, status: true } },
    },
  });
  if (!t) return null;
  const isOwner = t.ownerId === userId;
  return { ...t, isOwner, otherId: isOwner ? t.receiverId : t.ownerId, title: t.listing.book.title };
}

const NOT_FOUND = { error: "That hand-off doesn't exist or isn't yours." };

function txPaths(t: { id: string; listingId: string; request: { offeredListingId: string | null } }) {
  return [`/transactions/${t.id}`, `/books/${t.listingId}`, t.request.offeredListingId ? `/books/${t.request.offeredListingId}` : null];
}

export async function confirmReservationAction(transactionId: string): Promise<ActionResult> {
  const me = await requireUser();
  await expireReservations();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (t.status !== "RESERVED") return { error: "This reservation can't be confirmed any more." };
  const res = t.reservations[0];
  if (!res || res.status !== "ACTIVE") {
    return { error: res?.status === "CONFIRMED" ? "The meet-up is already confirmed." : "This reservation is no longer active." };
  }
  const r = await prisma.reservation.updateMany({
    where: { id: res.id, status: "ACTIVE", expiresAt: { gt: new Date() } },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });
  if (r.count !== 1) return { error: "This reservation is no longer active." };

  await notify({
    userId: t.otherId,
    type: "RESERVATION_CONFIRMED",
    title: `Meet-up confirmed: ${t.title}`,
    body: `${me.name || "The other member"} confirmed they'll meet for the handover.`,
    link: `/transactions/${t.id}`,
  });
  await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, "I've confirmed the meet-up. See you there.");
  refresh(...txPaths(t));
  return { success: "Confirmed. The reservation won't expire now." };
}

export async function saveHandoverAction(transactionId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (t.status !== "RESERVED") return { error: "Handover details can only be changed before the hand-off." };
  if (!rateLimit(`handover:${me.id}`, 30, 60 * 60_000)) return { error: "Too many changes. Please wait a bit." };

  const parsed = handoverSchema.safeParse({
    method: formData.get("method") ?? "",
    placeName: formData.get("placeName") ?? "",
    scheduledAt: formData.get("scheduledAtIso") || formData.get("scheduledAt") || "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  let scheduledAt: Date | null = null;
  if (d.scheduledAt) {
    scheduledAt = new Date(d.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return { error: "Enter a valid date and time." };
    if (scheduledAt.getTime() < Date.now() - 60 * 60 * 1000) return { error: "Choose a time in the future." };
  }
  if (d.method === "PUBLIC_PLACE" && !d.placeName) return { error: "Name the public place where you'll meet." };

  const data = {
    method: d.method as HandoverMethod,
    placeName: d.placeName || null,
    scheduledAt,
    notes: d.notes || null,
  };
  await prisma.handoverDetails.upsert({
    where: { transactionId: t.id },
    create: { transactionId: t.id, ...data },
    update: data,
  });

  const summary = [
    `Handover plan: ${handoverMethodLabel(data.method)}`,
    data.placeName ? `at ${data.placeName}` : null,
    scheduledAt ? `on ${formatDateTime(scheduledAt)}` : null,
  ]
    .filter(Boolean)
    .join(" ");
  await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, `${summary}.${data.notes ? ` Notes: ${data.notes}` : ""}`);

  refresh(...txPaths(t));
  return { success: "Handover plan saved." };
}

export async function markHandedOverAction(transactionId: string, _prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const me = await requireUser();
  await expireReservations();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (!t.isOwner) return { error: "Only the owner can mark the book as handed over." };
  if (t.status !== "RESERVED") return { error: "This hand-off isn't waiting for a handover." };

  let agreedDueDate: Date | null = null;
  if (t.type === "BORROW") {
    const raw = String(formData.get("dueDateIso") || "") || String(formData.get("dueDate") || "");
    if (!raw) return { error: "Agree a return date before handing over." };
    agreedDueDate = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? new Date(`${raw}T23:59:59`) : new Date(raw);
    if (Number.isNaN(agreedDueDate.getTime())) return { error: "Enter a valid return date." };
    if (agreedDueDate.getTime() < Date.now()) return { error: "The return date must be in the future." };
    if (agreedDueDate.getTime() > Date.now() + 180 * DAY_MS) return { error: "Choose a return date within 6 months." };
  }

  const completes = t.type !== "BORROW";
  const now = new Date();
  const offered = t.request.offeredListingId;

  const ok = await prisma.$transaction(async (tx) => {
    const moved = await tx.transaction.updateMany({
      where: { id: t.id, status: "RESERVED" },
      data: completes
        ? { status: "COMPLETED", handedOverAt: now, completedAt: now }
        : { status: "HANDED_OVER", handedOverAt: now, agreedDueDate },
    });
    if (moved.count !== 1) return false;
    await tx.reservation.updateMany({
      where: { transactionId: t.id, status: "ACTIVE" },
      data: { status: "CONFIRMED", confirmedAt: now },
    });
    await tx.bookListing.update({ where: { id: t.listingId }, data: { status: completes ? "COMPLETED" : "HANDED_OVER" } });
    if (t.type === "EXCHANGE" && offered) {
      await tx.bookListing.update({ where: { id: offered }, data: { status: "COMPLETED" } });
    }
    return true;
  });
  if (!ok) return { error: "This hand-off was already updated. Refresh to see the latest." };

  const link = `/transactions/${t.id}`;
  if (completes) {
    for (const userId of [t.ownerId, t.receiverId]) {
      await notify({
        userId,
        type: "TRANSACTION_COMPLETED",
        title: `Hand-off complete: ${t.title}`,
        body: "Thanks for keeping books moving. You can rate the hand-off now.",
        link,
      });
    }
    await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, "Book handed over. Hand-off complete. Thank you!");
  } else {
    await notify({
      userId: t.receiverId,
      type: "RESERVATION_CONFIRMED",
      title: `Enjoy "${t.title}"`,
      body: `The owner marked it as handed over. Please return it by ${formatDate(agreedDueDate!)}.`,
      link,
    });
    await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, `Book handed over. Return date: ${formatDate(agreedDueDate!)}.`);
  }

  refresh(...txPaths(t));
  return { success: completes ? "Handed over. This hand-off is complete." : "Handed over. Enjoy the loan period." };
}

export async function markReturnedAction(transactionId: string): Promise<ActionResult> {
  const me = await requireUser();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (t.isOwner) return { error: "Only the borrower can mark the book as returned." };
  if (t.type !== "BORROW" || t.status !== "HANDED_OVER") return { error: "This book isn't out on loan." };

  const r = await prisma.transaction.updateMany({
    where: { id: t.id, status: "HANDED_OVER" },
    data: { status: "RETURN_PENDING", returnedAt: new Date() },
  });
  if (r.count !== 1) return { error: "This hand-off was already updated. Refresh to see the latest." };

  await notify({
    userId: t.ownerId,
    type: "RETURN_REMINDER",
    title: `"${t.title}" is on its way back`,
    body: "The borrower marked it as returned. Please confirm once you have it.",
    link: `/transactions/${t.id}`,
  });
  await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, "I've returned the book. Please confirm when you have it.");
  refresh(...txPaths(t));
  return { success: "Marked as returned. The owner will confirm." };
}

export async function confirmReturnAction(transactionId: string): Promise<ActionResult> {
  const me = await requireUser();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (!t.isOwner) return { error: "Only the owner can confirm the return." };
  if (t.type !== "BORROW" || (t.status !== "RETURN_PENDING" && t.status !== "HANDED_OVER")) {
    return { error: "There's no return to confirm." };
  }
  const now = new Date();
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.transaction.updateMany({
      where: { id: t.id, status: { in: ["RETURN_PENDING", "HANDED_OVER"] } },
      data: { status: "COMPLETED", completedAt: now },
    });
    if (r.count !== 1) return false;
    // Set returnedAt if the owner confirms directly from HANDED_OVER.
    await tx.transaction.updateMany({ where: { id: t.id, returnedAt: null }, data: { returnedAt: now } });
    await tx.bookListing.updateMany({ where: { id: t.listingId, status: "HANDED_OVER" }, data: { status: "AVAILABLE" } });
    return true;
  });
  if (!ok) return { error: "This hand-off was already updated. Refresh to see the latest." };

  for (const userId of [t.ownerId, t.receiverId]) {
    await notify({
      userId,
      type: "TRANSACTION_COMPLETED",
      title: `Loan complete: ${t.title}`,
      body: "The book is back home and available to borrow again. You can rate the hand-off now.",
      link: `/transactions/${t.id}`,
    });
  }
  await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, "Got the book back. Thanks for returning it!");
  refresh(...txPaths(t));
  return { success: "Return confirmed. Your book is available again." };
}

export async function cancelTransactionAction(transactionId: string): Promise<ActionResult> {
  const me = await requireUser();
  const t = await loadTx(transactionId, me.id);
  if (!t) return NOT_FOUND;
  if (t.status !== "RESERVED") return { error: "Only a reservation that hasn't been handed over can be cancelled." };

  const now = new Date();
  const ok = await prisma.$transaction(async (tx) => {
    const r = await tx.transaction.updateMany({
      where: { id: t.id, status: "RESERVED" },
      data: { status: "CANCELLED", cancelledAt: now },
    });
    if (r.count !== 1) return false;
    await tx.reservation.updateMany({
      where: { transactionId: t.id, status: { in: ["ACTIVE", "CONFIRMED"] } },
      data: { status: "CANCELLED" },
    });
    await releaseListing(tx, t.listingId, t.id);
    if (t.request.offeredListingId) await releaseListing(tx, t.request.offeredListingId, t.id);
    return true;
  });
  if (!ok) return { error: "This hand-off was already updated. Refresh to see the latest." };

  await notify({
    userId: t.otherId,
    type: "RESERVATION_EXPIRED",
    title: `Reservation cancelled: ${t.title}`,
    body: `${me.name || "The other member"} cancelled the reservation.`,
    link: `/transactions/${t.id}`,
  });
  await safeNote(t.ownerId, t.receiverId, t.requestId, me.id, "I've cancelled this reservation.");
  refresh(...txPaths(t));
  return { success: "Reservation cancelled." };
}
