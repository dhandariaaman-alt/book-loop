// Append-only log of sensitive actions (PRD section 3). Never throws.

import type { Prisma } from "@prisma/client";
import { headers } from "next/headers";
import { prisma } from "./prisma";

export async function audit(input: {
  actorId: string | null;
  action: string; // e.g. "USER_SUSPENDED", "INSTITUTION_VERIFIED"
  entityType?: string;
  entityId?: string;
  metadata?: Prisma.InputJsonValue;
}) {
  try {
    let ip: string | null = null;
    try {
      const h = await headers();
      ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip");
    } catch {
      /* not in a request context */
    }
    await prisma.auditLog.create({ data: { ...input, ip } });
  } catch (e) {
    console.error("[audit] failed to write", e);
  }
}
