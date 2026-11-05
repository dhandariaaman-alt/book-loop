"use server";

// Community moderator actions (PRD 5.3, 5.4). Moderators handle reports in
// their own communities and can remove listings or reviews, or escalate to
// admins. They can NOT ban users or change roles.

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { REPORT_OPS, applyReportOp, moderatorScope, removeListingAsModerator, removeReviewAsModerator } from "@/lib/admin";
import type { FormState } from "./auth";

const schema = z
  .object({
    reportId: z.string().trim().min(1).max(40),
    op: z.enum(REPORT_OPS),
    note: z.string().trim().max(1000, "Keep the note under 1000 characters.").optional().transform((v) => v || undefined),
    shortcut: z.enum(["NONE", "REMOVE_LISTING", "REMOVE_REVIEW"]).optional().default("NONE"),
  })
  .refine((d) => d.op !== "RESOLVE" || !!d.note, { message: "Add a resolution note.", path: ["note"] })
  .refine((d) => d.op !== "ESCALATE" || !!d.note, { message: "Tell the admins why you're escalating.", path: ["note"] })
  .refine((d) => d.shortcut === "NONE" || d.op === "RESOLVE", { message: "Content can only be removed when resolving.", path: ["shortcut"] });

export async function moderatorReportAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireRole(["MODERATOR", "ADMIN"]);
  const parsed = schema.safeParse({
    reportId: fd.get("reportId") ?? "",
    op: fd.get("op") ?? "",
    note: fd.get("note") ?? undefined,
    shortcut: fd.get("shortcut") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const d = parsed.data;

  // The report must be inside this moderator's scope.
  const scope = await moderatorScope(me);
  const report = await prisma.report.findFirst({
    where: { AND: [{ id: d.reportId }, scope.reportWhere] },
    select: { status: true, listingId: true, reviewId: true },
  });
  if (!report) return { error: "That report isn't in your communities." };
  if (report.status === "RESOLVED" || report.status === "DISMISSED") return { error: "That report is already closed." };
  if (report.status === "ESCALATED" && !scope.isAdmin) return { error: "This report is with the admins now." };

  const why = d.note ?? "Resolved from a report";
  let extra = "";
  if (d.shortcut === "REMOVE_LISTING") {
    if (!report.listingId) return { error: "This report has no listing to remove." };
    const r = await removeListingAsModerator(me.id, report.listingId, why, "LISTING_REMOVED_BY_MODERATOR");
    if (r.error) return r;
    revalidatePath("/discover");
    revalidatePath(`/books/${report.listingId}`);
    extra = " The listing was removed.";
  } else if (d.shortcut === "REMOVE_REVIEW") {
    if (!report.reviewId) return { error: "This report has no review to remove." };
    const r = await removeReviewAsModerator(me.id, report.reviewId, why);
    if (r.error) return r;
    extra = " The review was removed.";
  }

  const res = await applyReportOp(me.id, d.reportId, d.op, d.note);
  if (!res.ok) return { error: res.error };

  revalidatePath("/moderator");
  revalidatePath("/admin/reports");
  revalidatePath("/admin");
  const label = {
    UNDER_REVIEW: "Marked under review.",
    ESCALATE: "Escalated. The admins have been notified.",
    DISMISS: "Report dismissed.",
    RESOLVE: "Report resolved.",
  }[d.op];
  return { success: label + extra };
}
