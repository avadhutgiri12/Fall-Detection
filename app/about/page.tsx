import { Metadata } from "next";
import { About } from "@/components/About";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "About CareSight AI | Camera-Based Fall Detection Technology",
  description: "Learn about CareSight AI's mission, technology, and commitment to protecting independence through innovative camera-based fall detection solutions powered by YOLOv8.",
};

export default function AboutPage() {
  return (
    <>
      <About />
      <Footer />
    </>
  );
}