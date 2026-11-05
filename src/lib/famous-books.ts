// Books for the landing page shelves. Cover images come from Open Library's free
// Covers API (coverId) or from /public (coverSrc); the colours and pattern are a
// drawn fallback if an image fails to load.
// Blurbs are our own one-line summaries.

export type ShelfGenre = "Classics" | "Fantasy" | "Indian voices" | "Non-fiction" | "Sci-fi & dystopia";

export type FamousBook = {
  title: string;
  author: string;
  /** Omitted when unknown. */
  year?: number;
  genre: ShelfGenre;
  blurb: string;
  color: string;
  ink: string;
  pattern: "stripes" | "sun" | "frame" | "waves" | "dots" | "diamond";
  /** Open Library cover ID: https://covers.openlibrary.org/b/id/{coverId}-M.jpg */
  coverId?: number;
  /** Local cover image under /public, used instead of Open Library. */
  coverSrc?: string;
};

export const SHELF_GENRES: ShelfGenre[] = ["Classics", "Fantasy", "Indian voices", "Non-fiction", "Sci-fi & dystopia"];

export const FAMOUS_BOOKS: FamousBook[] = [
  { title: "Magic of Seven Notes", coverSrc: "/covers/magic-of-seven-notes.webp", author: "Naman Dhandaria", genre: "Indian voices", blurb: "A novel of love and music, set under a moonlit sky.", color: "#2c3366", ink: "#ffffff", pattern: "dots" },
  { title: "Pride and Prejudice", coverId: 14543311, author: "Jane Austen", year: 1813, genre: "Classics", blurb: "Wit, first impressions and the long road to understanding someone.", color: "#7a2e3a", ink: "#f6e7d8", pattern: "frame" },
  { title: "1984", coverId: 15196195, author: "George Orwell", year: 1949, genre: "Sci-fi & dystopia", blurb: "A chilling look at surveillance, truth and the freedom to think.", color: "#1f2933", ink: "#e85d4a", pattern: "stripes" },
  { title: "To Kill a Mockingbird", coverId: 14351077, author: "Harper Lee", year: 1960, genre: "Classics", blurb: "Justice and childhood seen through the eyes of a small-town girl.", color: "#3d5a40", ink: "#f2e9d0", pattern: "sun" },
  { title: "The Great Gatsby", coverId: 14811162, author: "F. Scott Fitzgerald", year: 1925, genre: "Classics", blurb: "Jazz-age glamour hiding longing, money and a green light across the bay.", color: "#14324a", ink: "#e9c46a", pattern: "diamond" },
  { title: "The Alchemist", coverId: 45762, author: "Paulo Coelho", year: 1988, genre: "Classics", blurb: "A shepherd follows a dream across the desert to find his treasure.", color: "#c27b3d", ink: "#fff4e0", pattern: "sun" },
  { title: "The Hobbit", coverId: 14627509, author: "J.R.R. Tolkien", year: 1937, genre: "Fantasy", blurb: "A comfortable hobbit is swept into an adventure with dwarves and a dragon.", color: "#2f5d50", ink: "#f0d9a7", pattern: "waves" },
  { title: "Harry Potter and the Philosopher's Stone", coverId: 15155833, author: "J.K. Rowling", year: 1997, genre: "Fantasy", blurb: "An orphan learns he's a wizard and finds a home at Hogwarts.", color: "#7b1e1e", ink: "#f4c95d", pattern: "stripes" },
  { title: "The God of Small Things", coverId: 10585967, author: "Arundhati Roy", year: 1997, genre: "Indian voices", blurb: "Twins in Kerala and the small moments that change a family forever.", color: "#1d5c63", ink: "#f7d8a8", pattern: "waves" },
  { title: "Midnight's Children", coverId: 8346713, author: "Salman Rushdie", year: 1981, genre: "Indian voices", blurb: "A boy born at the stroke of independence, bound to the fate of a nation.", color: "#3a2a5e", ink: "#f2b880", pattern: "dots" },
  { title: "Wings of Fire", coverId: 9153819, author: "A.P.J. Abdul Kalam", year: 1999, genre: "Indian voices", blurb: "From Rameswaram to rockets: the life of India's Missile Man.", color: "#b5482a", ink: "#fff1e0", pattern: "sun" },
  { title: "Malgudi Days", coverId: 7981639, author: "R.K. Narayan", year: 1943, genre: "Indian voices", blurb: "Gentle, funny stories from a small South Indian town.", color: "#d9a441", ink: "#2b1d0e", pattern: "frame" },
  { title: "Gitanjali", coverId: 13880476, author: "Rabindranath Tagore", year: 1910, genre: "Indian voices", blurb: "Song offerings that won the Nobel Prize in Literature.", color: "#efe3c8", ink: "#6b3d1f", pattern: "diamond" },
  { title: "Sapiens", coverId: 8634250, author: "Yuval Noah Harari", year: 2011, genre: "Non-fiction", blurb: "How one species of ape came to run the planet.", color: "#e8dcc4", ink: "#a33b20", pattern: "dots" },
  { title: "Atomic Habits", coverId: 12539702, author: "James Clear", year: 2018, genre: "Non-fiction", blurb: "Tiny changes, repeated daily, that add up to remarkable results.", color: "#f3efe6", ink: "#1d3557", pattern: "stripes" },
  { title: "The Diary of a Young Girl", coverId: 13526331, author: "Anne Frank", year: 1947, genre: "Non-fiction", blurb: "A teenager's hopeful, honest diary written while hiding in Amsterdam.", color: "#9c6b4e", ink: "#fbf2e6", pattern: "frame" },
  { title: "Thinking, Fast and Slow", coverId: 13290711, author: "Daniel Kahneman", year: 2011, genre: "Non-fiction", blurb: "The two systems in your head and why they trip each other up.", color: "#264653", ink: "#e9c46a", pattern: "waves" },
  { title: "Dune", coverId: 11481354, author: "Frank Herbert", year: 1965, genre: "Sci-fi & dystopia", blurb: "Politics, prophecy and sandworms on the desert planet Arrakis.", color: "#c8873a", ink: "#2a1608", pattern: "waves" },
  { title: "Brave New World", coverId: 8231823, author: "Aldous Huxley", year: 1932, genre: "Sci-fi & dystopia", blurb: "A perfectly happy society, and the price everyone pays for it.", color: "#2a9d8f", ink: "#fdf6e3", pattern: "dots" },
  { title: "The Little Prince", coverId: 15222566, author: "Antoine de Saint-Exupéry", year: 1943, genre: "Fantasy", blurb: "A pilot meets a small traveller from a tiny planet.", color: "#284b8c", ink: "#f7d774", pattern: "dots" },
  { title: "Jane Eyre", coverId: 15133277, author: "Charlotte Brontë", year: 1847, genre: "Classics", blurb: "An orphan governess insists on her own worth, whatever the cost.", color: "#4a3b5c", ink: "#efe2cf", pattern: "frame" },
  { title: "The Kite Runner", coverId: 14846827, author: "Khaled Hosseini", year: 2003, genre: "Classics", blurb: "Friendship, betrayal and redemption from Kabul to California.", color: "#5b8e7d", ink: "#fff8ec", pattern: "diamond" },
  { title: "The Book Thief", coverId: 15267110, author: "Markus Zusak", year: 2005, genre: "Classics", blurb: "A girl in wartime Germany steals books, and shares them.", color: "#3b3b3b", ink: "#e76f51", pattern: "stripes" },
  { title: "The White Tiger", coverId: 2787359, author: "Aravind Adiga", year: 2008, genre: "Indian voices", blurb: "A driver's darkly funny climb out of India's servant class.", color: "#f4a261", ink: "#1b1b1b", pattern: "stripes" },
  { title: "A Suitable Boy", coverId: 911254, author: "Vikram Seth", year: 1993, genre: "Indian voices", blurb: "A mother's search for the right husband in 1950s India.", color: "#8c2f39", ink: "#f8e1b0", pattern: "diamond" },
];
