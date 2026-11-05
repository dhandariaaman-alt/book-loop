"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FAMOUS_BOOKS, SHELF_GENRES, type FamousBook, type ShelfGenre } from "@/lib/famous-books";
import { BookCover } from "@/components/landing/book-cover";

type Filter = "All" | ShelfGenre;

function fill(list: FamousBook[], min = 10): FamousBook[] {
  if (list.length === 0) return list;
  const out: FamousBook[] = [];
  while (out.length < min || out.length % list.length !== 0) out.push(list[out.length % list.length]);
  return out;
}

function Row({
  books,
  className,
  duration,
  onOpen,
}: {
  books: FamousBook[];
  className: string;
  duration: string;
  onOpen: (b: FamousBook) => void;
}) {
  const items = fill(books);
  const copy = (hidden: boolean) =>
    items.map((b, i) => (
      <button
        key={`${hidden ? "d" : "a"}-${b.title}-${i}`}
        type="button"
        tabIndex={hidden ? -1 : undefined}
        aria-label={`${b.title} by ${b.author}`}
        onClick={() => onOpen(b)}
        className="group shrink-0 cursor-pointer rounded-lg text-left transition duration-300 hover:-translate-y-2 hover:rotate-[-2deg] hover:[&>div]:shadow-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <BookCover book={b} size="sm" />
        <p className="mt-2 line-clamp-1 w-[112px] text-sm font-medium">{b.title}</p>
        <p className="line-clamp-1 w-[112px] text-xs text-muted">{b.author}</p>
      </button>
    ));
  return (
    <div className="pause-on-hover mask-fade-x overflow-hidden py-3">
      <div
        className={`flex w-max gap-6 ${className}`}
        style={{ "--duration": duration } as React.CSSProperties}
      >
        <div className="flex gap-6">{copy(false)}</div>
        <div className="flex gap-6" aria-hidden>
          {copy(true)}
        </div>
      </div>
    </div>
  );
}

export function BookShelves() {
  const [filter, setFilter] = useState<Filter>("All");
  const [selected, setSelected] = useState<FamousBook | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const books = useMemo(
    () => (filter === "All" ? FAMOUS_BOOKS : FAMOUS_BOOKS.filter((b) => b.genre === filter)),
    [filter],
  );
  const single = books.length < 6;
  const row1 = single ? books : books.filter((_, i) => i % 2 === 0);
  const row2 = single ? [] : books.filter((_, i) => i % 2 === 1);

  const open = useCallback((b: FamousBook) => {
    setSelected(b);
    const d = dialogRef.current;
    if (d && !d.open) d.showModal();
  }, []);

  const close = useCallback(() => {
    dialogRef.current?.close();
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      if (!selected || books.length === 0) return;
      const idx = books.findIndex((b) => b.title === selected.title);
      const next = books[(idx + dir + books.length) % books.length];
      setSelected(next);
    },
    [selected, books],
  );

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
    };
    d.addEventListener("keydown", onKey);
    return () => d.removeEventListener("keydown", onKey);
  }, [step]);

  const chips: Filter[] = ["All", ...SHELF_GENRES];

  return (
    <section className="overflow-x-hidden">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="heading text-3xl font-semibold sm:text-4xl">Stories waiting on shelves near you</h2>
        <p className="mt-3 text-muted">Famous books readers love to pass on. Tap any book to take a closer look.</p>
        <div className="mt-6 flex flex-wrap gap-2">
          {chips.map((c) => {
            const active = c === filter;
            return (
              <button
                key={c}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(c)}
                className={`rounded-full px-4 py-1.5 text-sm transition-colors duration-200 ${
                  active ? "border border-brand bg-brand text-brand-fg" : "border border-border hover:bg-surface-2"
                }`}
              >
                {c}
              </button>
            );
          })}
        </div>
      </div>

      <div key={filter} className="mt-8 animate-pop-in space-y-2">
        <Row books={row1} className="animate-marquee" duration="70s" onOpen={open} />
        {!single && <Row books={row2} className="animate-marquee-reverse" duration="85s" onOpen={open} />}
      </div>

      <p className="mt-8 px-4 text-center text-sm text-muted">
        Plus thousands more, listed by real readers in your area.{" "}
        <Link href="/register" className="font-medium text-brand hover:underline">
          Join BookLoop
        </Link>
      </p>

      <dialog
        ref={dialogRef}
        aria-label={selected ? `${selected.title} by ${selected.author}` : "Book details"}
        onClose={() => setSelected(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) close();
        }}
        className="card m-auto w-[calc(100%-2rem)] max-w-lg animate-pop-in overflow-hidden bg-surface p-0 text-fg"
      >
        {selected && (
          <div className="relative p-5 sm:p-6">
            <button
              type="button"
              onClick={close}
              aria-label="Close"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-lg leading-none text-muted transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
            >
              ×
            </button>
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <div className="shrink-0">
                <div className="sm:hidden">
                  <BookCover book={selected} size="md" />
                </div>
                <div className="hidden sm:block">
                  <BookCover book={selected} size="lg" />
                </div>
              </div>
              <div className="min-w-0 flex-1 text-center sm:pr-6 sm:text-left">
                <span className="inline-block rounded-full bg-brand-soft px-3 py-0.5 text-xs font-medium text-brand">
                  {selected.genre}
                </span>
                <h3 className="heading mt-2 text-2xl">{selected.title}</h3>
                <p className="mt-1 text-sm text-muted">
                  by {selected.author}
                  {selected.year ? ` · ${selected.year}` : ""}
                </p>
                <p className="mt-3 text-sm leading-relaxed">{selected.blurb}</p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs text-muted sm:justify-start">
                  <span>Readers share it to:</span>
                  {["Borrow", "Exchange", "Give away"].map((t) => (
                    <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex gap-1">
                <button type="button" onClick={() => step(-1)} className="btn-ghost text-sm">
                  ← Prev
                </button>
                <button type="button" onClick={() => step(1)} className="btn-ghost text-sm">
                  Next →
                </button>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={close} className="btn-ghost">
                  Close
                </button>
                <Link href="/register" className="btn-primary">
                  Find it near you
                </Link>
              </div>
            </div>
          </div>
        )}
      </dialog>
    </section>
  );
}
