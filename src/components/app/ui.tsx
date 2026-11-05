// Shared building blocks for the signed-in app pages, so every section
// (Home, Discover, Activity, Community, Messages) looks consistent.

import "@fontsource/caveat/latin-500.css";
import { CountUp } from "./count-up";

export type Tint = "mint" | "peach" | "lavender" | "sky" | "butter" | "rose";

export const TINT_BG: Record<Tint, string> = {
  mint: "bg-mint",
  peach: "bg-peach",
  lavender: "bg-lavender",
  sky: "bg-sky",
  butter: "bg-butter",
  rose: "bg-rose",
};

/** A deeper shade of a pastel, for accent strips. */
export function deep(t: Tint) {
  return `color-mix(in srgb, var(--${t}) 45%, var(--brand))`;
}

export type IconKind =
  | "book"
  | "leaf"
  | "cup"
  | "home"
  | "compass"
  | "swap"
  | "heart"
  | "chat"
  | "user"
  | "clock"
  | "inbox"
  | "search"
  | "pin";

const PATHS: Record<IconKind, string> = {
  book: "M5 7c4-1.5 8-1 11 1.5 3-2.5 7-3 11-1.5v17c-4-1.5-8-1-11 1.5-3-2.5-7-3-11-1.5zM16 8.5V26",
  leaf: "M7 25C6 14 13 6 26 6c0 12-7 19-17 19M7 25l10-10",
  cup: "M6 12h15v7a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6zM21 14h2.5a3 3 0 0 1 0 6H21M10 5c-1 2 1 3 0 5M15 5c-1 2 1 3 0 5",
  home: "M5 15 16 6l11 9M8 13v13h6v-7h4v7h6V13",
  compass: "M16 4a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM20.5 11.5l-2.8 6.2-6.2 2.8 2.8-6.2z",
  swap: "M6 11h18l-5-5M26 21H8l5 5",
  heart: "M16 26S5 19 5 12a5.5 5.5 0 0 1 11-2 5.5 5.5 0 0 1 11 2c0 7-11 14-11 14z",
  chat: "M6 8h20v13H13l-6 5v-5H6z",
  user: "M16 16a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM6 27c1-5 5-8 10-8s9 3 10 8",
  clock: "M16 5a11 11 0 1 0 0 22 11 11 0 0 0 0-22zM16 10v6l4 3",
  inbox: "M5 17l3-10h16l3 10v8H5zM5 17h7l1 3h6l1-3h7",
  search: "M14 6a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM20 20l6 6",
  pin: "M16 27s-8-8-8-14a8 8 0 0 1 16 0c0 6-8 14-8 14zM16 10.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z",
};

export function Icon({ kind, className = "h-full w-full" }: { kind: IconKind; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={PATHS[kind]} />
    </svg>
  );
}

/** Page title with an optional handwritten note and actions on the right. */
export function PageHeader({
  title,
  note,
  subtitle,
  actions,
}: {
  title: string;
  note?: string;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="heading text-3xl font-semibold sm:text-4xl">{title}</h1>
        {note && <p className="font-hand text-2xl text-accent">{note}</p>}
        {subtitle && <p className="mt-1 text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

/** Serif section heading with a small hand-drawn squiggle underneath. */
export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mt-10 flex items-end justify-between gap-3">
      <div>
        <h2 className="heading text-2xl font-semibold">{children}</h2>
        <svg viewBox="0 0 90 8" className="mt-1 h-2 w-20 text-accent" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M2 5c7-5 12 3 19-1s12 3 19-1 12 3 19-1 12 2 28-1" />
        </svg>
      </div>
      {action}
    </div>
  );
}

/** Card with a calm header: thin tinted rule on top, neutral header below. */
export function Panel({
  title,
  children,
  action,
  tint = "mint",
  icon = "book",
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  tint?: Tint;
  icon?: IconKind;
}) {
  return (
    <section className="card overflow-hidden" aria-label={title}>
      <div
        className="flex items-center justify-between gap-2 border-b border-border px-5 py-3"
        style={{
          borderTop: `2px solid ${deep(tint)}`,
          background: `color-mix(in srgb, var(--${tint}) 35%, var(--surface))`,
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className={`flex h-8 w-8 items-center justify-center rounded-lg p-1.5 text-brand ${TINT_BG[tint]}`}>
            <Icon kind={icon} />
          </span>
          <h3 className="heading font-semibold">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

/** Friendly dashed empty state. */
export function EmptyState({ children, icon = "book" }: { children: React.ReactNode; icon?: IconKind }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-surface-2/70 px-4 py-6 text-center text-sm text-muted">
      <span className="animate-gentle-float h-8 w-8 text-brand/70">
        <Icon kind={icon} />
      </span>
      <div>{children}</div>
    </div>
  );
}

/**
 * Index-card style number tile. `tilt` is accepted for backward
 * compatibility but ignored: tiles sit straight for a calmer grid.
 */
export function StatTile({ label, value, tint }: { label: string; value: React.ReactNode; tint: Tint; tilt?: number }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border border-border p-4 pt-5 ${TINT_BG[tint]}`}>
      <span className="absolute inset-x-0 top-0 h-1" style={{ background: deep(tint) }} aria-hidden="true" />
      <div className="heading text-4xl font-semibold leading-none">
        {typeof value === "number" ? <CountUp value={value} /> : value}
      </div>
      <div className="mt-2 text-xs text-fg/70">{label}</div>
    </div>
  );
}
/** Small "coming in Phase N" pill. */
export function SoonBadge({ phase }: { phase: number }) {
  return (
    <span className="rounded-full border border-border bg-surface px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
      Phase {phase}
    </span>
  );
}
