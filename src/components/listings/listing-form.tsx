"use client";

import Link from "next/link";
import { useActionState, useCallback, useEffect, useId, useRef, useState } from "react";
import type { BookCondition, ListingType } from "@prisma/client";
import type { FormState } from "@/app/actions/auth";
import { FormMessage, SubmitButton } from "@/components/form-bits";
import { CONDITIONS } from "@/lib/listing-labels";

type Genre = { id: string; name: string };

export type ListingFormInitial = {
  title: string;
  author: string;
  isbn?: string | null;
  genreId?: string | null;
  type?: ListingType;
  condition?: BookCondition;
  description?: string | null;
  priceRupees?: string;
  images?: { id: string; url: string; alt: string | null }[];
};

type Props = {
  genres: Genre[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  initial?: ListingFormInitial;
  submitLabel: string;
  cancelHref?: string;
};

type LookupResult = { title: string; author: string; year: number | null; isbn: string | null; coverUrl: string | null };

const MAX_PHOTOS = 4;
const MAX_BYTES = 5 * 1024 * 1024;
const ACCEPT = ["image/jpeg", "image/png", "image/webp"];
const DESC_MAX = 1000;

// Mirrors CONDITIONS in src/lib/listings.ts (that module imports Prisma, so it can't load in the browser).
const SHARE_OPTIONS: { value: ListingType; label: string; hint: string; tint: string }[] = [
  { value: "BORROW", label: "Borrow", hint: "Lend it for a few weeks", tint: "bg-sky" },
  { value: "EXCHANGE", label: "Exchange", hint: "Swap for another book", tint: "bg-lavender" },
  { value: "GIVEAWAY", label: "Give away", hint: "Free to a new reader", tint: "bg-mint" },
  { value: "SALE", label: "Sale", hint: "Sell at a fair price", tint: "bg-peach" },
];

const COVER = "aspect-[2/3] rounded-l-sm rounded-r-md object-cover shadow-[0_4px_12px_-4px_rgb(0_0_0/0.25)]";

function Step({ n, title, children, id }: { n: number; title: string; children: React.ReactNode; id: string }) {
  return (
    <section className="card p-5 sm:p-6" aria-labelledby={id}>
      <h2 id={id} className="heading flex items-center gap-3 text-xl font-semibold">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft font-sans text-sm font-semibold text-brand">
          {n}
        </span>
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

type NewPhoto = { key: string; file: File; url: string };

export function ListingForm({ genres, action, initial, submitLabel, cancelHref = "/activity?tab=books" }: Props) {
  const [state, formAction] = useActionState(action, {});
  const uid = useId();

  // Book details
  const [title, setTitle] = useState(initial?.title ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [isbn, setIsbn] = useState(initial?.isbn ?? "");
  const [coverUrl, setCoverUrl] = useState("");

  // Share + details
  const [type, setType] = useState<ListingType | "">(initial?.type ?? "");
  const [price, setPrice] = useState(initial?.priceRupees ?? "");
  const [condition, setCondition] = useState<BookCondition | "">(initial?.condition ?? "");
  const [genreId, setGenreId] = useState(initial?.genreId ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");

  // ───────── Lookup combobox ─────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LookupResult[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");
  const skipNextLookup = useRef(false);
  const listId = `${uid}-results`;

  useEffect(() => {
    if (skipNextLookup.current) {
      skipNextLookup.current = false;
      return;
    }
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setLookupError("");
      try {
        const res = await fetch(`/api/book-lookup?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        const data = (await res.json()) as { results?: LookupResult[]; error?: string };
        if (!res.ok) {
          setLookupError(data.error ?? "Search isn't working right now. Type the details below.");
          setResults([]);
          setOpen(false);
        } else {
          const r = (data.results ?? []).slice(0, 6);
          setResults(r);
          setActive(-1);
          setOpen(true);
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setLookupError("Search isn't working right now. Type the details below.");
        }
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 300);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  function pick(r: LookupResult) {
    setTitle(r.title);
    setAuthor(r.author);
    setIsbn(r.isbn ?? "");
    setCoverUrl(r.coverUrl ?? "");
    skipNextLookup.current = true;
    setQuery(r.title);
    setOpen(false);
    setActive(-1);
  }

  function onSearchKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setActive((i) => (results.length ? (i + 1) % results.length : -1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open && results.length) setOpen(true);
      setActive((i) => (results.length ? (i <= 0 ? results.length - 1 : i - 1) : -1));
    } else if (e.key === "Enter") {
      // Never submit the whole form from the search box.
      e.preventDefault();
      if (open && active >= 0 && results[active]) pick(results[active]);
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  }

  // ───────── Photos ─────────
  const existing = initial?.images ?? [];
  const [removed, setRemoved] = useState<string[]>([]);
  const [photos, setPhotos] = useState<NewPhoto[]>([]);
  const [photoError, setPhotoError] = useState("");
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const urlsRef = useRef<Set<string>>(new Set());

  const keptCount = existing.filter((i) => !removed.includes(i.id)).length;
  const total = keptCount + photos.length;
  const room = Math.max(0, MAX_PHOTOS - total);

  // Keep the real file input in sync with our list (also after React resets the form).
  useEffect(() => {
    const input = fileRef.current;
    if (!input) return;
    try {
      const dt = new DataTransfer();
      photos.forEach((p) => dt.items.add(p.file));
      input.files = dt.files;
    } catch {
      /* very old browsers: the input keeps whatever was picked last */
    }
  }, [photos, state]);

  // Revoke every preview URL when the form goes away.
  useEffect(() => {
    const urls = urlsRef.current;
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
      urls.clear();
    };
  }, []);

  const addFiles = useCallback(
    (list: FileList | File[]) => {
      const files = Array.from(list);
      const errors: string[] = [];
      const accepted: NewPhoto[] = [];
      let slots = room;
      for (const file of files) {
        if (!ACCEPT.includes(file.type)) {
          errors.push(`${file.name} isn't a JPG, PNG or WebP image.`);
          continue;
        }
        if (file.size > MAX_BYTES) {
          errors.push(`${file.name} is over 5MB.`);
          continue;
        }
        if (slots <= 0) {
          errors.push(`You can add up to ${MAX_PHOTOS} photos.`);
          break;
        }
        const url = URL.createObjectURL(file);
        urlsRef.current.add(url);
        accepted.push({ key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, url });
        slots--;
      }
      setPhotoError(errors.join(" "));
      if (accepted.length) setPhotos((p) => [...p, ...accepted]);
    },
    [room],
  );

  function removePhoto(key: string) {
    setPhotos((list) => {
      const gone = list.find((p) => p.key === key);
      if (gone) {
        URL.revokeObjectURL(gone.url);
        urlsRef.current.delete(gone.url);
      }
      return list.filter((p) => p.key !== key);
    });
    setPhotoError("");
  }

  function toggleExisting(id: string, remove: boolean) {
    if (!remove && total >= MAX_PHOTOS) {
      setPhotoError(`You can keep up to ${MAX_PHOTOS} photos. Remove a new one first.`);
      return;
    }
    setPhotoError("");
    setRemoved((r) => (remove ? [...r, id] : r.filter((x) => x !== id)));
  }

  const showLookupCover = total === 0 && !!coverUrl;
  const conditionHint = CONDITIONS.find((c) => c.value === condition)?.hint;

  return (
    <form action={formAction} className="mx-auto max-w-2xl space-y-6 [&_.input:focus]:border-brand [&_.input:focus]:ring-4 [&_.input:focus]:ring-mint">
      <input type="hidden" name="isbn" value={isbn ?? ""} />
      <input type="hidden" name="coverUrl" value={coverUrl} />

      {/* 1. Find the book */}
      <Step n={1} title="Find the book" id={`${uid}-s1`}>
        <div className="relative">
          <label htmlFor={`${uid}-search`} className="label">
            Search by title, author or ISBN
          </label>
          <input
            id={`${uid}-search`}
            type="search"
            role="combobox"
            autoComplete="off"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={listId}
            aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
            aria-describedby={`${uid}-search-hint`}
            className="input"
            placeholder="e.g. The Namesake"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onSearchKey}
            onFocus={() => results.length > 0 && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
          />
          {loading && (
            <span className="pointer-events-none absolute right-3 top-[2.6rem] text-xs text-muted" aria-hidden="true">
              Searching…
            </span>
          )}
          <ul
            id={listId}
            role="listbox"
            aria-label="Matching books"
            hidden={!open}
            className="absolute inset-x-0 z-20 mt-2 max-h-96 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg"
          >
            {results.length === 0 ? (
              <li role="option" aria-selected={false} aria-disabled="true" className="px-3 py-3 text-sm text-muted">
                No matches. Type the details below.
              </li>
            ) : (
              results.map((r, i) => (
                <li
                  key={`${r.title}-${r.isbn ?? i}`}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(r)}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 ${i === active ? "bg-brand-soft" : ""}`}
                >
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.coverUrl.replace("-L.jpg", "-S.jpg")} alt="" className={`w-9 shrink-0 ${COVER}`} loading="lazy" />
                  ) : (
                    <span className="flex aspect-[2/3] w-9 shrink-0 items-center justify-center rounded-l-sm rounded-r-md bg-butter text-[10px] text-muted" aria-hidden="true">
                      ?
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{r.title}</span>
                    <span className="block truncate text-xs text-muted">
                      {[r.author, r.year].filter(Boolean).join(" · ") || "Unknown author"}
                    </span>
                  </span>
                </li>
              ))
            )}
          </ul>
          <p id={`${uid}-search-hint`} className="mt-1.5 text-sm text-muted">
            {lookupError || "Can't find it? Type the details below."}
          </p>
        </div>

        <div className="flex gap-4">
          {coverUrl && (
            <div className="w-20 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={coverUrl} alt={`Cover of ${title || "the book"}`} className={`w-full ${COVER}`} />
              <button
                type="button"
                className="mt-1 w-full text-center text-xs text-muted underline-offset-2 hover:underline"
                onClick={() => setCoverUrl("")}
              >
                Clear cover
              </button>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <label htmlFor={`${uid}-title`} className="label">
                Title
              </label>
              <input
                id={`${uid}-title`}
                name="title"
                required
                maxLength={200}
                className="input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor={`${uid}-author`} className="label">
                Author
              </label>
              <input
                id={`${uid}-author`}
                name="author"
                required
                maxLength={120}
                className="input"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
              />
            </div>
          </div>
        </div>
      </Step>

      {/* 2. How to share */}
      <Step n={2} title="How do you want to share it?" id={`${uid}-s2`}>
        <fieldset>
          <legend className="sr-only">How do you want to share it?</legend>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {SHARE_OPTIONS.map((o) => {
              const checked = type === o.value;
              return (
                <label
                  key={o.value}
                  className={`relative flex cursor-pointer flex-col gap-1 rounded-xl border p-3 transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 ${
                    checked ? `${o.tint} border-brand font-semibold shadow-sm` : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="type"
                    value={o.value}
                    required
                    checked={checked}
                    onChange={() => setType(o.value)}
                    className="sr-only"
                  />
                  <span className="heading text-lg">{o.label}</span>
                  <span className="text-xs font-normal text-muted">{o.hint}</span>
                  {checked && (
                    <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[11px] text-surface" aria-hidden="true">
                      ✓
                    </span>
                  )}
                </label>
              );
            })}
          </div>
        </fieldset>
        {type === "SALE" && (
          <div className="max-w-xs">
            <label htmlFor={`${uid}-price`} className="label">
              Price
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" aria-hidden="true">
                ₹
              </span>
              <input
                id={`${uid}-price`}
                name="priceRupees"
                type="number"
                inputMode="decimal"
                min={1}
                max={100000}
                step="1"
                required
                className="input pl-7"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
            <p className="mt-1.5 text-sm text-muted">In rupees. Keep it fair for a used book.</p>
          </div>
        )}
      </Step>

      {/* 3. Condition & details */}
      <Step n={3} title="Condition & details" id={`${uid}-s3`}>
        <fieldset>
          <legend className="label">Condition</legend>
          <div className="flex flex-wrap gap-2">
            {CONDITIONS.map((c) => {
              const checked = condition === c.value;
              return (
                <label
                  key={c.value}
                  className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 ${
                    checked ? "border-brand bg-brand-soft font-semibold text-brand" : "border-border bg-surface hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="radio"
                    name="condition"
                    value={c.value}
                    required
                    checked={checked}
                    onChange={() => setCondition(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              );
            })}
          </div>
          <p className="mt-2 min-h-5 text-sm text-muted" aria-live="polite">
            {conditionHint ?? "Pick the one that fits best."}
          </p>
        </fieldset>

        <div>
          <label htmlFor={`${uid}-genre`} className="label">
            Genre
          </label>
          <select id={`${uid}-genre`} name="genreId" className="input" value={genreId ?? ""} onChange={(e) => setGenreId(e.target.value)}>
            <option value="">Choose a genre (optional)</option>
            {genres.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2">
            <label htmlFor={`${uid}-desc`} className="label">
              Description
            </label>
            <span id={`${uid}-desc-count`} className={`font-mono text-xs ${description.length >= DESC_MAX ? "text-danger" : "text-muted"}`}>
              {description.length}/{DESC_MAX}
            </span>
          </div>
          <textarea
            id={`${uid}-desc`}
            name="description"
            rows={4}
            maxLength={DESC_MAX}
            aria-describedby={`${uid}-desc-count`}
            className="input"
            placeholder="Anything a reader should know? Notes in the margins, a favourite chapter, pickup times."
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </Step>

      {/* 4. Photos */}
      <Step n={4} title="Photos" id={`${uid}-s4`}>
        <p className="text-sm text-muted">Up to {MAX_PHOTOS} photos. JPG, PNG or WebP, 5MB each.</p>

        {(existing.length > 0 || photos.length > 0 || showLookupCover) && (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4">
            {existing.map((img) => {
              const isRemoved = removed.includes(img.id);
              return (
                <li key={img.id} className="min-w-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.alt ?? `Photo of ${title}`} className={`w-full ${COVER} ${isRemoved ? "opacity-40 grayscale" : ""}`} />
                  <label className="mt-1.5 flex cursor-pointer items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      name="removeImage"
                      value={img.id}
                      checked={isRemoved}
                      onChange={(e) => toggleExisting(img.id, e.target.checked)}
                      className="h-4 w-4 accent-[var(--brand)]"
                    />
                    Remove
                  </label>
                </li>
              );
            })}
            {photos.map((p, i) => (
              <li key={p.key} className="relative min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt={`New photo ${i + 1}`} className={`w-full ${COVER}`} />
                <button
                  type="button"
                  onClick={() => removePhoto(p.key)}
                  aria-label={`Remove new photo ${i + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface text-sm shadow-sm hover:bg-surface-2"
                >
                  ×
                </button>
              </li>
            ))}
            {showLookupCover && (
              <li className="min-w-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={coverUrl} alt={`Cover of ${title || "the book"}`} className={`w-full ${COVER}`} />
                <p className="mt-1.5 font-hand text-base leading-tight text-accent">We&apos;ll use this cover</p>
              </li>
            )}
          </ul>
        )}

        <label
          onDragOver={(e) => {
            e.preventDefault();
            if (room > 0) setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files);
          }}
          className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-6 text-center text-sm transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand has-[:focus-visible]:ring-offset-2 ${
            room === 0 ? "cursor-not-allowed border-border bg-surface-2 text-muted" : "cursor-pointer"
          } ${dragging ? "border-brand bg-brand-soft" : "border-border bg-surface-2 hover:bg-surface"}`}
        >
          <input
            ref={fileRef}
            type="file"
            name="photos"
            accept={ACCEPT.join(",")}
            multiple
            aria-disabled={room === 0}
            className="sr-only"
            onClick={(e) => {
              // Not `disabled`: a disabled input would drop the chosen files from the submit.
              if (room === 0) e.preventDefault();
            }}
            onChange={(e) => {
              if (e.target.files?.length) addFiles(e.target.files);
            }}
          />
          <span className="font-semibold">{room === 0 ? "That's 4 photos, the most you can add" : "Drop photos here or tap to choose"}</span>
          {room > 0 && <span className="text-xs text-muted">{room} more allowed. The front cover first works best.</span>}
        </label>
        {photoError && (
          <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
            {photoError}
          </p>
        )}
      </Step>

      <p className="flex items-center gap-2 px-1 text-sm text-muted">
        <svg viewBox="0 0 32 32" className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M16 27s-8-8-8-14a8 8 0 0 1 16 0c0 6-8 14-8 14zM16 10.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z" />
        </svg>
        Your book shows your neighbourhood, never your address.
      </p>

      <div className="sticky bottom-20 z-30 space-y-3 rounded-2xl border border-border bg-surface/95 p-3 shadow-lg backdrop-blur lg:bottom-4">
        <FormMessage state={state} />
        <div className="flex items-center justify-end gap-2">
          <Link href={cancelHref} className="btn-ghost">
            Cancel
          </Link>
          <SubmitButton className="btn-primary" pendingText="Saving…">
            {submitLabel}
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
