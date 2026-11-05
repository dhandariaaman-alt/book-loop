import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

/**
 * The signed-in user's institution, if they may use the dashboard: role
 * INSTITUTION or ADMIN (read from the database, not the session token) and a
 * VERIFIED institution. Returns null otherwise.
 */
export const getInstitutionAccess = cache(async () => {
  const me = await requireUser();
  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: {
      role: true,
      institution: {
        select: {
          id: true,
          name: true,
          type: true,
          description: true,
          publicAddress: true,
          neighbourhood: true,
          website: true,
          verificationStatus: true,
        },
      },
    },
  });
  if (!user?.institution) return null;
  if (user.role !== "INSTITUTION" && user.role !== "ADMIN") return null;
  if (user.institution.verificationStatus !== "VERIFIED") return null;
  return { userId: me.id, institution: user.institution };
});
