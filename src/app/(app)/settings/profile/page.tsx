import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { Avatar } from "@/components/avatar";
import { ProfileForm } from "./profile-form";
import { LocationCard } from "./location-card";
import { Doodle } from "@/components/landing/decorations";

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
    <div className="max-w-3xl">
      {welcome && (
        <div className="card relative mb-6 border-brand/20 bg-mint p-5 text-brand md:pr-20">
          <Doodle kind="sparkle" className="right-5 top-3 hidden w-10 md:block" color="var(--brand)" fill="var(--butter)" animation="wiggle" />
          <p className="heading text-xl font-semibold">Welcome to BookLoop, {user.name?.split(" ")[0]}!</p>
          <p className="mt-1 text-sm">Add your neighbourhood and favourite genres so we can show you books nearby.</p>
        </div>
      )}
      <div className="flex items-center gap-4">
        <span className="shrink-0 rounded-full ring-4 ring-peach">
          <Avatar name={user.name} image={user.image} size={64} />
        </span>
        <div className="min-w-0">
          <h1 className="heading text-3xl font-semibold sm:text-4xl">Your profile</h1>
          <p className="break-words text-sm text-muted">{user.email} · only you can see your email</p>
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

        <section className="card p-5 sm:p-6" aria-labelledby="more-settings">
          <h2 id="more-settings" className="heading text-2xl font-semibold">More settings</h2>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/settings/notifications", title: "Notifications", text: "Email, push and SMS alerts" },
              { href: "/settings/blocked", title: "Blocked people", text: "People you've blocked" },
              { href: "/settings/institution", title: "Library or centre", text: "Register an institution" },
            ].map((l) => (
              <li key={l.href}>
                <Link href={l.href} className="card card-hover group block h-full p-4">
                  <span className="flex items-center justify-between font-medium">
                    {l.title}
                    <span aria-hidden className="text-muted transition-transform group-hover:translate-x-0.5">→</span>
                  </span>
                  <span className="mt-1 block text-sm text-muted">{l.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
