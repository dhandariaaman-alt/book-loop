/* eslint-disable @next/next/no-img-element */
import { cardImageUrl } from "@/lib/listing-labels";
import Link from "next/link";
import { formatPrice, typeLabel, type ListingCard as Card } from "@/lib/listings";
import { formatDistance } from "@/lib/geo";
import { Icon } from "@/components/app/ui";

const COVER_TINTS = ["bg-mint", "bg-peach", "bg-butter", "bg-sky", "bg-rose", "bg-lavender"] as const;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** A tinted stand-in cover for books without a photo. */
export function DrawnCover({ title, author, className = "" }: { title: string; author: string; className?: string }) {
  const tint = COVER_TINTS[hash(title) % COVER_TINTS.length];
  return (
    <div className={`relative flex h-full w-full flex-col justify-between p-[10%] text-fg ${tint} ${className}`}>
      <span className="absolute inset-y-0 left-[6%] w-px bg-fg/10" aria-hidden="true" />
      <p className="heading line-clamp-4 text-[clamp(0.85rem,4.5cqw,1.35rem)] font-semibold leading-tight">{title}</p>
      <div>
        <span className="mb-1.5 block h-px w-8 bg-fg/30" aria-hidden="true" />
        <p className="line-clamp-2 font-serif text-xs italic text-fg/70">{author}</p>
      </div>
    </div>
  );
}

export function TypePill({ card }: { card: Pick<Card, "type" | "pricePaise"> }) {
  const price = card.type === "SALE" ? formatPrice(card.pricePaise) : null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-0.5 text-xs font-medium text-brand">
      {typeLabel(card.type)}
      {price && <span className="font-semibold">· {price}</span>}
    </span>
  );
}

export function ListingCard({ card }: { card: Card; index?: number }) {
  const place = [card.neighbourhood, card.distanceKm != null ? formatDistance(card.distanceKm) : null].filter(Boolean).join(" · ");

  return (
    <Link
      href={`/books/${card.id}`}
      className="group flex h-full min-w-0 flex-col rounded-2xl border border-border bg-surface p-2.5 transition-[transform,box-shadow] duration-200 hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-safe:hover:-translate-y-0.5 motion-safe:active:scale-[.98] sm:p-3"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-l-[4px] rounded-r-xl shadow-[inset_4px_0_0_rgba(0,0,0,0.08),2px_3px_8px_rgba(0,0,0,0.12)]">
        <div className="h-full w-full transition-transform duration-300 motion-safe:group-hover:scale-[1.03]" style={{ containerType: "inline-size" }}>
          {card.imageUrl ? (
            <img src={cardImageUrl(card.imageUrl)} alt={`Cover of ${card.title}`} loading="lazy" decoding="async" width={180} height={270} className="h-full w-full object-cover" />
          ) : (
            <DrawnCover title={card.title} author={card.author} />
          )}
        </div>
        <span className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-gradient-to-r from-black/15 to-transparent" aria-hidden="true" />
        {card.isMine && (
          <span className="absolute right-2 top-2 rounded-full bg-surface/95 px-2 py-0.5 text-[11px] font-semibold text-brand shadow-sm">
            Yours
          </span>
        )}
      </div>
      <div className="mt-3 flex min-w-0 flex-1 flex-col">
        <div>
          <TypePill card={card} />
        </div>
        <h3 className="mt-1.5 line-clamp-2 font-semibold leading-snug">{card.title}</h3>
        <p className="truncate text-sm text-muted">{card.author}</p>
        {place && (
          <p className="mt-auto flex min-w-0 items-center gap-1 pt-2 text-xs text-muted">
            <span className="h-3.5 w-3.5 shrink-0">
              <Icon kind="pin" />
            </span>
            <span className="truncate">{place}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
