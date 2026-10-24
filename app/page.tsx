"use client";

import { Hero, About, HowItWorks, Contact, Footer } from "@/components";
import { Navbar } from "@/components/ui/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main id="main-content" className="flex-1 pb-24">
        <Hero />
        <About />
        <HowItWorks />
        <Contact />
      </main>
      <Footer />
    </>
  );
}