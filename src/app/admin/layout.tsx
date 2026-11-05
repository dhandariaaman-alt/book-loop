import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";
import { OPEN_REPORT_STATUSES } from "@/lib/admin";
import { AdminNav } from "./_components/admin-nav";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · BookLoop" } };

// Admin console shell (ADMIN only). Sits under the global navbar, outside the (app) group.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireRole(["ADMIN"]);

  const [institutions, reports, disputes] = await Promise.all([
    prisma.institution.count({ where: { verificationStatus: "PENDING" } }),
    prisma.report.count({ where: { status: { in: OPEN_REPORT_STATUSES } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 lg:flex lg:gap-8 lg:pt-8">
      <AdminNav badges={{ "/admin/institutions": institutions, "/admin/reports": reports, "/admin/disputes": disputes }} />
      <div className="mt-6 min-w-0 flex-1 lg:mt-0">{children}</div>
    </div>
  );
}
