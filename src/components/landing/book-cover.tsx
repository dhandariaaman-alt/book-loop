"use client";

/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import type { FamousBook } from "@/lib/famous-books";

const SIZES = {
  xs: { w: 72, h: 108, title: 9, author: 7, img: "M" },
  sm: { w: 112, h: 168, title: 13, author: 9, img: "M" },
  md: { w: 140, h: 210, title: 15, author: 10, img: "M" },
  lg: { w: 200, h: 300, title: 22, author: 12, img: "L" },
} as const;

/**
 * A book cover: the real cover from Open Library when available, otherwise a drawn one.
 * Purely visual; wrap it in a button to make it interactive.
 */
export function BookCover({
  book,
  size = "md",
  className = "",
  priority = false,
}: {
  book: FamousBook;
  size?: keyof typeof SIZES;
  className?: string;
  /** Load immediately (above the fold). Otherwise the image loads as it scrolls into view. */
  priority?: boolean;
}) {
  const s = SIZES[size];
  const [status, setStatus] = useState<"loading" | "loaded" | "failed">("loading");
  const imgRef = useRef<HTMLImageElement>(null);

  // A cached image can finish before React attaches onLoad; catch that case.
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete) setStatus(img.naturalWidth > 10 ? "loaded" : "failed");
  }, []);

  return (
    <div
      aria-hidden
      className={`relative shrink-0 overflow-hidden rounded-r-lg rounded-l-[3px] shadow-[0_10px_30px_-10px_rgb(0_0_0/0.45)] ${className}`}
      style={{ width: s.w, height: s.h, background: book.color, color: book.ink }}
    >
      {/* Drawn cover: shown while the real one loads, or if it can't load. */}
      <Pattern kind={book.pattern} ink={book.ink} />
      <div className="absolute inset-0 flex flex-col justify-between p-[10%] pl-[16%]">
        <p className="font-serif font-semibold leading-tight" style={{ fontSize: s.title }}>
          {book.title}
        </p>
        <p className="uppercase tracking-[0.12em] opacity-85" style={{ fontSize: s.author }}>
          {book.author}
        </p>
      </div>
      {(book.coverSrc || book.coverId) && status !== "failed" && (
        <img
          ref={imgRef}
          src={book.coverSrc ?? `https://covers.openlibrary.org/b/id/${book.coverId}-${s.img}.jpg`}
          alt=""
          width={s.w}
          height={s.h}
          decoding="async"
          loading={priority ? "eager" : "lazy"}
          fetchPriority={priority ? "high" : "low"}
          draggable={false}
          onError={() => setStatus("failed")}
          // Open Library returns a 1x1 image when a cover is missing.
          onLoad={(e) => setStatus(e.currentTarget.naturalWidth < 10 ? "failed" : "loaded")}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-500 ${status === "loaded" ? "opacity-100" : "opacity-0"}`}
        />
      )}
      {/* spine shading */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-3 bg-gradient-to-r from-black/40 to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 left-3 w-px bg-white/25" />
      {/* sheen */}
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/15 via-transparent to-black/10" />
    </div>
  );
}

function Pattern({ kind, ink }: { kind: FamousBook["pattern"]; ink: string }) {
  const common = { className: "absolute inset-0 h-full w-full opacity-[0.22]", viewBox: "0 0 100 150", preserveAspectRatio: "none" as const };
  switch (kind) {
    case "stripes":
      return (
        <svg {...common}>
          {[0, 1, 2, 3].map((i) => <rect key={i} x="0" y={95 + i * 9} width="100" height="4" fill={ink} />)}
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="62" cy="88" r="22" fill={ink} />
          {Array.from({ length: 12 }).map((_, i) => {
            const a = (i * Math.PI) / 6;
            return <line key={i} x1={62 + Math.cos(a) * 28} y1={88 + Math.sin(a) * 28} x2={62 + Math.cos(a) * 38} y2={88 + Math.sin(a) * 38} stroke={ink} strokeWidth="2" />;
          })}
        </svg>
      );
    case "frame":
      return (
        <svg {...common}>
          <rect x="14" y="10" width="78" height="130" fill="none" stroke={ink} strokeWidth="1.5" />
          <rect x="18" y="14" width="70" height="122" fill="none" stroke={ink} strokeWidth="0.6" />
        </svg>
      );
    case "waves":
      return (
        <svg {...common}>
          {[0, 1, 2, 3, 4].map((i) => (
            <path key={i} d={`M0 ${90 + i * 10} Q 25 ${82 + i * 10} 50 ${90 + i * 10} T 100 ${90 + i * 10}`} fill="none" stroke={ink} strokeWidth="2" />
          ))}
        </svg>
      );
    case "dots":
      return (
        <svg {...common}>
          {Array.from({ length: 30 }).map((_, i) => <circle key={i} cx={20 + (i % 6) * 14} cy={80 + Math.floor(i / 6) * 12} r="2.4" fill={ink} />)}
        </svg>
      );
    case "diamond":
      return (
        <svg {...common}>
          <path d="M58 70 L84 100 L58 130 L32 100 Z" fill="none" stroke={ink} strokeWidth="2" />
          <path d="M58 82 L74 100 L58 118 L42 100 Z" fill={ink} />
        </svg>
      );
  }
}
