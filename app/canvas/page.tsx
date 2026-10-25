import { Metadata } from "next";
import { Canvas } from "@/components/Canvas";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Live Demo | CareSight AI Camera Fall Detection",
  description: "Experience CareSight AI's camera-based fall detection through live webcam detection, video upload analysis, and YOLOv8 pose estimation demos.",
};

export default function CanvasPage() {
  return (
    <>
      <Canvas />
      <Footer />
    </>
  );
}