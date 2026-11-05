import { NextResponse } from "next/server";
import { vapidPublicKey } from "@/lib/push";

// GET → { key: string | null }. null means browser push isn't configured on this server.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ key: vapidPublicKey() }, { headers: { "Cache-Control": "no-store" } });
}
