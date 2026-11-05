import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Hero } from "@/components/landing/hero";
import { BookShelves } from "@/components/landing/book-shelves";
import { WaysToShare } from "@/components/landing/ways-to-share";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCta } from "@/components/landing/final-cta";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="overflow-x-clip">
      <Hero />
      <div className="py-12 sm:py-16">
        <BookShelves />
      </div>
      <div className="py-12 sm:py-16">
        <WaysToShare />
      </div>
      <div className="py-12 sm:py-16">
        <HowItWorks />
      </div>
      <FinalCta />
    </div>
  );
}
