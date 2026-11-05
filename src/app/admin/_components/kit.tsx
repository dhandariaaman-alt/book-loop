// Server-rendered building blocks for the admin console and moderator dashboard.

import Link from "next/link";
import type { Tint } from "@/components/app/ui";
import { TINT_BG } from "@/components/app/ui";
import { humanize } from "@/lib/admin";

/**
 * A dense list that is a table on desktop and stacked cards on phones.
 * `cols` must be a literal Tailwind class, e.g. "md:grid-cols-[2fr_1fr_auto]".
 */
export function DataList({ cols, headers, children }: { cols: string; headers: string[]; children: React.ReactNode }) {
  return (
    <div className="card overflow-hidden" role="table">
      <div role="row" className={`hidden gap-4 border-b border-border bg-surface-2/60 px-4 py-2.5 md:grid ${cols}`}>
        {headers.map((h, i) => (
          <div key={i} role="columnheader" className="font-mono text-[11px] uppercase tracking-wider text-muted">
            {h}
          </div>
        ))}
      </div>
      <div role="rowgroup" className="divide-y divide-border">
        {children}
      </div>
    </div>
  );
}

export function Row({ cols, children, className = "" }: { cols: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="row" className={`grid gap-2 px-4 py-3 text-sm md:items-start md:gap-4 ${cols} ${className}`}>
      {children}
    </div>
  );
}

export function Cell({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div role="cell" className={`min-w-0 ${className}`}>
      <span className="mr-2 font-mono text-[10px] uppercase tracking-wider text-muted md:hidden">{label}</span>
      {children}
    </div>
  );
}

const STATUS_TINT: Record<string, Tint> = {
  ACTIVE: "mint",
  AVAILABLE: "mint",
  VERIFIED: "mint",
  RESOLVED: "mint",
  COMPLETED: "mint",
  OPEN: "butter",
  PENDING: "butter",
  REQUEST_PENDING: "butter",
  RESERVED: "sky",
  HANDED_OVER: "sky",
  RETURN_PENDING: "sky",
  UNDER_REVIEW: "sky",
  INVESTIGATING: "sky",
  ESCALATED: "peach",
  DISPUTED: "peach",
  SUSPENDED: "peach",
  BANNED: "rose",
  REJECTED: "rose",
  REMOVED: "rose",
  CANCELLED: "lavender",
  DISMISSED: "lavender",
  CLOSED: "lavender",
  UNAVAILABLE: "lavender",
  ADMIN: "peach",
  MODERATOR: "sky",
  INSTITUTION: "butter",
  USER: "lavender",
};

export function Badge({ value, tint }: { value: string; tint?: Tint }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full border border-border px-2 py-0.5 text-[11px] font-medium ${TINT_BG[tint ?? STATUS_TINT[value] ?? "lavender"]}`}>
      {humanize(value)}
    </span>
  );
}

type Option = { value: string; label: string };

/** A GET form for filters. Changing filters resets pagination. */
export function FilterBar({
  action,
  search,
  selects = [],
}: {
  action: string;
  search?: { name: string; value: string; placeholder: string; label: string };
  selects?: { name: string; label: string; value: string; options: Option[] }[];
}) {
  return (
    <form action={action} method="get" className="card mt-6 flex flex-wrap items-end gap-3 p-3 sm:p-4">
      {search && (
        <div className="min-w-0 flex-1 basis-56">
          <label htmlFor={`f-${search.name}`} className="label text-xs">
            {search.label}
          </label>
          <input id={`f-${search.name}`} name={search.name} defaultValue={search.value} placeholder={search.placeholder} className="input" type="search" />
        </div>
      )}
      {selects.map((s) => (
        <div key={s.name} className="min-w-0 flex-1 basis-36 sm:flex-none">
          <label htmlFor={`f-${s.name}`} className="label text-xs">
            {s.label}
          </label>
          <select id={`f-${s.name}`} name={s.name} defaultValue={s.value} className="input">
            {s.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}
      <div className="flex gap-2">
        <button type="submit" className="btn-primary">
          Apply
        </button>
        <Link href={action} className="btn-ghost">
          Clear
        </Link>
      </div>
    </form>
  );
}

export function enumOptions(values: readonly string[], allLabel = "All"): Option[] {
  return [{ value: "", label: allLabel }, ...values.map((v) => ({ value: v, label: humanize(v) }))];
}

/** Build a link that keeps the current filters and changes the page. */
export function Pagination({
  path,
  params,
  page,
  total,
  pageSize,
}: {
  path: string;
  params: Record<string, string | undefined>;
  page: number;
  total: number;
  pageSize: number;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className="mt-3 text-xs text-muted">{total} result{total === 1 ? "" : "s"}</p>;
  const href = (p: number) => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && q.set(k, v));
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${path}?${s}` : path;
  };
  return (
    <nav aria-label="Pagination" className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted">
        Page {page} of {pages} · {total} results
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link href={href(page - 1)} className="btn-secondary px-3 py-1.5" rel="prev">
            Previous
          </Link>
        ) : (
          <span className="btn-secondary px-3 py-1.5 opacity-50" aria-disabled="true">
            Previous
          </span>
        )}
        {page < pages ? (
          <Link href={href(page + 1)} className="btn-secondary px-3 py-1.5" rel="next">
            Next
          </Link>
        ) : (
          <span className="btn-secondary px-3 py-1.5 opacity-50" aria-disabled="true">
            Next
          </span>
        )}
      </div>
    </nav>
  );
}

/** Small native select for use inside an ActionForm. */
export function SelectField({ name, label, options, defaultValue }: { name: string; label: string; options: Option[]; defaultValue?: string }) {
  return (
    <label className="block text-xs">
      <span className="label text-xs">{label}</span>
      <select name={name} defaultValue={defaultValue} className="input">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function UserLink({ username, name }: { username: string; name?: string | null }) {
  return (
    <Link href={`/u/${username}`} className="font-medium text-brand hover:underline">
      {name ? `${name} ` : ""}
      <span className={name ? "text-muted" : ""}>@{username}</span>
    </Link>
  );
}
