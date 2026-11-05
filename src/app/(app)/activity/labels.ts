export const TYPE_LABEL: Record<string, string> = {
  BORROW: "Borrow",
  EXCHANGE: "Exchange",
  GIVEAWAY: "Give away",
  SALE: "Sale",
};

export const TYPE_PILL: Record<string, string> = {
  BORROW: "bg-sky",
  EXCHANGE: "bg-lavender",
  GIVEAWAY: "bg-mint",
  SALE: "bg-peach",
};

const NEUTRAL = "bg-surface-2";

/** Tints for drawn cover placeholders when a listing has no photo. */
export const PLACEHOLDER_TINTS = ["bg-peach", "bg-sky", "bg-mint", "bg-lavender", "bg-butter", "bg-rose"];

export const REQUEST_STATUS: Record<string, { label: string; pill: string }> = {
  PENDING: { label: "Pending", pill: "bg-butter" },
  ACCEPTED: { label: "Accepted", pill: "bg-mint" },
  REJECTED: { label: "Declined", pill: "bg-rose" },
  CANCELLED: { label: "Cancelled", pill: NEUTRAL },
  EXPIRED: { label: "Expired", pill: NEUTRAL },
};

export const LISTING_STATUS: Record<string, { label: string; pill: string }> = {
  AVAILABLE: { label: "Available", pill: "bg-mint" },
  REQUEST_PENDING: { label: "Request pending", pill: "bg-butter" },
  RESERVED: { label: "Reserved", pill: "bg-lavender" },
  HANDED_OVER: { label: "Handed over", pill: "bg-sky" },
  COMPLETED: { label: "Completed", pill: "bg-mint" },
  UNAVAILABLE: { label: "Unavailable", pill: NEUTRAL },
  REMOVED: { label: "Removed", pill: NEUTRAL },
};

export const TX_STATUS: Record<string, { label: string; pill: string }> = {
  RESERVED: { label: "Reserved", pill: "bg-lavender" },
  HANDED_OVER: { label: "Handed over", pill: "bg-sky" },
  RETURN_PENDING: { label: "Return pending", pill: "bg-butter" },
  COMPLETED: { label: "Completed", pill: "bg-mint" },
  CANCELLED: { label: "Cancelled", pill: NEUTRAL },
  DISPUTED: { label: "Disputed", pill: "bg-rose" },
};

export function relativeDate(d: Date, now = new Date()): string {
  const diff = now.getTime() - d.getTime();
  const mins = Math.round(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function shortDate(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/** Transaction status pill, showing "Expired" for cancelled transactions whose reservation ran out. */
export function txStatusPill(status: string, reservationStatus?: string | null): { label: string; pill: string } {
  if (status === "CANCELLED" && reservationStatus === "EXPIRED") return { label: "Expired", pill: NEUTRAL };
  return TX_STATUS[status] ?? { label: status, pill: NEUTRAL };
}
