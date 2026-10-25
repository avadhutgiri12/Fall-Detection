import { Metadata } from "next";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Contact Us | CareSight AI",
  description: "Get in touch with CareSight AI for questions about camera-based fall detection. Our team is ready to help you with YOLOv8 pose estimation technology.",
};

export default function ContactPage() {
  return (
    <>
      <Contact />
      <Footer />
    </>
  );
}