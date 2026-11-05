import type { Metadata } from "next";
import { PageHeader, Panel } from "@/components/app/ui";
import { InstitutionForm } from "@/components/trust/institution-form";
import { getInstitutionAccess } from "../access";

export const metadata: Metadata = { title: "Profile" };

export default async function InstitutionProfilePage() {
  const access = await getInstitutionAccess();
  if (!access) return null;
  const i = access.institution;

  return (
    <div className="space-y-6">
      <PageHeader title="Institution profile" subtitle="This is what neighbours see on the Community page and your donation requests." />
      <Panel title="Details" tint="sky" icon="home">
        <InstitutionForm
          mode="edit"
          submitLabel="Save profile"
          initial={{
            name: i.name,
            type: i.type,
            description: i.description ?? "",
            publicAddress: i.publicAddress ?? "",
            neighbourhood: i.neighbourhood ?? "",
            website: i.website ?? "",
          }}
        />
      </Panel>
    </div>
  );
}
