// Handwriting font for the "filled in" entries, bundled locally (no Google Fonts fetch).
import "@fontsource/caveat/latin-500.css";
import { Reveal } from "@/components/landing/reveal";
import { BookCover } from "@/components/landing/book-cover";
import { FAMOUS_BOOKS } from "@/lib/famous-books";

const hand = { className: "font-hand" };

// Speckled mask so stamps look like uneven rubber-stamp ink rather than a clean box.
const INK_TEXTURE = `url("data:image/svg+xml,${encodeURIComponent(
  "<svg xmlns='http://www.w3.org/2000/svg' width='160' height='60'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='1.1' numOctaves='2' seed='7'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  -4 0 0 0 3.2'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>",
)}")`;

type Way = {
  no: string;
  title: string;
  text: string;
  book: string;
  entries: [label: string, value: string][];
  stamp: string;
  ink: string;
  tilt: number;
  stampTilt: number;
};

const WAYS: Way[] = [
  {
    no: "01",
    title: "Borrow",
    text: "Read a neighbour's copy for a few weeks, then hand it back.",
    book: "The Hobbit",
    entries: [["Book", "The Hobbit"], ["From", "Priya, 0.8 km"], ["Due", "24 Nov"]],
    stamp: "Borrowed",
    ink: "#b8322a",
    tilt: -2,
    stampTilt: -6,
  },
  {
    no: "02",
    title: "Exchange",
    text: "Swap a book you've finished for one you haven't.",
    book: "Sapiens",
    entries: [["Gave", "Sapiens"], ["Got", "Atomic Habits"], ["With", "Arjun, 2 km"]],
    stamp: "Swapped",
    ink: "#2b55a1",
    tilt: 1.5,
    stampTilt: 4,
  },
  {
    no: "03",
    title: "Give away",
    text: "Pass a book on for free to someone who'll read it.",
    book: "The Little Prince",
    entries: [["Book", "Little Prince"], ["To", "Meera, 1 km"], ["Price", "free ♡"]],
    stamp: "Given",
    ink: "#2f6f5e",
    tilt: -1,
    stampTilt: -4,
  },
  {
    no: "04",
    title: "Sell",
    text: "Name a fair price and settle it between yourselves.",
    book: "The Alchemist",
    entries: [["Book", "The Alchemist"], ["To", "Kabir, 3 km"], ["Price", "₹120"]],
    stamp: "Sold",
    ink: "#b5602b",
    tilt: 2,
    stampTilt: 6,
  },
];

function Paperclip() {
  return (
    <svg viewBox="0 0 24 60" className="absolute -top-4 left-1/2 z-10 h-14 w-6 -translate-x-1/2 drop-shadow-sm" fill="none" aria-hidden>
      <path
        d="M8 22V10a4 4 0 0 1 8 0v34a7 7 0 0 1-14 0V16"
        stroke="#9aa1a8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckoutCard({ way, index }: { way: Way; index: number }) {
  const book = FAMOUS_BOOKS.find((b) => b.title === way.book) ?? FAMOUS_BOOKS[0];
  return (
    <Reveal delay={index * 120} className="h-full">
      <article
        className="group relative h-full transition-transform duration-300 ease-out hover:z-10 hover:-translate-y-1.5 hover:!rotate-0"
        style={{ rotate: `${way.tilt}deg` }}
      >
        <div
          className="relative h-full overflow-hidden rounded-[4px] border border-[#e6dcc6] bg-[#fffaf0] px-5 pb-6 pt-4 shadow-[0_1px_0_#e6dcc6,0_14px_30px_-18px_rgb(60_40_10/0.45)] transition-shadow group-hover:shadow-[0_1px_0_#e6dcc6,0_22px_40px_-18px_rgb(60_40_10/0.5)]"
          style={{
            backgroundImage:
              "linear-gradient(to right, transparent 34px, #e8a9a1 34px, #e8a9a1 35px, transparent 35px), repeating-linear-gradient(to bottom, transparent 0 27px, #d9e5ef 27px 28px)",
            backgroundPosition: "0 0, 0 74px",
          }}
        >
          {/* card header */}
          <div className="flex items-baseline justify-between gap-2 whitespace-nowrap pl-8 font-mono text-[10px] uppercase tracking-[0.16em] text-[#8a7f6b]">
            <span>BookLoop · Card</span>
            <span>No. {way.no}</span>
          </div>

          <div className="mt-3 flex gap-3 pl-8">
            <div className="min-w-0 flex-1">
              <h3 className="heading text-[1.55rem] font-semibold leading-none text-[#2a241c]">{way.title}</h3>
              <p className="mt-2 text-[13px] leading-snug text-[#6f6656]">{way.text}</p>
            </div>
            <div className="relative -mr-1 mt-1 shrink-0 rotate-3 transition-transform duration-300 group-hover:rotate-0">
              <Paperclip />
              <BookCover book={book} size="xs" className="!rounded-[2px]" />
            </div>
          </div>

          {/* ledger entries, "handwritten" */}
          <dl className="mt-4 pl-8">
            {way.entries.map(([label, value]) => (
              <div key={label} className="flex h-7 items-end gap-2">
                <dt className="w-[3.3rem] shrink-0 pb-1 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9a8f7a]">{label}</dt>
                <dd className={`${hand.className} min-w-0 truncate pb-0.5 text-[1.35rem] leading-none text-[#2b4a7a]`}>{value}</dd>
              </div>
            ))}
            {/* status line with the rubber stamp; it has its own space so it never covers text */}
            <div className="flex h-14 items-center gap-2">
              <dt className="w-[3.3rem] shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-[#9a8f7a]">Status</dt>
              <dd>
                <span
                  className="stamp inline-block select-none rounded-[3px] border-2 px-2 py-[3px] font-mono text-[12px] font-bold uppercase leading-none tracking-[0.22em]"
                  style={{
                    color: way.ink,
                    borderColor: way.ink,
                    boxShadow: `inset 0 0 0 1.5px #fffaf0, inset 0 0 0 2.5px ${way.ink}`,
                    maskImage: INK_TEXTURE,
                    WebkitMaskImage: INK_TEXTURE,
                    "--stamp-r": `${way.stampTilt}deg`,
                  } as React.CSSProperties}
                >
                  {way.stamp}
                </span>
              </dd>
            </div>
          </dl>
        </div>
      </article>
    </Reveal>
  );
}

export function WaysToShare() {
  return (
    <section className="mx-auto max-w-6xl px-4">
      <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-2">
        <h2 className="heading text-3xl font-semibold sm:text-4xl">Four ways to keep books moving</h2>
        <p className={`${hand.className} text-2xl text-accent`}>every hand-off gets a stamp ✶</p>
      </div>
      <div className="mx-auto mt-9 grid max-w-3xl gap-x-8 gap-y-10 sm:grid-cols-2 xl:max-w-none xl:grid-cols-4 xl:gap-x-6">
        {WAYS.map((w, i) => (
          <CheckoutCard key={w.no} way={w} index={i} />
        ))}
      </div>
      <p className="mt-8 text-sm text-muted">
        Libraries and community centres can also post donation requests for the books they need.
      </p>
    </section>
  );
}
