import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { PageHeader, Panel } from "@/components/app/ui";
import { InstitutionForm } from "@/components/trust/institution-form";
import { VERIFICATION_LABEL, institutionTypeLabel } from "@/lib/trust-labels";

export const metadata: Metadata = { title: "Register your institution" };

const STATUS_STYLE = {
  PENDING: "bg-butter",
  VERIFIED: "bg-mint",
  REJECTED: "bg-rose",
} as const;

export default async function InstitutionSettingsPage() {
  const me = await requireUser();
  const [inst, user] = await Promise.all([
    prisma.institution.findUnique({
      where: { userId: me.id },
      select: {
        name: true,
        type: true,
        description: true,
        publicAddress: true,
        neighbourhood: true,
        website: true,
        verificationStatus: true,
        createdAt: true,
        verifiedAt: true,
      },
    }),
    prisma.user.findUnique({ where: { id: me.id }, select: { role: true } }),
  ]);
  const canManage = inst?.verificationStatus === "VERIFIED" && (user?.role === "INSTITUTION" || user?.role === "ADMIN");

  return (
    <div className="min-w-0">
      <PageHeader
        title="Register your library or community centre"
        note="books for everyone ✶"
        subtitle="Verified institutions can post donation requests and receive books from neighbours."
      />

      {inst && (
        <section className={`card mt-6 p-5 ${STATUS_STYLE[inst.verificationStatus]}`} aria-live="polite">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[11px] uppercase tracking-wider text-fg/70">Application status</p>
              <h2 className="heading mt-1 break-words text-xl font-semibold">{inst.name}</h2>
              <p className="text-sm text-fg/80">{institutionTypeLabel(inst.type)}</p>
            </div>
            <span className="rounded-full border border-border bg-surface px-3 py-1 text-sm font-medium">
              {VERIFICATION_LABEL[inst.verificationStatus]}
            </span>
          </div>
          <p className="mt-3 text-sm">
            {inst.verificationStatus === "PENDING" &&
              `Sent on ${inst.createdAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}. A BookLoop admin will check your details and let you know. You can still update them below.`}
            {inst.verificationStatus === "VERIFIED" &&
              (canManage
                ? "You're verified. Manage your profile and donation requests from the institution dashboard."
                : "You're verified. Please sign out and back in to open the institution dashboard.")}
            {inst.verificationStatus === "REJECTED" &&
              "We couldn't verify this application. Please check the details below and send it again, or contact BookLoop for help."}
          </p>
          {canManage && (
            <Link href="/institution" className="btn-primary mt-4">
              Open institution dashboard
            </Link>
          )}
        </section>
      )}

      {inst?.verificationStatus !== "VERIFIED" && (
        <div className="mt-6">
          <Panel title={inst ? "Your application" : "Tell us about your institution"} tint="sky" icon="home">
            {!inst && (
              <p className="mb-4 text-sm text-muted">
                We check every institution by hand before it can post requests. Your personal account stays the same while we
                review it.
              </p>
            )}
            <InstitutionForm
              mode="register"
              submitLabel={!inst ? "Send for verification" : inst.verificationStatus === "REJECTED" ? "Save and send again" : "Save changes"}
              initial={
                inst
                  ? {
                      name: inst.name,
                      type: inst.type,
                      description: inst.description ?? "",
                      publicAddress: inst.publicAddress ?? "",
                      neighbourhood: inst.neighbourhood ?? "",
                      website: inst.website ?? "",
                    }
                  : undefined
              }
            />
          </Panel>
        </div>
      )}
    </div>
  );
}
