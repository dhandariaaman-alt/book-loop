import type { Metadata } from "next";
import Link from "next/link";
import { getInstitutionAccess } from "./access";
import { InstitutionNav } from "./institution-nav";
import { institutionTypeLabel } from "@/lib/trust-labels";

export const metadata: Metadata = { title: { default: "Institution", template: "%s · Institution · BookLoop" } };

export default async function InstitutionLayout({ children }: { children: React.ReactNode }) {
  const access = await getInstitutionAccess();

  if (!access) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <section className="card bg-butter p-6 text-center">
          <h1 className="heading text-2xl font-semibold">Institution dashboard</h1>
          <p className="mt-2 text-sm text-fg/80">
            This space is for verified libraries, community centres and schools. Register your institution and a BookLoop admin
            will review it. If you were just verified, sign out and back in.
          </p>
          <Link href="/settings/institution" className="btn-primary mt-5">
            Register or check your status
          </Link>
        </section>
      </div>
    );
  }

  const inst = access.institution;
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-6 lg:pt-8">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[11px] uppercase tracking-widest text-muted">Institution dashboard</p>
          <p className="heading break-words text-lg font-semibold">
            {inst.name}{" "}
            <span className="ml-1 rounded-full bg-mint px-2 py-0.5 align-middle text-xs font-normal">
              {institutionTypeLabel(inst.type)} · Verified
            </span>
          </p>
        </div>
        <Link href="/dashboard" className="btn-ghost text-sm">
          Back to BookLoop
        </Link>
      </div>
      <InstitutionNav />
      <div className="mt-6 min-w-0">{children}</div>
    </div>
  );
}
