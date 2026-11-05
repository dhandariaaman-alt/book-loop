"use client";

import { usePathname } from "next/navigation";

/**
 * Soft pastel background shared by every page except the landing page
 * (which has its own section backgrounds): dotted paper plus slow glows.
 */
export function PageBackdrop() {
  const pathname = usePathname();
  if (pathname === "/") return null;
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="dot-grid absolute inset-0 opacity-70" />
      <div className="animate-blob absolute -left-32 -top-32 h-[28rem] w-[28rem] rounded-full bg-mint blur-3xl" />
      <div
        className="animate-blob absolute -right-40 top-1/4 h-[30rem] w-[30rem] rounded-full bg-peach opacity-80 blur-3xl"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="animate-blob absolute -bottom-40 left-1/3 h-[26rem] w-[26rem] rounded-full bg-lavender opacity-80 blur-3xl"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}
