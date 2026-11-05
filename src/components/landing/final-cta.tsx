import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";

export function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <Reveal>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-peach via-butter to-mint px-6 py-12 text-center text-fg sm:px-12 sm:py-16">
          <div aria-hidden className="dot-grid pointer-events-none absolute inset-0 opacity-60" />
          <div
            aria-hidden
            className="animate-blob pointer-events-none absolute -left-16 -top-16 h-64 w-64 rounded-full bg-white/60 blur-3xl"
          />
          <div
            aria-hidden
            className="animate-blob pointer-events-none absolute -bottom-20 -right-10 h-72 w-72 rounded-full bg-lavender blur-3xl"
            style={{ animationDelay: "-6s" }}
          />
          <div
            aria-hidden
            className="animate-blob pointer-events-none absolute left-1/2 top-1/3 h-48 w-48 rounded-full bg-sky blur-3xl"
            style={{ animationDelay: "-12s" }}
          />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="heading text-3xl sm:text-5xl">
              Your next favourite book might be on your neighbour&apos;s shelf.
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-muted sm:text-lg">
              Borrow, swap, give or sell books close to home, and meet in public places.
            </p>
            <Link
              href="/register"
              className="btn-primary mt-8 px-6 py-3 text-base shadow-lg shadow-brand/20"
            >
              Join BookLoop, it&apos;s free
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
