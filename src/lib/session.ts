import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";

/**
 * The signed-in session, read once per request. The layout, navbar and page all
 * ask for it; without this each call would re-check the user in the database.
 */
export const getSession = cache(() => auth());

/** Server-side guard for private pages and actions. Middleware is not the only check. */
export async function requireUser() {
  const session = await getSession();
  if (!session?.user?.id) redirect("/login");
  return session.user;
}

export async function requireRole(roles: Role[]) {
  const user = await requireUser();
  if (!roles.includes(user.role)) redirect("/dashboard");
  return user;
}
