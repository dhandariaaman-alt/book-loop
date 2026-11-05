"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

const steps = [
  { title: "Share your neighbourhood", text: "We use your approximate area, never your address." },
  { title: "List or find a book", text: "Browse books within 1, 5 or 10 km of you." },
  { title: "Request and chat", text: "Agree on the details and pick a public place to meet." },
  { title: "Hand over and rate", text: "Ratings after each exchange build community trust." },
];

function MapStep() {
  return (
    <div className="relative h-full min-h-72 overflow-hidden rounded-xl bg-surface-2">
      <div
        aria-hidden
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            "linear-gradient(var(--border) 1px, transparent 1px), linear-gradient(90deg, var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      <div className="absolute left-1/2 top-[42%] -translate-x-1/2 -translate-y-1/2">
        <span className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 animate-ping rounded-full bg-brand/20" />
        <span className="absolute left-1/2 top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20" />
        <svg viewBox="0 0 24 24" className="relative h-9 w-9 text-brand" aria-hidden>
          <path
            fill="currentColor"
            d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12zm0-9a3 3 0 1 1 0-6 3 3 0 0 1 0 6z"
          />
        </svg>
      </div>
      <div className="absolute inset-x-3 bottom-3 rounded-lg bg-surface px-3 py-2 text-center text-xs font-medium shadow-sm">
        Indiranagar, Bengaluru · approx.
      </div>
    </div>
  );
}

function ListStep() {
  const rows = [
    ["The Alchemist", "0.8 km"],
    ["Wings of Fire", "2 km"],
    ["Sapiens", "4 km"],
  ];
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        {["1 km", "5 km", "10 km"].map((c, i) => (
          <span
            key={c}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              i === 1 ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted"
            }`}
          >
            {c}
          </span>
        ))}
      </div>
      {rows.map(([t, d], i) => (
        <div
          key={t}
          className="animate-fade-up flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
          style={{ animationDelay: `${i * 120}ms` }}
        >
          <div className="h-12 w-9 shrink-0 rounded bg-brand-soft" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{t}</div>
            <div className="mt-1 h-2 w-1/2 rounded bg-surface-2" />
          </div>
          <span className="text-xs text-muted">{d}</span>
        </div>
      ))}
    </div>
  );
}

function ChatStep() {
  return (
    <div className="space-y-3 py-2">
      <div
        className="animate-fade-up max-w-[80%] rounded-2xl rounded-bl-sm bg-surface-2 px-4 py-2 text-sm"
      >
        Can we meet at the library café on Saturday?
      </div>
      <div
        className="animate-fade-up ml-auto max-w-[80%] rounded-2xl rounded-br-sm bg-brand px-4 py-2 text-sm text-brand-fg"
        style={{ animationDelay: "500ms" }}
      >
        Perfect, see you at 11!
      </div>
    </div>
  );
}

function RateStep() {
  return (
    <div className="flex flex-col items-center gap-5 py-6">
      <div className="flex gap-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className="h-9 w-9 text-accent"
            style={{ animation: `hiw-star 0.4s ${i * 0.35}s both` }}
            aria-hidden
          >
            <path
              fill="currentColor"
              d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4 6.1 20.5l1.2-6.5L2.5 9.4l6.6-.9z"
            />
          </svg>
        ))}
      </div>
      <span className="rounded-full bg-brand-soft px-4 py-1.5 text-sm font-medium text-brand">
        Handover complete ✓
      </span>
    </div>
  );
}

const previews: ReactNode[] = [<MapStep key={0} />, <ListStep key={1} />, <ChatStep key={2} />, <RateStep key={3} />];

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [visible, setVisible] = useState(false);
  const [reduced, setReduced] = useState(false);
  const rootRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const paused = hovered || focused || !visible;

  return (
    <section
      ref={rootRef}
      className="mx-auto max-w-6xl px-4 py-16"
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocused(false);
      }}
    >
      <style>{`
        @keyframes hiw-star { from { opacity: .2; transform: scale(.6); } to { opacity: 1; transform: scale(1); } }
      `}</style>
      <h2 className="heading text-3xl sm:text-4xl font-semibold">How it works</h2>
      <div className="mt-10 grid gap-8 lg:grid-cols-2 lg:items-center">
        <ol className="space-y-3">
          {steps.map((s, i) => {
            const on = i === active;
            return (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => setActive(i)}
                  aria-current={on ? "step" : undefined}
                  className={`relative w-full overflow-hidden rounded-xl border p-4 text-left transition-colors ${
                    on ? "border-brand bg-brand-soft" : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                        on ? "bg-brand text-brand-fg" : "bg-surface-2 text-muted"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0">
                      <span className="block font-semibold">{s.title}</span>
                      <span className="mt-0.5 block text-sm text-muted">{s.text}</span>
                    </span>
                  </div>
                  {on && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-border">
                      <span
                        key={active}
                        className={`block h-full origin-left bg-brand ${reduced ? "" : "animate-progress"}`}
                        style={
                          {
                            "--duration": "5s",
                            animationPlayState: paused ? "paused" : "running",
                            animationFillMode: "forwards",
                            transform: reduced ? "scaleX(1)" : undefined,
                          } as React.CSSProperties
                        }
                        onAnimationEnd={() => {
                          if (!reduced) setActive((a) => (a + 1) % steps.length);
                        }}
                      />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ol>
        <div className="mx-auto w-full max-w-sm">
          <div className="card overflow-hidden p-3">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-surface-2" />
            <div key={active} className="animate-pop-in min-h-72 p-2">
              {previews[active]}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
