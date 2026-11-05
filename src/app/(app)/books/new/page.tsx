import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { createListingAction } from "@/app/actions/listings";
import { Icon, PageHeader } from "@/components/app/ui";
import { ListingForm } from "@/components/listings/listing-form";

export const metadata: Metadata = { title: "List a book" };

export default async function NewListingPage() {
  const me = await requireUser();
  const [profile, genres] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: me.id }, select: { neighbourhood: true, latitude: true } }),
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  const hasArea = !!profile?.neighbourhood || profile?.latitude != null;

  return (
    <div className="min-w-0">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="List a book" note="give it another reader" />
      </div>
      <div className="mt-6">
        {hasArea ? (
          <ListingForm genres={genres} action={createListingAction} submitLabel="List my book" />
        ) : (
          <div className="card mx-auto flex max-w-2xl flex-col items-start gap-3 bg-butter p-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface p-2 text-brand">
              <Icon kind="pin" />
            </span>
            <h2 className="heading text-xl font-semibold">First, tell us your area</h2>
            <p className="text-sm">
              Neighbours find books close to them. Add your neighbourhood to your profile and you&apos;re ready to list. We only
              ever show the neighbourhood, never your address.
            </p>
            <Link href="/settings/profile" className="btn-primary">
              Set my area
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
