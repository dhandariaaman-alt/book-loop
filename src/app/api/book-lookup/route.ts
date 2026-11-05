import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { rateLimit } from "@/lib/rate-limit";

// Looks up a book on Open Library so the listing form can fill in the author and cover.
// GET /api/book-lookup?q=the+hobbit  →  { results: [{ title, author, year, isbn, coverUrl }] }

type Doc = { title?: string; author_name?: string[]; first_publish_year?: number; isbn?: string[]; cover_i?: number };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (!rateLimit(`lookup:${session.user.id}`, 60, 60_000)) {
    return NextResponse.json({ error: "Too many lookups. Wait a moment." }, { status: 429 });
  }

  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 120) ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  try {
    const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&fields=title,author_name,first_publish_year,isbn,cover_i&limit=6`;
    const res = await fetch(url, {
      headers: { "User-Agent": "BookLoop/0.2 (community book sharing)" },
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 3600 },
    });
    if (!res.ok) return NextResponse.json({ results: [] });
    const data = (await res.json()) as { docs?: Doc[] };
    const results = (data.docs ?? [])
      .filter((d) => d.title)
      .map((d) => ({
        title: d.title!,
        author: d.author_name?.[0] ?? "",
        year: d.first_publish_year ?? null,
        isbn: d.isbn?.find((i) => i.length === 13) ?? d.isbn?.[0] ?? null,
        coverUrl: d.cover_i ? `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg` : null,
      }));
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
