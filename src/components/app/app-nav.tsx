"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconKind } from "./ui";

type Item = { href: string; label: string; short: string; icon: IconKind; tint: string };

export const APP_NAV: Item[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: "home", tint: "bg-mint" },
  { href: "/discover", label: "Discover books", short: "Discover", icon: "compass", tint: "bg-peach" },
  { href: "/activity", label: "My activity", short: "Activity", icon: "swap", tint: "bg-lavender" },
  { href: "/community", label: "Community", short: "Community", icon: "heart", tint: "bg-rose" },
  { href: "/messages", label: "Messages", short: "Messages", icon: "chat", tint: "bg-sky" },
  { href: "/settings/profile", label: "Profile", short: "Profile", icon: "user", tint: "bg-butter" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Left sidebar on large screens. */
export function SideNav({ name, username }: { name: string; username: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="App" className="sticky top-24 hidden w-56 shrink-0 self-start lg:block">
      <div className="card relative overflow-hidden p-2">
        <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-mint via-peach to-lavender" />
        <div className="px-3 pb-3 pt-4">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted">@{username}</p>
        </div>
        <ul className="space-y-0.5">
          {APP_NAV.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                    active ? `${item.tint} font-semibold text-fg` : "text-muted hover:bg-surface-2 hover:text-fg"
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1.5 transition-colors ${
                      active ? "bg-surface text-brand" : `${item.tint} text-brand/80 group-hover:text-brand`
                    }`}
                  >
                    <Icon kind={item.icon} />
                  </span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="font-hand mt-4 px-3 text-xl leading-snug text-accent">keep the books moving ✶</p>
    </nav>
  );
}

/** Bottom tab bar on phones and tablets. */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="App"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-6">
        {APP_NAV.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className="flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px]"
              >
                <span
                  className={`flex h-8 w-11 items-center justify-center rounded-full p-1.5 transition-colors ${
                    active ? `${item.tint} text-brand` : "text-muted"
                  }`}
                >
                  <Icon kind={item.icon} />
                </span>
                <span className={active ? "font-semibold text-fg" : "text-muted"}>{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
