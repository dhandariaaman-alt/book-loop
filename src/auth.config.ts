import type { NextAuthConfig } from "next-auth";

// Edge-safe settings shared by middleware and the full auth setup in auth.ts.
// No database access here.

const PRIVATE_PREFIXES = ["/dashboard", "/settings", "/admin", "/moderator", "/institution"];

export default {
  pages: { signIn: "/login", error: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const user = auth?.user;
      if (!PRIVATE_PREFIXES.some((p) => path.startsWith(p))) return true;
      if (!user) return false; // → redirected to /login with callbackUrl

      const role = user.role;
      const denied =
        (path.startsWith("/admin") && role !== "ADMIN") ||
        (path.startsWith("/moderator") && role !== "MODERATOR" && role !== "ADMIN") ||
        (path.startsWith("/institution") && role !== "INSTITUTION" && role !== "ADMIN");
      if (denied) return Response.redirect(new URL("/dashboard", request.nextUrl));
      return true;
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
