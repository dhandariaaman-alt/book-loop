import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md px-4 py-24 text-center">
      <p className="heading text-6xl font-semibold text-brand">404</p>
      <h1 className="mt-4 text-xl font-semibold">This page has wandered off the shelf</h1>
      <Link href="/" className="btn-primary mt-6">Back home</Link>
    </div>
  );
}
