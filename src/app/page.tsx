import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const WAYS = [
  { title: "Borrow", text: "Read a neighbour's book for a few weeks, then hand it back.", icon: "↻" },
  { title: "Exchange", text: "Swap a book you've finished for one you haven't.", icon: "⇄" },
  { title: "Give away", text: "Pass books on for free to someone who'll read them.", icon: "♡" },
  { title: "Sell", text: "List books at a fair price. Arrange payment yourselves.", icon: "₹" },
];

const STEPS = [
  { n: "1", title: "Share your neighbourhood", text: "We use your approximate area, never your address." },
  { n: "2", title: "List or find a book", text: "Browse books within 1, 5 or 10 km of you." },
  { n: "3", title: "Request and chat", text: "Agree on details and pick a public place to meet." },
  { n: "4", title: "Hand over and rate", text: "Ratings after each exchange build community trust." },
];

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-6xl px-4">
      <section className="grid items-center gap-10 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="mb-4 inline-block rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
            Community book sharing
          </p>
          <h1 className="heading text-4xl font-semibold leading-tight sm:text-6xl">
            Every book deserves <span className="text-brand">another reader.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            BookLoop connects readers in your neighbourhood to borrow, exchange, give away and donate books, so they
            don&apos;t sit idle on a shelf.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Join your local loop
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              I have an account
            </Link>
          </div>
        </div>
        <div aria-hidden className="relative hidden h-80 lg:block">
          {[
            { c: "#2f6f5e", r: "-8deg", l: "8%", t: "10%" },
            { c: "#c2703d", r: "4deg", l: "34%", t: "2%" },
            { c: "#4a5d8a", r: "-2deg", l: "58%", t: "14%" },
          ].map((b, i) => (
            <div
              key={i}
              className="absolute h-64 w-40 rounded-r-xl rounded-l-sm shadow-xl"
              style={{ background: b.c, transform: `rotate(${b.r})`, left: b.l, top: b.t }}
            >
              <div className="absolute inset-y-0 left-2 w-px bg-white/25" />
              <div className="mx-6 mt-10 h-2 rounded bg-white/50" />
              <div className="mx-6 mt-2 h-2 w-16 rounded bg-white/30" />
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="ways" className="py-10">
        <h2 id="ways" className="heading text-2xl font-semibold sm:text-3xl">
          Four ways to keep books moving
        </h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {WAYS.map((w) => (
            <div key={w.title} className="card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-brand-soft text-lg text-brand" aria-hidden>
                {w.icon}
              </span>
              <h3 className="mt-4 font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted">{w.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-4 text-sm text-muted">
          Libraries and community centres can also post donation requests for the books they need.
        </p>
      </section>

      <section aria-labelledby="how" className="py-12">
        <h2 id="how" className="heading text-2xl font-semibold sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-4">
              <span className="heading flex size-9 shrink-0 items-center justify-center rounded-full border border-border text-lg text-brand">
                {s.n}
              </span>
              <div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1 text-sm text-muted">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
