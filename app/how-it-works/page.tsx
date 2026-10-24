import { Metadata } from "next";
import { HowItWorks } from "@/components/HowItWorks";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "How It Works | FallGuard Fall Detection System",
  description: "Discover how FallGuard's AI-powered fall detection works in three simple steps: install sensors, AI learns patterns, and receive instant alerts.",
};

export default function HowItWorksPage() {
  return (
    <>
      <HowItWorks />
      <Footer />
    </>
  );
}