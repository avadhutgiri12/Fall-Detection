import { Metadata } from "next";
import { Contact } from "@/components/Contact";
import { Footer } from "@/components/Footer";

export const metadata: Metadata = {
  title: "Contact Us | FallGuard Fall Detection",
  description: "Get in touch with FallGuard for a personalized consultation. Our team is ready to help you protect your loved ones with advanced fall detection technology.",
};

export default function ContactPage() {
  return (
    <>
      <Contact />
      <Footer />
    </>
  );
}