import Hero from "@/components/sections/Hero";
import AboutCompany from "@/components/sections/AboutCompany";
import WhyChooseUs from "@/components/sections/WhyChooseUs";
import PracticeHighlight from "@/components/sections/PracticeHighlight";
import ReviewsPreview from "@/components/sections/ReviewsPreview";
import FAQPreview from "@/components/sections/FAQPreview";
import ContactCTA from "@/components/sections/ContactCTA";

export default function HomePage() {
  return (
    <>
      <Hero />
      <AboutCompany />
      <WhyChooseUs />
      <PracticeHighlight />
      <ReviewsPreview />
      <FAQPreview />
      <ContactCTA />
    </>
  );
}