import { prisma } from "./prisma";

/** Turn a name or email into a free username like "priya_sharma" or "priya_sharma42". */
export async function uniqueUsername(seed: string): Promise<string> {
  const base =
    seed
      .split("@")[0]
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 15) || "reader";
  const padded = base.length < 3 ? `${base}_reader` : base;

  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? padded : `${padded}${Math.floor(Math.random() * 9000) + 100}`;
    const taken = await prisma.user.findUnique({ where: { username: candidate }, select: { id: true } });
    if (!taken) return candidate;
  }
  return `reader${Date.now().toString(36)}`;
}
