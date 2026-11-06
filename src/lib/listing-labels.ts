// Listing labels and formatting. No database code, so client components can import this.

import type { BookCondition, ListingStatus, ListingType } from "@prisma/client";

export const LISTING_TYPES: { value: ListingType; label: string; verb: string }[] = [
  { value: "BORROW", label: "Borrow", verb: "Lend" },
  { value: "EXCHANGE", label: "Exchange", verb: "Swap" },
  { value: "GIVEAWAY", label: "Give away", verb: "Give away" },
  { value: "SALE", label: "Sale", verb: "Sell" },
];

export const CONDITIONS: { value: BookCondition; label: string; hint: string }[] = [
  { value: "NEW", label: "New", hint: "Unread, no marks" },
  { value: "LIKE_NEW", label: "Like new", hint: "Read once, looks unread" },
  { value: "GOOD", label: "Good", hint: "Some wear, all pages intact" },
  { value: "FAIR", label: "Fair", hint: "Worn cover or notes inside" },
  { value: "POOR", label: "Poor", hint: "Heavily used but readable" },
];

export const STATUS_LABEL: Record<ListingStatus, string> = {
  AVAILABLE: "Available",
  REQUEST_PENDING: "Request pending",
  RESERVED: "Reserved",
  HANDED_OVER: "Handed over",
  COMPLETED: "Completed",
  UNAVAILABLE: "Unavailable",
  REMOVED: "Removed",
};

export const typeLabel = (t: ListingType) => LISTING_TYPES.find((x) => x.value === t)?.label ?? t;
export const conditionLabel = (c: BookCondition) => CONDITIONS.find((x) => x.value === c)?.label ?? c;

export function formatPrice(paise: number | null | undefined) {
  if (paise == null) return null;
  return `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** True for published covers we looked up (Open Library) rather than photos the owner uploaded. */
export const isStockCover = (url: string | null | undefined) =>
  Boolean(url && url.startsWith("https://covers.openlibrary.org/"));
