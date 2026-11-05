"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { FAMOUS_BOOKS } from "@/lib/famous-books";
import { BookCover } from "@/components/landing/book-cover";

const WORDS = ["reader.", "chapter.", "home.", "neighbour."];

const STACK = [
  { idx: 0, rot: -10, dur: 6.5, delay: 0, x: -150, y: 30, depth: 0.6, z: 1 },
  { idx: 4, rot: -5, dur: 7.5, delay: -1.5, x: -70, y: -20, depth: 0.9, z: 2 },
  { idx: 7, rot: 0, dur: 5.5, delay: -3, x: 0, y: 50, depth: 1.3, z: 3 },
  { idx: 9, rot: 6, dur: 8, delay: -2, x: 80, y: -30, depth: 1.0, z: 2 },
  { idx: 16, rot: 10, dur: 6, delay: -4, x: 150, y: 40, depth: 0.7, z: 1 },
];

const TRUST = [
  {
    label: "Free to join",
    d: "M20 12v9H4v-9M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z",
  },
  {
    label: "Meet in public places",
    d: "M12 22s7-6.2 7-12a7 7 0 10-14 0c0 5.8 7 12 7 12zM12 12a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  },
  {
    label: "Your address stays private",
    d: "M5 11h14v10H5zM8 11V7a4 4 0 118 0v4",
  },
];

export function Hero() {
  const [wordIdx, setWordIdx] = useState(0);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced.current) return;
    const t = setInterval(() => setWordIdx((i) => (i + 1) % WORDS.length), 2200);
    return () => clearInterval(t);
  }, []);

  function onMove(e: React.PointerEvent<HTMLDivElement>) {
    if (reduced.current) return;
    const r = e.currentTarget.getBoundingClientRect();
    const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
    setTilt({ x: -ny, y: nx });
  }

  const stackStyle = {
    "--tx": tilt.x,
    "--ty": tilt.y,
    transform: `perspective(1000px) rotateX(calc(var(--tx) * 10deg)) rotateY(calc(var(--ty) * 10deg))`,
    transition: "transform 200ms ease-out",
    transformStyle: "preserve-3d",
  } as CSSProperties;

  return (
    <section className="relative overflow-hidden">
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute -top-24 -left-24 -z-10 h-96 w-96 rounded-full bg-brand opacity-20 blur-3xl"
      />
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute top-1/3 -right-24 -z-10 h-96 w-96 rounded-full bg-accent opacity-20 blur-3xl"
        style={{ animationDelay: "-4s" }}
      />
      <div
        aria-hidden
        className="animate-blob pointer-events-none absolute bottom-0 left-1/3 -z-10 h-80 w-80 rounded-full bg-brand opacity-10 blur-3xl"
        style={{ animationDelay: "-8s" }}
      />
      {/* fade the glow out so the section has no hard bottom edge */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-b from-transparent to-bg" />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-4 py-16 sm:py-24 lg:grid-cols-2">
        <div>
          <span className="animate-fade-up inline-block rounded-full bg-brand-soft px-3 py-1 text-sm font-medium text-brand">
            Community book sharing
          </span>
          <h1
            className="heading animate-fade-up mt-5 text-4xl font-semibold leading-tight sm:text-6xl"
            style={{ animationDelay: "120ms" }}
          >
            Every book deserves another{" "}
            <span className="sr-only" aria-live="polite">
              reader, chapter, home or neighbour.
            </span>
            <span
              aria-hidden
              className="inline-block min-w-[3.5ch] text-brand sm:min-w-[6ch]"
            >
              <span key={wordIdx} className="animate-word-in inline-block">
                {WORDS[wordIdx]}
              </span>
            </span>
          </h1>
          <p
            className="animate-fade-up mt-5 max-w-xl text-lg text-muted"
            style={{ animationDelay: "240ms" }}
          >
            Borrow, exchange, give away and donate books with people in your neighbourhood, so
            stories keep moving instead of gathering dust.
          </p>
          <div
            className="animate-fade-up mt-8 flex flex-wrap gap-3"
            style={{ animationDelay: "360ms" }}
          >
            <Link href="/register" className="btn-primary px-6 py-3 text-base">
              Join your local loop
            </Link>
            <Link href="/login" className="btn-secondary px-6 py-3 text-base">
              I have an account
            </Link>
          </div>
          <ul
            className="animate-fade-up mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted"
            style={{ animationDelay: "480ms" }}
          >
            {TRUST.map((t) => (
              <li key={t.label} className="flex items-center gap-2">
                <svg
                  aria-hidden
                  viewBox="0 0 24 24"
                  className="h-4 w-4 text-brand"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d={t.d} />
                </svg>
                {t.label}
              </li>
            ))}
          </ul>
        </div>

        <div
          className="relative hidden h-[520px] items-center justify-center lg:flex"
          onPointerMove={onMove}
          onPointerLeave={() => setTilt({ x: 0, y: 0 })}
        >
          <div className="relative h-[330px] w-[140px]" style={stackStyle}>
            {STACK.map((b, i) => {
              const book = FAMOUS_BOOKS[b.idx];
              if (!book) return null;
              const px = tilt.y * 14 * b.depth;
              const py = tilt.x * 14 * b.depth;
              return (
                <div
                  key={b.idx}
                  className="absolute top-1/2 left-1/2 transition-transform duration-200 ease-out"
                  style={{
                    zIndex: b.z,
                    transform: `translate(calc(-50% + ${b.x + px}px), calc(-50% + ${b.y + py}px))`,
                  }}
                >
                  <div
                    className="animate-float transition-transform duration-300 hover:scale-110"
                    style={
                      {
                        "--r": `${b.rot}deg`,
                        "--float-duration": `${b.dur}s`,
                        animationDelay: `${b.delay}s`,
                      } as CSSProperties
                    }
                  >
                    <BookCover book={book} size="md" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
