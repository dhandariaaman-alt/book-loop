// Labels for trust, safety and donation features. No database code, so client
// components can import this.

import type {
  DisputeKind,
  DisputeStatus,
  DonationRequestStatus,
  DonationStatus,
  HandoverMethod,
  InstitutionType,
  VerificationStatus,
} from "@prisma/client";

export const REPORT_REASONS = ["Spam", "Inappropriate", "Fake listing", "Harassment", "Scam", "Other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const DISPUTE_KINDS: { value: DisputeKind; label: string }[] = [
  { value: "NO_SHOW", label: "No-show" },
  { value: "FAILED_HANDOVER", label: "Failed handover" },
  { value: "NOT_RETURNED", label: "Not returned" },
  { value: "DAMAGED", label: "Damaged" },
  { value: "OTHER", label: "Other" },
];
export const disputeKindLabel = (k: DisputeKind) => DISPUTE_KINDS.find((d) => d.value === k)?.label ?? k;

export const DISPUTE_STATUS_LABEL: Record<DisputeStatus, string> = {
  OPEN: "Open",
  INVESTIGATING: "Being looked into",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export const INSTITUTION_TYPES: { value: InstitutionType; label: string }[] = [
  { value: "LIBRARY", label: "Library" },
  { value: "COMMUNITY_CENTRE", label: "Community centre" },
  { value: "SCHOOL", label: "School" },
  { value: "OTHER", label: "Other organisation" },
];
export const institutionTypeLabel = (t: InstitutionType) =>
  INSTITUTION_TYPES.find((x) => x.value === t)?.label ?? "Organisation";

export const VERIFICATION_LABEL: Record<VerificationStatus, string> = {
  PENDING: "Waiting for review",
  VERIFIED: "Verified",
  REJECTED: "Not approved",
};

export const DONATION_STATUS_LABEL: Record<DonationStatus, string> = {
  PLEDGED: "Pledged",
  SCHEDULED: "Drop-off scheduled",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const DONATION_STATUS_TINT: Record<DonationStatus, string> = {
  PLEDGED: "bg-butter",
  SCHEDULED: "bg-sky",
  RECEIVED: "bg-mint",
  CANCELLED: "bg-rose",
};

export const REQUEST_STATUS_LABEL: Record<DonationRequestStatus, string> = {
  OPEN: "Open",
  FULFILLED: "Fulfilled",
  CLOSED: "Closed",
};

export const HANDOVER_METHODS: { value: HandoverMethod; label: string }[] = [
  { value: "INSTITUTION_POINT", label: "Drop off at the institution" },
  { value: "PUBLIC_PLACE", label: "Meet in a public place" },
  { value: "SELF_ARRANGED_DELIVERY", label: "I'll arrange delivery" },
  { value: "OTHER", label: "Something else" },
];
export const handoverLabel = (m: HandoverMethod) => HANDOVER_METHODS.find((x) => x.value === m)?.label ?? m;

/** Disputes can be opened while a hand-off is active, or within 30 days of completion. */
export const DISPUTE_WINDOW_DAYS = 30;
export function canOpenDispute(tx: { status: string; completedAt: Date | null }) {
  if (tx.status === "CANCELLED") return false;
  if (tx.status === "COMPLETED") {
    return !!tx.completedAt && Date.now() - tx.completedAt.getTime() < DISPUTE_WINDOW_DAYS * 24 * 60 * 60_000;
  }
  return true;
}
