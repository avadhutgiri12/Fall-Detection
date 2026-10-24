import { Metadata } from "next";
import { Canvas } from "@/components/Canvas";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Interactive Canvas | FallGuard Fall Detection Technology",
  description: "Explore FallGuard's AI-powered fall detection through interactive visualizations, real-time demos, and technical deep-dives.",
};

export default function CanvasPage() {
  return (
    <>
      <Canvas />
      <Footer />
    </>
  );
}