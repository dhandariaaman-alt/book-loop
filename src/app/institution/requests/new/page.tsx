import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Panel } from "@/components/app/ui";
import { getInstitutionAccess } from "../../access";
import { DonationRequestForm } from "../../forms";

export const metadata: Metadata = { title: "New donation request" };

export default async function NewDonationRequestPage() {
  const access = await getInstitutionAccess();
  if (!access) return null;
  const genres = await prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="New donation request"
        subtitle="Tell neighbours which books would help most."
        actions={
          <Link href="/institution/requests" className="btn-ghost">
            Cancel
          </Link>
        }
      />
      <Panel title="Request details" tint="rose" icon="heart">
        <DonationRequestForm genres={genres} />
      </Panel>
    </div>
  );
}
