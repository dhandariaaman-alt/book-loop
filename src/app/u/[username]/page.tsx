import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Avatar } from "@/components/avatar";
import { Doodle } from "@/components/landing/decorations";
import "@fontsource/caveat/latin-500.css";

type Params = { params: Promise<{ username: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { username } = await params;
  return { title: `@${username}` };
}

const RULED = {
  backgroundColor: "#fffaf0",
  backgroundImage: "repeating-linear-gradient(transparent 0 27px, rgba(120,100,60,0.13) 27px 28px)",
} as const;
const TINTS = ["bg-butter", "bg-mint", "bg-lavender", "bg-peach"] as const;

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
      <section className="card relative overflow-hidden border-[#e8dcc0] p-0" style={RULED}>
        <Doodle kind="bookmark" className="right-6 -top-1 hidden w-8 md:block" color="var(--brand)" fill="var(--butter)" animation="wiggle" />
        <div className="border-b border-dashed border-[#d9c9a3] bg-[#fffaf0]/80 px-5 py-2 font-mono text-[11px] uppercase tracking-widest text-muted">
          BookLoop member · No. {user.id.slice(0, 6).toUpperCase()}
        </div>
        <div className="flex flex-col gap-6 p-5 sm:flex-row sm:items-start sm:p-6">
        <span className="shrink-0 self-start rounded-full ring-4 ring-peach">
          <Avatar name={user.name} image={user.image} size={96} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="heading text-3xl font-semibold">{user.name ?? user.username}</h1>
            {user.role === "INSTITUTION" && (
              <span className="rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">Institution</span>
            )}
          </div>
          <p className="text-sm text-muted">
            @{user.username}
            {place && <> · 📍 <span className="font-hand text-xl text-fg">{place}</span></>} · Joined{" "}
            {user.createdAt.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}
          </p>
          {user.profile?.bio && <p className="mt-3 max-w-prose">{user.profile.bio}</p>}
          {!!user.profile?.favouriteGenres.length && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Favourite genres">
              {user.profile.favouriteGenres.map((g) => (
                <li key={g.name} className="rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs">{g.name}</li>
              ))}
            </ul>
          )}
          {isMe && (
            <Link href="/settings/profile" className="btn-secondary mt-4">Edit profile</Link>
          )}
        </div>
        </div>
      </section>

      <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Rating", value: rating._count ? `★ ${rating._avg.rating?.toFixed(1)}` : "—", sub: `${rating._count} reviews` },
          { label: "Books listed", value: user._count.listings },
          { label: "Borrowed / exchanged", value: borrowedOrExchanged },
          { label: "Completed", value: completed, sub: "transactions" },
        ].map((s, i) => (
          <div key={s.label} className={`card p-4 ${TINTS[i % TINTS.length]}`}>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{s.label}</dt>
            <dd className="heading mt-1 text-3xl font-semibold">{s.value}</dd>
            {s.sub && <dd className="text-xs text-muted">{s.sub}</dd>}
          </div>
        ))}
      </dl>

      <section className="mt-10" aria-labelledby="books">
        <h2 id="books" className="heading text-2xl font-semibold">Available books</h2>
        {user.listings.length === 0 ? (
          <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-surface/70 px-4 py-8 text-center font-hand text-2xl text-muted">No books on the shelf yet. Check back soon!</p>
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
          <p className="mt-4 rounded-2xl border-2 border-dashed border-border bg-surface/70 px-4 py-8 text-center font-hand text-2xl text-muted">No reviews yet. Be the first to swap with them!</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="card border-[#e8dcc0] p-4" style={RULED}>
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
                {r.comment && <p className="font-hand mt-1 text-xl leading-7">{r.comment}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
