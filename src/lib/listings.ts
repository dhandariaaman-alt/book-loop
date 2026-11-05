// Book listings (PRD Phase 2): labels, validation and the browse/search query.
// Exact coordinates never leave this module: callers get a rounded distance only.

import { z } from "zod";
import type { BookCondition, ListingStatus, ListingType, Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { boundingBox, distanceKm, RADIUS_OPTIONS_KM } from "./geo";

export { LISTING_TYPES, CONDITIONS, STATUS_LABEL, typeLabel, conditionLabel, formatPrice } from "./listing-labels";

// ───────────────────────── Validation ─────────────────────────

const httpsUrl = z
  .string()
  .trim()
  .url()
  .refine((u) => u.startsWith("https://covers.openlibrary.org/"), "Unsupported cover source.");

export const listingSchema = z
  .object({
    title: z.string().trim().min(1, "Enter the book's title.").max(200),
    author: z.string().trim().min(1, "Enter the author.").max(120),
    isbn: z.string().trim().max(20).optional().or(z.literal("")),
    genreId: z.string().trim().max(40).optional().or(z.literal("")),
    type: z.enum(["BORROW", "EXCHANGE", "GIVEAWAY", "SALE"], { message: "Choose how you want to share it." }),
    condition: z.enum(["NEW", "LIKE_NEW", "GOOD", "FAIR", "POOR"], { message: "Choose the book's condition." }),
    description: z.string().trim().max(1000, "Keep the description under 1000 characters.").optional().or(z.literal("")),
    priceRupees: z.string().trim().optional().or(z.literal("")),
    coverUrl: httpsUrl.optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    if (d.type === "SALE") {
      const n = Number(d.priceRupees);
      if (!d.priceRupees || !Number.isFinite(n) || n <= 0 || n > 100000) {
        ctx.addIssue({ code: "custom", path: ["priceRupees"], message: "Enter a price between ₹1 and ₹1,00,000." });
      }
    }
  });

export type ListingInput = z.infer<typeof listingSchema>;

// ───────────────────────── Browse / search ─────────────────────────

export type ListingCard = {
  id: string;
  title: string;
  author: string;
  genre: string | null;
  type: ListingType;
  condition: BookCondition;
  status: ListingStatus;
  pricePaise: number | null;
  imageUrl: string | null;
  neighbourhood: string | null;
  /** Rounded, viewer-relative; null when either side has no location. */
  distanceKm: number | null;
  owner: { username: string; name: string | null };
  isMine: boolean;
  createdAt: Date;
};

export type BrowseParams = {
  q?: string;
  type?: ListingType;
  condition?: BookCondition;
  genreId?: string;
  radiusKm?: number;
  sort?: "near" | "new";
  take?: number;
};

const cardSelect = {
  id: true,
  type: true,
  condition: true,
  status: true,
  pricePaise: true,
  neighbourhood: true,
  latitude: true,
  longitude: true,
  createdAt: true,
  ownerId: true,
  owner: { select: { username: true, name: true } },
  book: { select: { title: true, author: true, genre: { select: { name: true } } } },
  images: { orderBy: { position: "asc" }, take: 1, select: { url: true } },
} satisfies Prisma.BookListingSelect;

type Row = Prisma.BookListingGetPayload<{ select: typeof cardSelect }>;

function toCard(r: Row, viewer: { id: string; lat: number | null; lng: number | null }): ListingCard {
  const d =
    viewer.lat != null && viewer.lng != null && r.latitude != null && r.longitude != null
      ? distanceKm(viewer.lat, viewer.lng, r.latitude, r.longitude)
      : null;
  return {
    id: r.id,
    title: r.book.title,
    author: r.book.author,
    genre: r.book.genre?.name ?? null,
    type: r.type,
    condition: r.condition,
    status: r.status,
    pricePaise: r.pricePaise,
    imageUrl: r.images[0]?.url ?? null,
    neighbourhood: r.neighbourhood,
    distanceKm: d == null ? null : Math.max(0.5, Math.round(d * 2) / 2),
    owner: r.owner,
    isMine: r.ownerId === viewer.id,
    createdAt: r.createdAt,
  };
}

async function viewerLocation(userId: string) {
  const p = await prisma.profile.findUnique({ where: { userId }, select: { latitude: true, longitude: true } });
  return { id: userId, lat: p?.latitude ?? null, lng: p?.longitude ?? null };
}

/** Available listings, filtered and sorted for the Discover page. */
export async function browseListings(userId: string, params: BrowseParams = {}): Promise<{ items: ListingCard[]; hasLocation: boolean }> {
  const viewer = await viewerLocation(userId);
  const hasLocation = viewer.lat != null && viewer.lng != null;
  const radius = params.radiusKm && RADIUS_OPTIONS_KM.includes(params.radiusKm as 1 | 5 | 10) ? params.radiusKm : undefined;
  const q = params.q?.trim().slice(0, 100);

  const where: Prisma.BookListingWhereInput = {
    status: "AVAILABLE",
    removedAt: null,
    ...(params.type ? { type: params.type } : {}),
    ...(params.condition ? { condition: params.condition } : {}),
    ...(params.genreId ? { book: { genreId: params.genreId } } : {}),
    ...(q
      ? {
          OR: [
            { book: { title: { contains: q, mode: "insensitive" } } },
            { book: { author: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  // With a radius, pre-filter by bounding box (uses the lat/lng index), then check exactly.
  if (radius && hasLocation) {
    const b = boundingBox(viewer.lat!, viewer.lng!, radius);
    where.latitude = { gte: b.minLat, lte: b.maxLat };
    where.longitude = { gte: b.minLng, lte: b.maxLng };
  }

  const rows = await prisma.bookListing.findMany({
    where,
    select: cardSelect,
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  let items = rows.map((r) => toCard(r, viewer));
  if (radius && hasLocation) items = items.filter((c) => c.distanceKm != null && c.distanceKm <= radius);

  const sort = params.sort ?? (hasLocation ? "near" : "new");
  if (sort === "near" && hasLocation) {
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }
  return { items: items.slice(0, params.take ?? 48), hasLocation };
}

/** The signed-in user's own listings (not removed), newest first. */
export async function myListings(userId: string): Promise<ListingCard[]> {
  const rows = await prisma.bookListing.findMany({
    where: { ownerId: userId, status: { not: "REMOVED" } },
    select: cardSelect,
    orderBy: { createdAt: "desc" },
  });
  return rows.map((r) => toCard(r, { id: userId, lat: null, lng: null }));
}

/** One listing for its detail page. Never returns coordinates. */
export async function getListing(id: string, userId: string) {
  const viewer = await viewerLocation(userId);
  const r = await prisma.bookListing.findFirst({
    where: { id, status: { not: "REMOVED" } },
    select: {
      ...cardSelect,
      description: true,
      updatedAt: true,
      book: { select: { title: true, author: true, isbn: true, genreId: true, genre: { select: { name: true } } } },
      images: { orderBy: { position: "asc" }, select: { id: true, url: true, alt: true } },
      owner: { select: { username: true, name: true, image: true, createdAt: true } },
    },
  });
  if (!r) return null;
  const card = toCard(r as unknown as Row, viewer);
  return {
    ...card,
    description: r.description,
    isbn: r.book.isbn,
    genreId: r.book.genreId,
    images: r.images,
    owner: r.owner,
    updatedAt: r.updatedAt,
  };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListing>>>;
