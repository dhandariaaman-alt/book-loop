import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/session";

export const metadata: Metadata = { title: "Admin" };

const TINTS = ["bg-mint", "bg-peach", "bg-lavender", "bg-sky", "bg-butter"] as const;

// Phase 6 builds the full admin dashboard. This page proves role-based access works.
export default async function AdminPage() {
  await requireRole(["ADMIN"]);

  const [users, listings, pendingInstitutions, openReports, openDisputes] = await Promise.all([
    prisma.user.count(),
    prisma.bookListing.count({ where: { status: { not: "REMOVED" } } }),
    prisma.institution.count({ where: { verificationStatus: "PENDING" } }),
    prisma.report.count({ where: { status: { in: ["OPEN", "UNDER_REVIEW", "ESCALATED"] } } }),
    prisma.dispute.count({ where: { status: { in: ["OPEN", "INVESTIGATING"] } } }),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="heading text-3xl font-semibold sm:text-4xl">Admin</h1>
      <p className="font-mono text-xs uppercase tracking-widest text-muted">Platform overview</p>
      <dl className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          { label: "Users", value: users },
          { label: "Active listings", value: listings },
          { label: "Institutions to verify", value: pendingInstitutions },
          { label: "Open reports", value: openReports },
          { label: "Open disputes", value: openDisputes },
        ].map((s, i) => (
          <div key={s.label} className={`card p-4 ${TINTS[i % TINTS.length]}`}>
            <dt className="font-mono text-[11px] uppercase tracking-wider text-muted">{s.label}</dt>
            <dd className="heading mt-1 text-4xl font-semibold">{s.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
