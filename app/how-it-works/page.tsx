import { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "How It Works | CareSight AI Camera Fall Detection",
  description: "Discover how CareSight AI's camera-based fall detection works in three simple steps: open Canvas, choose Live Camera or Video Upload, start detection, and get instant fall alerts.",
};

export default function HowItWorksPage() {
  return (
    <>
      <HowItWorks />
      <Footer />
    </>
  );
}