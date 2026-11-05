// Cron: expire unconfirmed reservations and send borrow return reminders.
// Call with `Authorization: Bearer $CRON_SECRET` (e.g. every 15 minutes).

import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { expireReservations, sendReturnReminders } from "@/lib/transactions";

export const dynamic = "force-dynamic";

function authorised(header: string | null, secret: string) {
  if (!header?.startsWith("Bearer ")) return false;
  const a = Buffer.from(header.slice(7));
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not configured." }, { status: 503 });
  if (!authorised(req.headers.get("authorization"), secret)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const expired = await expireReservations();
  const { reminders, overdue } = await sendReturnReminders();
  return NextResponse.json({ ok: true, expired, reminders, overdue });
}
