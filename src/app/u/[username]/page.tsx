import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const TYPE_LABEL = { BORROW: "Borrow", EXCHANGE: "Exchange", GIVEAWAY: "Free", SALE: "For sale" } as const;

export default async function PublicProfilePage({ params }: Params) {
  const { username } = await params;
  const session = await auth();

  // Select public fields only. Never coordinates, email or address.
  const user = await prisma.user.findUnique({
    where: { username: username.toLowerCase() },
    select: {
      id: true,
      name: true,
      username: true,
      image: true,
      role: true,
      status: true,
      createdAt: true,
      profile: {
        select: { bio: true, neighbourhood: true, city: true, favouriteGenres: { select: { name: true } } },
      },
      _count: { select: { listings: { where: { status: { not: "REMOVED" } } } } },
      listings: {
        where: { status: "AVAILABLE" },
        orderBy: { createdAt: "desc" },
        take: 12,
        select: { id: true, type: true, book: { select: { title: true, author: true } } },
      },
    },
  });
  if (!user || user.status === "BANNED") notFound();

  const [completed, borrowedOrExchanged, rating, reviews] = await Promise.all([
    prisma.transaction.count({
      where: { status: "COMPLETED", OR: [{ ownerId: user.id }, { receiverId: user.id }] },
    }),
    prisma.transaction.count({
      where: { status: "COMPLETED", receiverId: user.id, type: { in: ["BORROW", "EXCHANGE"] } },
    }),
    prisma.review.aggregate({
      where: { revieweeId: user.id, removedAt: null },
      _avg: { rating: true },
      _count: true,
    }),
    prisma.review.findMany({
      where: { revieweeId: user.id, removedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, rating: true, comment: true, createdAt: true, reviewer: { select: { name: true, username: true } } },
    }),
  ]);

  const isMe = session?.user?.id === user.id;
  const place = [user.profile?.neighbourhood, user.profile?.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <section className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-start">
        <Avatar name={user.name} image={user.image} size={96} />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="heading text-3xl font-semibold">{user.name ?? user.username}</h1>
            {user.role === "INSTITUTION" && (
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Institution</span>
            )}
          </div>
          <p className="text-sm text-muted">
            @{user.username}
            {place && <> · 📍 {place}</>} · Joined{" "}
            {user.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          </p>
          {user.profile?.bio && <p className="mt-3 max-w-prose">{user.profile.bio}</p>}
          {!!user.profile?.favouriteGenres.length && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Favourite genres">
              {user.profile.favouriteGenres.map((g) => (
                <li key={g.name} className="rounded-full border border-border px-2.5 py-0.5 text-xs">{g.name}</li>
              ))}
            </ul>
          )}
          {isMe && (
            <Link href="/settings/profile" className="btn-secondary mt-4">Edit profile</Link>
          )}
        </div>
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Rating", value: rating._count ? `★ ${rating._avg.rating?.toFixed(1)}` : "—", sub: `${rating._count} reviews` },
          { label: "Books listed", value: user._count.listings },
          { label: "Borrowed / exchanged", value: borrowedOrExchanged },
          { label: "Completed", value: completed, sub: "transactions" },
        ].map((s) => (
          <div key={s.label} className="card p-4">
            <dt className="text-xs text-muted">{s.label}</dt>
            <dd className="mt-1 text-2xl font-semibold">{s.value}</dd>
            {s.sub && <dd className="text-xs text-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="books">
        <h2 id="books" className="heading text-2xl font-semibold">Available books</h2>
        {user.listings.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No books listed yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {user.listings.map((l) => (
              <li key={l.id} className="card p-4">
                <span className="text-xs font-medium text-accent">{TYPE_LABEL[l.type]}</span>
                <p className="mt-1 font-medium">{l.book.title}</p>
                <p className="text-sm text-muted">{l.book.author}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="reviews">
        <h2 id="reviews" className="heading text-2xl font-semibold">Reviews</h2>
        {reviews.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card p-4">
                <p className="text-sm">
                  <span className="text-accent" aria-label={`${r.rating} out of 5 stars`}>
                    {"★".repeat(r.rating)}
                    <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                  </span>{" "}
                  by{" "}
                  <Link href={`/u/${r.reviewer.username}`} className="text-brand hover:underline">
                    {r.reviewer.name ?? r.reviewer.username}
                  </Link>
                </p>
                {r.comment && <p className="mt-1 text-sm">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
