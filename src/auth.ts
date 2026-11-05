import NextAuth, { CredentialsSignin } from "next-auth";
import type { Adapter, AdapterUser } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import authConfig from "./auth.config";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation";
import { uniqueUsername } from "@/lib/username";

class AccountSuspended extends CredentialsSignin {
  code = "suspended";
}

export const googleEnabled = Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

// Google sign-ups need a username and an empty profile, which the stock adapter doesn't create.
const baseAdapter = PrismaAdapter(prisma) as Adapter;
const adapter: Adapter = {
  ...baseAdapter,
  async createUser(data) {
    const username = await uniqueUsername(data.name || data.email);
    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        name: data.name,
        image: data.image,
        emailVerified: data.emailVerified,
        username,
        profile: { create: {} },
      },
    });
    return user as AdapterUser;
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  providers: [
    ...(googleEnabled ? [Google] : []),
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user?.passwordHash) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        if (user.status !== "ACTIVE") throw new AccountSuspended();
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
          role: user.role,
          username: user.username,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user, account }) {
      if (account?.provider === "credentials" || !user.email) return true;
      const existing = await prisma.user.findUnique({
        where: { email: user.email.toLowerCase() },
        select: { status: true },
      });
      return !existing || existing.status === "ACTIVE";
    },
    // Re-read role/status from the database so role changes and bans apply right away.
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
        token.username = user.username;
        return token;
      }
      if (!token.id) return token;
      const db = await prisma.user.findUnique({
        where: { id: token.id },
        select: { role: true, username: true, status: true, name: true, image: true },
      });
      if (!db || db.status !== "ACTIVE") return null;
      token.role = db.role;
      token.username = db.username;
      token.name = db.name;
      token.picture = db.image;
      return token;
    },
  },
});
