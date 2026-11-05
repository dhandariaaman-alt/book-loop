import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { ProfileForm } from "./profile-form";
import { LocationCard } from "./location-card";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const sessionUser = await requireUser();
  const { welcome } = await searchParams;

  const [user, genres] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: sessionUser.id },
      select: {
        name: true,
        username: true,
        email: true,
        image: true,
        profile: {
          select: {
            bio: true,
            neighbourhood: true,
            city: true,
            latitude: true,
            locationUpdatedAt: true,
            favouriteGenres: { select: { id: true } },
          },
        },
      },
    }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const p = user.profile;

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      {welcome && (
        <div className="mb-6 rounded-2xl bg-brand-soft p-5 text-brand">
          <p className="font-semibold">Welcome to BookLoop, {user.name?.split(" ")[0]}!</p>
          <p className="mt-1 text-sm">Add your neighbourhood and favourite genres so we can show you books nearby.</p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <Avatar name={user.name} image={user.image} size={64} />
        <div>
          <h1 className="heading text-3xl font-semibold">Your profile</h1>
          <p className="text-sm text-muted">{user.email} · only you can see your email</p>
        </div>
      </div>

      <div className="mt-8 space-y-6">
        <LocationCard
          hasLocation={p?.latitude != null}
          neighbourhood={p?.neighbourhood ?? null}
          city={p?.city ?? null}
          updatedAt={p?.locationUpdatedAt?.toISOString() ?? null}
        />
        <ProfileForm
          genres={genres}
          initial={{
            name: user.name ?? "",
            username: user.username,
            bio: p?.bio ?? "",
            neighbourhood: p?.neighbourhood ?? "",
            city: p?.city ?? "",
            genreIds: p?.favouriteGenres.map((g) => g.id) ?? [],
          }}
        />
      </div>
    </div>
  );
}
