"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/institution", label: "Overview", exact: true },
  { href: "/institution/requests", label: "Donation requests", exact: false },
  { href: "/institution/profile", label: "Profile", exact: false },
];

export function InstitutionNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Institution dashboard" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex w-max gap-1 rounded-xl border border-border bg-surface p-1">
        {TABS.map((t) => {
          const active = t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`);
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`block whitespace-nowrap rounded-lg px-3.5 py-2 text-sm transition-colors ${
                  active ? "bg-brand-soft font-medium text-brand" : "text-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {t.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
