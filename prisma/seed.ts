import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const GENRES = [
  "Fiction", "Non-fiction", "Mystery & Thriller", "Fantasy", "Science Fiction",
  "Romance", "Biography", "History", "Self-help", "Business", "Science",
  "Poetry", "Children", "Young Adult", "Comics & Graphic Novels", "Academic",
  "Religion & Spirituality", "Cooking", "Travel", "Regional Languages",
];

const slugify = (s: string) =>
  s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

async function main() {
  for (const name of GENRES) {
    await prisma.genre.upsert({
      where: { slug: slugify(name) },
      update: {},
      create: { name, slug: slugify(name) },
    });
  }
  await prisma.platformSetting.upsert({
    where: { key: "reservation_expiry_hours" },
    update: {},
    create: { key: "reservation_expiry_hours", value: "48" },
  });
  console.log(`Seeded ${GENRES.length} genres and default settings.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
