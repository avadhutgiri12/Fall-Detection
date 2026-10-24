import { Metadata } from "next";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "About FallGuard | Advanced Fall Detection Technology",
  description: "Learn about FallGuard's mission, technology, and commitment to protecting independence through innovative fall detection solutions.",
};

export default function AboutPage() {
  return (
    <>
      <About />
      <Footer />
    </>
  );
}