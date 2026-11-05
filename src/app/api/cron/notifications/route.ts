import { timingSafeEqual } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { processPendingDeliveries } from "@/lib/notify";

// Retries pending/failed email, push and SMS deliveries.
// Call every few minutes with header  Authorization: Bearer <CRON_SECRET>
export const dynamic = "force-dynamic";

function authorized(req: NextRequest, secret: string) {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function handle(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET is not set." }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  const processed = await processPendingDeliveries();
  return NextResponse.json({ ok: true, processed });
}

export const GET = handle;
export const POST = handle;
