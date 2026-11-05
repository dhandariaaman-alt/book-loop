// Hand-drawn style doodles and dividers for the landing page. Purely decorative.

type DoodleKind = "sparkle" | "bookmark" | "leaf" | "plane" | "book" | "squiggle" | "heart" | "star" | "cup" | "circle";

type DoodleProps = {
  kind: DoodleKind;
  /** Tailwind position/size classes, e.g. "left-6 top-10 w-10" */
  className?: string;
  color?: string;
  fill?: string;
  /** Rotation in degrees */
  rotate?: number;
  animation?: "float" | "wiggle" | "twinkle" | "drift" | "none";
  delay?: number;
};

export function Doodle({ kind, className = "", color = "var(--brand)", fill = "none", rotate = 0, animation = "float", delay = 0 }: DoodleProps) {
  const anim = animation === "none" ? "" : `animate-${animation}`;
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute select-none ${anim} ${className}`}
      style={{ "--r": `${rotate}deg`, transform: `rotate(${rotate}deg)`, animationDelay: `${delay}ms` } as React.CSSProperties}
    >
      <svg viewBox="0 0 48 48" className="h-full w-full overflow-visible" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        {SHAPES[kind](fill)}
      </svg>
    </div>
  );
}

const SHAPES: Record<DoodleKind, (fill: string) => React.ReactNode> = {
  sparkle: (fill) => <path d="M24 4c1.5 10 4 13 16 20-12 7-14.5 10-16 20-1.5-10-4-13-16-20 12-7 14.5-10 16-20Z" fill={fill} />,
  star: (fill) => <path d="M24 6l5 11 12 1.5-9 8 2.6 12L24 32.5 13.4 38.5 16 26.5l-9-8L19 17Z" fill={fill} />,
  heart: (fill) => <path d="M24 40S8 30 8 19a8 8 0 0 1 16-3 8 8 0 0 1 16 3c0 11-16 21-16 21Z" fill={fill} />,
  bookmark: (fill) => <path d="M14 6h20v36l-10-8-10 8Z" fill={fill} />,
  leaf: (fill) => (
    <>
      <path d="M10 38C10 18 22 8 40 8c0 18-10 30-30 30Z" fill={fill} />
      <path d="M10 38 30 18" />
    </>
  ),
  plane: (fill) => (
    <>
      <path d="M6 22 42 8 32 40l-9-12Z" fill={fill} />
      <path d="M23 28 42 8" />
      <path d="M2 36c6 2 10 0 13-3" strokeDasharray="2 4" />
    </>
  ),
  book: (fill) => (
    <>
      <path d="M24 12c-5-4-12-4-18-2v26c6-2 13-2 18 2 5-4 12-4 18-2V10c-6-2-13-2-18 2Z" fill={fill} />
      <path d="M24 12v26" />
      <path d="M10 17c3-1 7-1 10 1M10 23c3-1 7-1 10 1M28 18c3-2 7-2 10-1M28 24c3-2 7-2 10-1" strokeWidth="1.5" />
    </>
  ),
  squiggle: () => <path d="M2 30c6-12 10-12 14 0s8 12 14 0 10-12 16 0" />,
  cup: (fill) => (
    <>
      <path d="M10 20h24v10a10 10 0 0 1-10 10h-4a10 10 0 0 1-10-10Z" fill={fill} />
      <path d="M34 23h3a5 5 0 0 1 0 10h-3" />
      <path d="M17 8c-2 3 2 5 0 8M24 6c-2 3 2 5 0 8" strokeWidth="1.6" />
    </>
  ),
  circle: (fill) => <circle cx="24" cy="24" r="16" fill={fill} strokeDasharray="3 5" />,
};

/** Wavy edge between two sections. `color` is the colour of the section below. */
export function WaveDivider({ color, flip = false, className = "" }: { color: string; flip?: boolean; className?: string }) {
  return (
    <div aria-hidden className={`pointer-events-none relative -mb-px h-12 w-full sm:h-16 ${className}`} style={{ transform: flip ? "scaleY(-1)" : undefined }}>
      <svg viewBox="0 0 1440 80" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        <path d="M0 48c120-28 240-28 360 0s240 28 360 0 240-28 360 0 240 28 360 0v32H0Z" fill={color} />
      </svg>
    </div>
  );
}
