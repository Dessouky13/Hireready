import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Marquee from "@/components/landing/Marquee";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Pricing from "@/components/landing/Pricing";
import CTABanner from "@/components/landing/CTABanner";
import Footer from "@/components/landing/Footer";
import SocialProofBar from "@/components/landing/SocialProofBar";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <SocialProofBar />
      <Hero />
      <Marquee />
      <HowItWorks />
      <Features />
      <Pricing />
      <CTABanner />
      <Footer />
    </div>
  );
};

export default Index;
