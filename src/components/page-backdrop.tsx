"use client";

import { usePathname } from "next/navigation";

/**
 * Warm paper background shared by every page except the landing page
 * (which has its own section backgrounds): dotted paper plus two faint glows.
 */
export function PageBackdrop() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="dot-grid absolute inset-0 opacity-60" />
      <div className="animate-blob absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-mint opacity-50 blur-3xl" />
      <div
        className="animate-blob absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-peach opacity-35 blur-3xl"
        style={{ animationDelay: "-9s" }}
      />
    </div>
  );
}
