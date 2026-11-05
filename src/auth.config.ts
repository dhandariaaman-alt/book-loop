import type { NextAuthConfig } from "next-auth";

// Edge-safe settings shared by middleware and the full auth setup in auth.ts.
// No database access here.

const PRIVATE_PREFIXES = [
  "/dashboard",
  "/discover",
  "/books",
  "/transactions",
  "/notifications",
  "/activity",
  "/community",
  "/messages",
  "/settings",
  "/admin",
  "/moderator",
  "/institution",
];

export default {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const user = auth?.user;
      if (!PRIVATE_PREFIXES.some((p) => path.startsWith(p))) return true;
      // Middleware only requires being signed in. Role checks for /admin,
      // /moderator and /institution happen on the server in each layout/page
      // (requireRole and friends), which read the role fresh from the database.
      // The role in this cookie can be stale right after an admin changes it.
      return Boolean(user); // false → redirected to /login with callbackUrl
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role ?? "USER";
        token.username = user.username;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id;
      if (token.role) session.user.role = token.role;
      if (token.username) session.user.username = token.username;
      return session;
    },
  },
} satisfies NextAuthConfig;
