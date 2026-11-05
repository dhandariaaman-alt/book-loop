import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { rateLimit } from "@/lib/rate-limit";

// POST   { endpoint, keys: { p256dh, auth } }  → save this browser's push subscription
// DELETE { endpoint }                          → remove it

const subSchema = z.object({
  endpoint: z.string().url().max(2000).startsWith("https://"),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

async function userId() {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function POST(req: NextRequest) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`push-sub:${id}`, 20, 60 * 60_000)) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }
  const parsed = subSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid subscription." }, { status: 400 });
  const { endpoint, keys } = parsed.data;

  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: { userId: id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    update: { userId: id, p256dh: keys.p256dh, auth: keys.auth },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const id = await userId();
  if (!id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const body = (await req.json().catch(() => null)) as { endpoint?: unknown } | null;
  const endpoint = typeof body?.endpoint === "string" ? body.endpoint : "";
  if (!endpoint) return NextResponse.json({ error: "Missing endpoint." }, { status: 400 });
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: id } });
  return NextResponse.json({ ok: true });
}
