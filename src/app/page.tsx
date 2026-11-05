import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Hero } from "@/components/landing/hero";
import { BookShelves } from "@/components/landing/book-shelves";
import { WaysToShare } from "@/components/landing/ways-to-share";
import { HowItWorks } from "@/components/landing/how-it-works";
import { FinalCta } from "@/components/landing/final-cta";
import { Doodle, WaveDivider } from "@/components/landing/decorations";
import { AutoScroll } from "@/components/landing/auto-scroll";

export default async function Home() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <div className="overflow-x-clip">
      <AutoScroll />
      {/* Hero on dotted paper */}
      <div className="dot-grid relative">
        <Hero />
        <Doodle kind="sparkle" className="left-[4%] top-10 hidden w-8 sm:block" color="var(--accent)" fill="var(--butter)" animation="twinkle" />
        <Doodle kind="book" className="left-[44%] top-14 hidden w-12 lg:block" color="var(--brand)" fill="var(--mint)" rotate={-8} />
        <Doodle kind="cup" className="bottom-24 left-[46%] hidden w-11 lg:block" color="#9a6b4a" fill="var(--peach)" rotate={6} animation="wiggle" delay={400} />
        <Doodle kind="star" className="right-[6%] top-12 w-7 sm:w-9" color="#c99a1e" fill="var(--butter)" animation="twinkle" delay={800} />
        <Doodle kind="squiggle" className="bottom-6 right-[16%] hidden w-24 lg:block" color="var(--accent)" animation="drift" />
        <Doodle kind="heart" className="bottom-24 right-[4%] w-7 sm:w-8" color="#d1607a" fill="var(--rose)" animation="float" delay={300} />
      </div>

      {/* Shelves on mint */}
      <WaveDivider color="var(--mint)" />
      <div className="relative bg-mint py-6 sm:py-10">
        <Doodle kind="bookmark" className="right-[5%] top-6 w-8 sm:w-10" color="var(--brand)" fill="var(--butter)" rotate={12} animation="wiggle" />
        <Doodle kind="sparkle" className="left-[3%] top-10 w-6 sm:w-8" color="var(--brand)" fill="#fff" animation="twinkle" delay={500} />
        <Doodle kind="circle" className="bottom-6 left-[42%] hidden w-14 sm:block" color="var(--brand)" animation="drift" />
        <BookShelves />
      </div>
      <WaveDivider color="var(--mint)" flip />

      {/* Ways to share on cream */}
      <div className="relative py-12 sm:py-16">
        <Doodle kind="leaf" className="left-[2%] top-6 w-10 sm:w-12" color="var(--brand)" fill="var(--mint)" rotate={-20} animation="drift" />
        <Doodle kind="heart" className="right-[3%] top-10 w-7" color="#d1607a" fill="var(--rose)" animation="float" delay={600} />
        <Doodle kind="sparkle" className="bottom-4 right-[30%] hidden w-6 sm:block" color="var(--accent)" fill="var(--peach)" animation="twinkle" />
        <WaysToShare />
      </div>

      {/* How it works on lavender */}
      <WaveDivider color="var(--lavender)" />
      <div className="relative bg-lavender py-6 sm:py-10">
        <Doodle kind="plane" className="right-[6%] top-8 w-12 sm:w-16" color="#6c5ccf" fill="#fff" rotate={-6} animation="drift" />
        <Doodle kind="star" className="bottom-10 left-[3%] w-7 sm:w-9" color="#6c5ccf" fill="var(--butter)" animation="twinkle" delay={300} />
        <Doodle kind="squiggle" className="bottom-6 right-[20%] hidden w-20 md:block" color="#6c5ccf" animation="drift" delay={900} />
        <HowItWorks />
      </div>
      <WaveDivider color="var(--lavender)" flip />

      <div className="relative">
        <Doodle kind="book" className="left-[6%] top-4 hidden w-12 md:block" color="var(--accent)" fill="var(--peach)" rotate={10} />
        <Doodle kind="sparkle" className="right-[8%] top-6 w-8" color="var(--brand)" fill="var(--mint)" animation="twinkle" />
        <FinalCta />
      </div>
    </div>
  );
}
