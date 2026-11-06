"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ListingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/rate-limit";
import { listingSchema, type ListingInput } from "@/lib/listings";
import { saveImage, UploadError } from "@/lib/storage";
import { findCoverUrl } from "@/lib/covers";
import type { FormState } from "./auth";

const MAX_PHOTOS = 4;

function readForm(formData: FormData) {
  return listingSchema.safeParse({
    title: formData.get("title") ?? "",
    author: formData.get("author") ?? "",
    isbn: formData.get("isbn") ?? "",
    genreId: formData.get("genreId") ?? "",
    type: formData.get("type") ?? "",
    condition: formData.get("condition") ?? "",
    description: formData.get("description") ?? "",
    priceRupees: formData.get("priceRupees") ?? "",
    coverUrl: formData.get("coverUrl") ?? "",
  });
}

function photos(formData: FormData): File[] {
  return formData
    .getAll("photos")
    .filter((f): f is File => typeof f === "object" && f !== null && "size" in f && (f as File).size > 0)
    .slice(0, MAX_PHOTOS);
}

/** Reuse an existing Book record (same title + author) or create one. */
async function findOrCreateBook(d: ListingInput) {
  const genreId = d.genreId ? (await prisma.genre.findUnique({ where: { id: d.genreId }, select: { id: true } }))?.id : undefined;
  const existing = await prisma.book.findFirst({
    where: {
      title: { equals: d.title, mode: "insensitive" },
      author: { equals: d.author, mode: "insensitive" },
    },
    select: { id: true, genreId: true, isbn: true },
  });
  if (existing) {
    if ((!existing.genreId && genreId) || (!existing.isbn && d.isbn)) {
      await prisma.book.update({
        where: { id: existing.id },
        data: { genreId: existing.genreId ?? genreId, isbn: existing.isbn ?? (d.isbn || null) },
      });
    }
    return existing.id;
  }
  const b = await prisma.book.create({
    data: { title: d.title, author: d.author, isbn: d.isbn || null, genreId: genreId ?? null },
    select: { id: true },
  });
  return b.id;
}

const price = (d: ListingInput) => (d.type === "SALE" ? Math.round(Number(d.priceRupees) * 100) : null);

export async function createListingAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  if (!rateLimit(`list:${me.id}`, 20, 60 * 60_000)) return { error: "You're listing very quickly. Please wait a bit." };

  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const profile = await prisma.profile.findUnique({
    where: { userId: me.id },
    select: { latitude: true, longitude: true, neighbourhood: true, communityId: true },
  });
  if (!profile?.neighbourhood && profile?.latitude == null) {
    return { error: "Set your area in your profile first, so neighbours can find your book." };
  }

  let urls: string[] = [];
  try {
    urls = await Promise.all(photos(formData).map(saveImage));
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  if (urls.length === 0 && d.coverUrl) urls = [d.coverUrl];
  // No photo and no picked result: look up the book's real cover automatically.
  if (urls.length === 0) {
    const found = await findCoverUrl(d.title, d.author, d.isbn);
    if (found) urls = [found];
  }

  const bookId = await findOrCreateBook(d);
  const listing = await prisma.bookListing.create({
    data: {
      ownerId: me.id,
      bookId,
      type: d.type,
      condition: d.condition,
      description: d.description || null,
      pricePaise: price(d),
      neighbourhood: profile?.neighbourhood ?? null,
      latitude: profile?.latitude ?? null,
      longitude: profile?.longitude ?? null,
      communityId: profile?.communityId ?? null,
      images: { create: urls.map((url, position) => ({ url, position, alt: `Cover of ${d.title}` })) },
    },
    select: { id: true },
  });

  revalidatePath("/discover");
  revalidatePath("/activity");
  redirect(`/books/${listing.id}?new=1`);
}

async function ownListing(id: string, userId: string) {
  const l = await prisma.bookListing.findFirst({
    where: { id, ownerId: userId, status: { not: "REMOVED" } },
    select: { id: true, status: true, images: { select: { id: true } } },
  });
  return l;
}

export async function updateListingAction(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const me = await requireUser();
  const listing = await ownListing(id, me.id);
  if (!listing) return { error: "That listing doesn't exist or isn't yours." };

  const parsed = readForm(formData);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const removeIds = formData.getAll("removeImage").map(String);
  const keepCount = listing.images.filter((i) => !removeIds.includes(i.id)).length;
  let urls: string[] = [];
  try {
    urls = await Promise.all(photos(formData).slice(0, Math.max(0, MAX_PHOTOS - keepCount)).map(saveImage));
  } catch (e) {
    if (e instanceof UploadError) return { error: e.message };
    throw e;
  }
  if (keepCount === 0 && urls.length === 0 && d.coverUrl) urls = [d.coverUrl];
  if (keepCount === 0 && urls.length === 0) {
    const found = await findCoverUrl(d.title, d.author, d.isbn);
    if (found) urls = [found];
  }

  const bookId = await findOrCreateBook(d);
  await prisma.$transaction([
    prisma.bookImage.deleteMany({ where: { listingId: id, id: { in: removeIds } } }),
    prisma.bookListing.update({
      where: { id },
      data: {
        bookId,
        type: d.type,
        condition: d.condition,
        description: d.description || null,
        pricePaise: price(d),
        images: { create: urls.map((url, i) => ({ url, position: keepCount + i, alt: `Cover of ${d.title}` })) },
      },
    }),
  ]);

  revalidatePath(`/books/${id}`);
  revalidatePath("/discover");
  revalidatePath("/activity");
  redirect(`/books/${id}?saved=1`);
}

/** Owner toggles a listing between Available and Unavailable. */
export async function setListingAvailabilityAction(id: string, available: boolean): Promise<FormState> {
  const me = await requireUser();
  const listing = await ownListing(id, me.id);
  if (!listing) return { error: "That listing doesn't exist or isn't yours." };
  const allowed: ListingStatus[] = ["AVAILABLE", "UNAVAILABLE"];
  if (!allowed.includes(listing.status)) {
    return { error: "This book has an active request, so its status can't be changed here." };
  }
  await prisma.bookListing.update({ where: { id }, data: { status: available ? "AVAILABLE" : "UNAVAILABLE" } });
  revalidatePath(`/books/${id}`);
  revalidatePath("/discover");
  revalidatePath("/activity");
  return { success: available ? "Your book is visible again." : "Your book is hidden from Discover." };
}

/** Owner removes a listing (kept in the database for history). */
export async function removeListingAction(id: string): Promise<FormState> {
  const me = await requireUser();
  const listing = await ownListing(id, me.id);
  if (!listing) return { error: "That listing doesn't exist or isn't yours." };
  if (!["AVAILABLE", "UNAVAILABLE"].includes(listing.status)) {
    return { error: "This book has an active request. Resolve it before removing the listing." };
  }
  await prisma.bookListing.update({ where: { id }, data: { status: "REMOVED", removedAt: new Date() } });
  revalidatePath("/discover");
  revalidatePath("/activity");
  redirect("/activity?tab=books&removed=1");
}
