import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { getListing } from "@/lib/listings";
import { updateListingAction } from "@/app/actions/listings";
import { PageHeader } from "@/components/app/ui";
import { ListingForm } from "@/components/listings/listing-form";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await requireUser();
  const [listing, genres] = await Promise.all([
    getListing(id, me.id),
    prisma.genre.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!listing || !listing.isMine) notFound();

  return (
    <div className="min-w-0">
      <div className="mx-auto max-w-2xl">
        <PageHeader title="Edit listing" note={listing.title} />
      </div>
      <div className="mt-6">
        <ListingForm
          genres={genres}
          action={updateListingAction.bind(null, id)}
          submitLabel="Save changes"
          cancelHref={`/books/${id}`}
          initial={{
            title: listing.title,
            author: listing.author,
            isbn: listing.isbn,
            genreId: listing.genreId,
            type: listing.type,
            condition: listing.condition,
            description: listing.description,
            priceRupees: listing.pricePaise != null ? String(listing.pricePaise / 100) : "",
            images: listing.images,
          }}
        />
      </div>
    </div>
  );
}
