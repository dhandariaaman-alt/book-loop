"use client";

import { useRef, type ReactNode, type PointerEvent } from "react";
import { Reveal } from "@/components/landing/reveal";

const MAX_TILT = 8;

function Book({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 30"
      className={`h-10 w-8 ${className}`}
      style={style}
      aria-hidden
    >
      <rect x="2" y="2" width="20" height="26" rx="2" fill="currentColor" />
      <rect x="5" y="6" width="12" height="2" rx="1" fill="var(--surface)" opacity="0.8" />
      <rect x="5" y="10" width="8" height="2" rx="1" fill="var(--surface)" opacity="0.6" />
    </svg>
  );
}

// Each way gets its own pastel tint so the cards don't look identical.
const TINT: Record<string, string> = { borrow: "bg-mint", exchange: "bg-peach", give: "bg-rose", sell: "bg-sky" };

function Illustration({ kind }: { kind: string }) {
  const base = `relative mt-5 flex h-16 items-center justify-center overflow-hidden rounded-xl ${TINT[kind] ?? "bg-surface-2"}`;
  if (kind === "borrow")
    return (
      <div className={base} aria-hidden>
        <Book className="text-brand group-hover:[animation:wts-slide_1.8s_ease-in-out_infinite]" />
      </div>
    );
  if (kind === "exchange")
    return (
      <div className={`${base} gap-6`} aria-hidden>
        <Book className="text-brand group-hover:[animation:wts-swap-a_1.8s_ease-in-out_infinite]" />
        <Book className="text-accent group-hover:[animation:wts-swap-b_1.8s_ease-in-out_infinite]" />
      </div>
    );
  if (kind === "give")
    return (
      <div className={base} aria-hidden>
        <Book className="text-brand" />
        <svg
          viewBox="0 0 24 24"
          className="absolute left-1/2 top-3 ml-1 h-4 w-4 text-accent opacity-0 group-hover:[animation:wts-rise_1.8s_ease-out_infinite]"
        >
          <path
            fill="currentColor"
            d="M12 21s-7-4.6-9.3-9.1C1.2 8.8 3 5.5 6.2 5.5c2 0 3.2 1.1 3.8 2.2.6-1.1 1.8-2.2 3.8-2.2 3.2 0 5 3.3 3.5 6.4C19 16.4 12 21 12 21z"
          />
        </svg>
      </div>
    );
  return (
    <div className={base} aria-hidden>
      <svg
        viewBox="0 0 40 48"
        className="h-14 w-11 origin-top text-brand group-hover:[animation:wts-swing_1.6s_ease-in-out_infinite]"
      >
        <path d="M20 2v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M8 14a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v26a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4z"
          fill="currentColor"
        />
        <circle cx="20" cy="17" r="2.5" fill="var(--surface)" />
        <rect x="14" y="26" width="12" height="3" rx="1.5" fill="var(--surface)" opacity="0.9" />
        <rect x="16" y="32" width="8" height="3" rx="1.5" fill="var(--surface)" opacity="0.6" />
      </svg>
    </div>
  );
}

const icons: Record<string, ReactNode> = {
  borrow: (
    <path d="M4 5h6a3 3 0 0 1 3 3v12a2 2 0 0 0-2-2H4zM20 5h-4a3 3 0 0 0-3 3v12a2 2 0 0 1 2-2h5z" />
  ),
  exchange: <path d="M4 8h14m0 0-3-3m3 3-3 3M20 16H6m0 0 3-3m-3 3 3 3" />,
  give: (
    <path d="M12 20s-7-4.4-8.6-8.6C2.4 8.6 4 6 6.6 6c1.9 0 3.1 1 3.9 2.2h3C14.3 7 15.5 6 17.4 6 20 6 21.6 8.6 20.6 11.4 19 15.6 12 20 12 20z" />
  ),
  sell: (
    <>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1" />
    </>
  ),
};

const ways = [
  { key: "borrow", title: "Borrow", text: "Read a neighbour's book for a few weeks, then hand it back." },
  { key: "exchange", title: "Exchange", text: "Swap a book you've finished for one you haven't." },
  { key: "give", title: "Give away", text: "Pass books on for free to someone who'll read them." },
  { key: "sell", title: "Sell", text: "List books at a fair price and agree on payment yourselves." },
];

function TiltCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType === "touch") return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.transition = "transform 80ms linear";
    el.style.transform = `perspective(800px) rotateX(${((0.5 - py) * 2 * MAX_TILT).toFixed(2)}deg) rotateY(${((px - 0.5) * 2 * MAX_TILT).toFixed(2)}deg)`;
    el.style.setProperty("--x", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--y", `${(py * 100).toFixed(1)}%`);
  }

  function onLeave() {
    const el = ref.current;
    if (!el) return;
    el.style.transition = "transform 500ms cubic-bezier(0.22, 1, 0.36, 1)";
    el.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg)";
  }

  return (
    <div
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="card group relative h-full overflow-hidden p-6 will-change-transform"
      style={{ "--x": "50%", "--y": "50%" } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{
          background:
            "radial-gradient(240px circle at var(--x) var(--y), color-mix(in srgb, var(--brand) 16%, transparent), transparent 70%)",
        }}
      />
      <div className="relative">{children}</div>
    </div>
  );
}

export function WaysToShare() {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <style>{`
        @keyframes wts-slide { 0%,100% { transform: translateX(-24px); } 50% { transform: translateX(24px); } }
        @keyframes wts-swap-a { 0%,100% { transform: translateX(0); } 50% { transform: translateX(56px); } }
        @keyframes wts-swap-b { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-56px); } }
        @keyframes wts-rise { 0% { transform: translateY(24px) scale(.6); opacity: 0; } 30% { opacity: 1; } 100% { transform: translateY(-8px) scale(1.1); opacity: 0; } }
        @keyframes wts-swing { 0%,100% { transform: rotate(-14deg); } 50% { transform: rotate(14deg); } }
        @media (prefers-reduced-motion: reduce) {
          .group:hover [class*="wts-"] { animation: none !important; }
        }
      `}</style>
      <h2 className="heading text-3xl sm:text-4xl font-semibold">Four ways to keep books moving</h2>
      <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {ways.map((w, i) => (
          <Reveal key={w.key} delay={i * 100}>
            <TiltCard>
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl text-brand ${TINT[w.key]}`}>
                <svg
                  viewBox="0 0 24 24"
                  className="h-6 w-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {icons[w.key]}
                </svg>
              </div>
              <h3 className="mt-4 text-lg font-semibold">{w.title}</h3>
              <p className="mt-1 text-sm text-muted">{w.text}</p>
              <Illustration kind={w.key} />
            </TiltCard>
          </Reveal>
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        Libraries and community centres can also post donation requests for the books they need.
      </p>
    </section>
  );
}
