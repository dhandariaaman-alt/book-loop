"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/institutions", label: "Institutions" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/disputes", label: "Disputes" },
  { href: "/admin/reviews", label: "Reviews" },
  { href: "/admin/moderators", label: "Moderators" },
  { href: "/admin/settings", label: "Settings" },
  { href: "/admin/audit", label: "Audit log" },
];

function active(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Left tab list on desktop, horizontally scrollable tabs on phones. */
export function AdminNav({ badges }: { badges: Record<string, number> }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin sections" className="lg:sticky lg:top-24 lg:w-52 lg:shrink-0 lg:self-start">
      <div className="card -mx-1 overflow-x-auto p-1.5 lg:mx-0 lg:overflow-visible lg:p-2">
        <p className="hidden px-3 pb-2 pt-1 font-mono text-[11px] uppercase tracking-widest text-muted lg:block">Admin console</p>
        <ul className="flex gap-1 lg:flex-col lg:gap-0.5">
          {TABS.map((t) => {
            const on = active(pathname, t.href);
            const count = badges[t.href] ?? 0;
            return (
              <li key={t.href} className="shrink-0">
                <Link
                  href={t.href}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center justify-between gap-2 whitespace-nowrap rounded-xl px-3 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                    on ? "bg-brand-soft font-semibold text-fg" : "text-muted hover:bg-surface-2/70 hover:text-fg"
                  }`}
                >
                  {t.label}
                  {count > 0 && (
                    <span className="rounded-full bg-peach px-1.5 py-0.5 font-mono text-[10px] text-fg" aria-label={`${count} need attention`}>
                      {count > 99 ? "99+" : count}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
