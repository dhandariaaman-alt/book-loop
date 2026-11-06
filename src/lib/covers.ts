// Finds a book's real cover on Open Library when the owner didn't upload a photo
// or pick a search result. Returns null when nothing suitable is found. Never throws.

type Doc = { title?: string; author_name?: string[]; cover_i?: number; edition_count?: number };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Title without leading or trailing articles, so "NAMESAKE, THE" matches "The Namesake". */
const titleKey = (s: string) =>
  norm(s)
    .replace(/^(the|a|an) /, "")
    .replace(/ (the|a|an)$/, "");

const coverFromId = (id: number) => `https://covers.openlibrary.org/b/id/${id}-L.jpg`;

export { isStockCover } from "./listing-labels";

async function search(params: Record<string, string>, attempt = 1): Promise<Doc[]> {
  try {
    const qs = new URLSearchParams({ ...params, fields: "title,author_name,cover_i,edition_count", limit: "10" });
    const res = await fetch(`https://openlibrary.org/search.json?${qs}`, {
      headers: { "User-Agent": "BookLoop/0.2 (community book sharing)" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 86400 },
    });
    if (!res.ok) {
      console.warn("[covers] Open Library returned", res.status);
      return [];
    }
    const data = (await res.json()) as { docs?: Doc[] };
    return data.docs ?? [];
  } catch (e) {
    if (attempt < 2) return search(params, attempt + 1); // one retry on timeout or network error
    throw e;
  }
}

function pickBest(docs: Doc[], title: string, author: string): number | null {
  const t = titleKey(title);
  const a = norm(author);
  const aLast = a.split(" ").pop() ?? a;
  const score = (d: Doc) => {
    const dt = titleKey(d.title ?? "");
    const authorMatch = (d.author_name ?? []).some((n) => {
      const na = norm(n);
      return na === a || na.includes(a) || a.includes(na) || na.split(" ").pop() === aLast;
    });
    return (dt === t ? 4 : dt.startsWith(t) || t.startsWith(dt) ? 2 : 0) + (authorMatch ? 3 : 0);
  };
  const best = docs
    .filter((d) => d.cover_i)
    .map((d) => ({ d, s: score(d) }))
    .filter((x) => x.s >= 5) // must match both title and author reasonably well
    .sort((x, y) => y.s - x.s || (y.d.edition_count ?? 0) - (x.d.edition_count ?? 0))[0];
  return best?.d.cover_i ?? null;
}

/** Best-effort real cover URL for a title/author (or ISBN). */
export async function findCoverUrl(title: string, author: string, isbn?: string | null): Promise<string | null> {
  try {
    if (isbn) {
      const byIsbn = (await search({ isbn: isbn.replace(/[^0-9Xx]/g, "") })).find((d) => d.cover_i);
      if (byIsbn?.cover_i) return coverFromId(byIsbn.cover_i);
    }
    // Exact fields first, then a broader text search (catalogue titles can be oddly formatted).
    const id =
      pickBest(await search({ title, author }), title, author) ??
      pickBest(await search({ q: `${title} ${author}` }), title, author);
    return id ? coverFromId(id) : null;
  } catch (e) {
    console.warn("[covers] lookup failed for", JSON.stringify(title), e instanceof Error ? e.message : e);
    return null;
  }
}
