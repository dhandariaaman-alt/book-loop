import Link from "next/link";
import "@fontsource/caveat/latin-500.css";
import { Doodle } from "@/components/landing/decorations";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-20 text-center">
      <div className="relative mx-auto flex w-fit items-center justify-center px-10">
        <Doodle kind="book" className="-left-2 top-0 w-20" color="var(--brand)" fill="var(--butter)" animation="wiggle" />
        <p className="heading relative ml-16 text-7xl font-semibold text-brand sm:text-8xl">404</p>
        <span aria-hidden className="font-hand absolute -right-2 -top-4 rotate-12 text-6xl text-accent">?</span>
      </div>
      <h1 className="font-hand mt-6 text-4xl text-fg">This page has wandered off the shelf</h1>
      <p className="mt-2 text-sm text-muted">We looked between the mysteries and the cookbooks. Nothing.</p>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </div>
  );
}
