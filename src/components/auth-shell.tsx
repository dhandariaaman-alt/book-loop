import "@fontsource/caveat/latin-500.css";
import { BookCover } from "@/components/landing/book-cover";
import { Doodle } from "@/components/landing/decorations";
import { FAMOUS_BOOKS } from "@/lib/famous-books";

// A small fanned stack of real covers for the decorative side panel.
const STACK = ["The Little Prince", "Magic of Seven Notes", "The God of Small Things"]
  .map((t) => FAMOUS_BOOKS.find((b) => b.title === t))
  .filter((b): b is NonNullable<typeof b> => Boolean(b));

const FAN = [
  { x: -78, y: 18, r: -12, z: 1, dur: 7 },
  { x: 0, y: -6, r: 0, z: 3, dur: 6 },
  { x: 78, y: 22, r: 11, z: 2, dur: 8 },
];

export function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto grid max-w-5xl items-center gap-10 px-4 py-10 sm:py-14 lg:grid-cols-[1fr_minmax(0,28rem)] lg:gap-16">
      {/* Decorative side (wide screens only) */}
      <div aria-hidden className="relative hidden h-[460px] lg:block">
        <div className="absolute inset-0 rounded-[2rem] border border-border bg-gradient-to-br from-mint via-butter to-peach" />
        <div className="dot-grid absolute inset-0 rounded-[2rem] opacity-60" />
        <Doodle kind="sparkle" className="left-8 top-8 w-8" color="var(--accent)" fill="#fff" animation="twinkle" />
        <Doodle kind="heart" className="bottom-24 right-10 w-8" color="#d1607a" fill="var(--rose)" animation="float" delay={400} />
        <Doodle kind="squiggle" className="right-10 top-10 w-20" color="var(--brand)" animation="drift" />

        <div className="absolute left-1/2 top-[44%] h-0 w-0">
          {STACK.map((b, i) => (
            <div
              key={b.title}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: FAN[i].x, top: FAN[i].y, zIndex: FAN[i].z }}
            >
              <div
                className="animate-float"
                style={{ "--r": `${FAN[i].r}deg`, "--float-duration": `${FAN[i].dur}s`, animationDelay: `${-i * 1.3}s` } as React.CSSProperties}
              >
                <BookCover book={b} size={i === 1 ? "md" : "sm"} />
              </div>
            </div>
          ))}
        </div>

        <p className="font-hand absolute inset-x-0 bottom-20 text-center text-3xl text-brand">
          your next read is around the corner
        </p>
      </div>

      {/* Form side */}
      <div className="animate-fade-up">
        <h1 className="heading text-3xl font-semibold sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="relative mt-7">
          <Doodle kind="bookmark" className="-top-4 right-6 z-10 w-7" color="var(--brand)" fill="var(--butter)" rotate={8} animation="wiggle" />
          <div className="card relative overflow-hidden p-6 shadow-[0_18px_40px_-24px_rgb(60_40_10/0.35)] sm:p-8">
            <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-mint via-peach to-lavender" />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8Z" />
      <path fill="#34A853" d="M12 23c3 0 5.4-1 7.2-2.7l-3.5-2.7c-1 .7-2.2 1.1-3.7 1.1-2.9 0-5.3-1.9-6.2-4.5H2.2v2.8A11 11 0 0 0 12 23Z" />
      <path fill="#FBBC05" d="M5.8 14.2a6.6 6.6 0 0 1 0-4.3V7H2.2a11 11 0 0 0 0 9.9l3.6-2.7Z" />
      <path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.2 7l3.6 2.8C6.7 7.3 9.1 5.4 12 5.4Z" />
    </svg>
  );
}
