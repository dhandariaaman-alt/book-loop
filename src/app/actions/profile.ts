"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { coarsen, reverseGeocode } from "@/lib/geo";
import { locationSchema, profileSchema } from "@/lib/validation";
import type { FormState } from "./auth";

export async function updateProfileAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();

  const parsed = profileSchema.safeParse({
    name: formData.get("name"),
    username: formData.get("username"),
    bio: formData.get("bio") ?? "",
    neighbourhood: formData.get("neighbourhood") ?? "",
    city: formData.get("city") ?? "",
    genres: formData.getAll("genres"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const clash = await prisma.user.findFirst({
    where: { username: d.username, NOT: { id: user.id } },
    select: { id: true },
  });
  if (clash) return { error: "That username is taken." };

  const genreIds = (
    await prisma.genre.findMany({ where: { id: { in: d.genres } }, select: { id: true } })
  ).map((g) => ({ id: g.id }));

  await prisma.user.update({
    where: { id: user.id },
    data: {
      name: d.name,
      username: d.username,
      profile: {
        upsert: {
          create: {
            bio: d.bio || null,
            neighbourhood: d.neighbourhood || null,
            city: d.city || null,
            favouriteGenres: { connect: genreIds },
          },
          update: {
            bio: d.bio || null,
            neighbourhood: d.neighbourhood || null,
            city: d.city || null,
            favouriteGenres: { set: genreIds },
          },
        },
      },
    },
  });

  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}

export type LocationResult = { ok: true; neighbourhood: string | null; city: string | null } | { ok: false; error: string };

export async function saveLocationAction(latitude: number, longitude: number): Promise<LocationResult> {
  const user = await requireUser();
  const parsed = locationSchema.safeParse({ latitude, longitude });
  if (!parsed.success) return { ok: false, error: "That location doesn't look right." };

  const lat = coarsen(parsed.data.latitude);
  const lng = coarsen(parsed.data.longitude);
  const place = await reverseGeocode(lat, lng);

  await prisma.profile.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      latitude: lat,
      longitude: lng,
      locationUpdatedAt: new Date(),
      neighbourhood: place.neighbourhood,
      city: place.city,
    },
    update: {
      latitude: lat,
      longitude: lng,
      locationUpdatedAt: new Date(),
      ...(place.neighbourhood ? { neighbourhood: place.neighbourhood } : {}),
      ...(place.city ? { city: place.city } : {}),
    },
  });

  revalidatePath("/", "layout");
  return { ok: true, ...place };
}

export async function clearLocationAction(): Promise<void> {
  const user = await requireUser();
  await prisma.profile.update({
    where: { userId: user.id },
    data: { latitude: null, longitude: null, locationUpdatedAt: null },
  });
  revalidatePath("/", "layout");
}
