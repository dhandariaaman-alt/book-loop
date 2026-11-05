import Link from "next/link";

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-md font-serif text-xl font-semibold tracking-tight">
      <svg viewBox="0 0 32 32" className="size-7 text-brand" aria-hidden>
        <path
          d="M6 7.5c3-1.3 6.3-1 9 1v16c-2.7-2-6-2.3-9-1v-16Zm20 0c-3-1.3-6.3-1-9 1v16c2.7-2 6-2.3 9-1v-16Z"
          fill="currentColor"
          opacity=".9"
        />
        <circle cx="16" cy="27" r="2" fill="var(--accent)" />
      </svg>
      BookLoop
    </Link>
  );
}
