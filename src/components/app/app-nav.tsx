"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef, useState } from "react";
import { Icon, type IconKind } from "./ui";

type Item = { href: string; label: string; short: string; icon: IconKind; tint: string };

// `tint` is kept for compatibility; all tints are now one warm family.
export const APP_NAV: Item[] = [
  { href: "/dashboard", label: "Home", short: "Home", icon: "home", tint: "bg-mint" },
  { href: "/discover", label: "Discover books", short: "Discover", icon: "compass", tint: "bg-peach" },
  { href: "/activity", label: "My activity", short: "Activity", icon: "swap", tint: "bg-butter" },
  { href: "/community", label: "Community", short: "Community", icon: "heart", tint: "bg-rose" },
  { href: "/messages", label: "Messages", short: "Messages", icon: "chat", tint: "bg-sky" },
  { href: "/settings/profile", label: "Profile", short: "Profile", icon: "user", tint: "bg-lavender" },
];

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

type Pill = { y: number; h: number } | null;

/** Left sidebar on large screens. */
export function SideNav({ name, username }: { name: string; username: string }) {
  const pathname = usePathname();
  const itemRefs = useRef<(HTMLLIElement | null)[]>([]);
  const [pill, setPill] = useState<Pill>(null);
  // Transition only after the pill has been placed once, so it never slides in from 0.
  const [animate, setAnimate] = useState(false);
  const activeIndex = APP_NAV.findIndex((item) => isActive(pathname, item.href));

  useLayoutEffect(() => {
    const el = activeIndex >= 0 ? itemRefs.current[activeIndex] : null;
    setPill(el ? { y: el.offsetTop, h: el.offsetHeight } : null);
  }, [activeIndex]);

  useLayoutEffect(() => {
    if (pill && !animate) {
      const id = requestAnimationFrame(() => setAnimate(true));
      return () => cancelAnimationFrame(id);
    }
  }, [pill, animate]);

  return (
    <nav aria-label="App" className="sticky top-24 hidden w-56 shrink-0 self-start lg:block">
      <div className="card relative overflow-hidden p-2">
        <div className="border-b border-border px-3 pb-3 pt-2">
          <p className="truncate font-medium">{name}</p>
          <p className="truncate text-xs text-muted">@{username}</p>
        </div>
        <ul className="relative mt-2 space-y-0.5">
          {pill && (
            <span
              aria-hidden
              className={`absolute inset-x-0 top-0 rounded-xl bg-brand-soft ${animate ? "nav-pill" : ""}`}
              style={{ height: pill.h, transform: `translateY(${pill.y}px)` }}
            />
          )}
          {APP_NAV.map((item, i) => {
            const active = i === activeIndex;
            return (
              <li
                key={item.href}
                ref={(el) => {
                  itemRefs.current[i] = el;
                }}
                className="relative"
              >
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${
                    active
                      ? `font-semibold text-fg ${pill ? "" : "bg-brand-soft"}`
                      : "text-muted hover:bg-surface-2/70 hover:text-fg"
                  }`}
                >
                  <span
                    className={`nav-icon nav-icon-nudge flex h-8 w-8 shrink-0 items-center justify-center rounded-lg p-1.5 ${
                      active ? "bg-surface text-brand" : "text-muted group-hover:text-brand"
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
      <p className="font-hand mt-4 px-3 text-xl leading-snug text-accent">keep the books moving</p>
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
                className="group flex flex-col items-center gap-0.5 px-1 py-2 text-[10.5px] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
              >
                <span className="relative flex h-8 w-11 items-center justify-center">
                  <span aria-hidden className="tab-icon-bg absolute inset-0 rounded-full bg-brand-soft" />
                  <span
                    className={`nav-icon relative h-full w-full p-1.5 ${
                      active ? "text-brand" : "text-muted group-active:scale-90"
                    }`}
                  >
                    <Icon kind={item.icon} />
                  </span>
                </span>
                <span className={`tab-label ${active ? "font-semibold text-fg" : "text-muted"}`}>{item.short}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
