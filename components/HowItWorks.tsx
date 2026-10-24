"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { SectionWrapper, SectionHeader } from "./ui/Section";
import { howItWorksContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

interface StepIconProps {
  step: number;
  className?: string;
}

function StepIcon({ step, className = "" }: StepIconProps) {
  const icons: React.ReactNode[] = [
    (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 2a8 8 0 0 1 8 8v8a2 2 0 0 1-2 2h-2.5" />
        <path d="M8 14v8" />
        <path d="M12 14v8" />
        <path d="M16 14v8" />
        <path d="M2 22h20" />
        <path d="M2 18h20" />
      </svg>
    ),
    (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
  ];

  return (
    <div className={`w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-primary ${className}`} aria-hidden="true">
      {icons[step - 1] || icons[0]}
    </div>
  );
}

export function HowItWorks() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      if (!section) return;

      // Animate section header
      const header = section.querySelector(".section-header");
      if (header) {
        gsap.fromTo(header,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "expo.out",
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Animate step cards
      const stepCards = section.querySelectorAll(".step-card");
      if (stepCards.length > 0) {
        gsap.fromTo(stepCards,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            stagger: 0.15,
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Animate connector lines
      const connectors = section.querySelectorAll(".step-connector");
      if (connectors.length > 0) {
        gsap.fromTo(connectors,
          { scaleX: 0, transformOrigin: "left center" },
          {
            scaleX: 1,
            duration: 0.8,
            ease: "expo.out",
            stagger: 0.2,
            scrollTrigger: {
              trigger: section,
              start: "top 70%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <SectionWrapper
      ref={sectionRef}
      id="how-it-works"
      variant="default"
      size="lg"
      className="relative"
    >
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <SectionHeader
            className="section-header"
            title={howItWorksContent.title}
            subtitle={howItWorksContent.subtitle}
            align="center"
          />
        </div>

        <div className="relative">
          {/* Connector line between steps */}
          <div className="hidden lg:block absolute top-20 left-1/2 -translate-x-1/2 w-px h-[calc(100%-10rem)] bg-gradient-to-b from-primary/20 via-primary/40 to-primary/20" aria-hidden="true" />

          <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
            {howItWorksContent.steps.map((step, index) => (
              <div key={step.number} className="relative">
                {/* Step number indicator */}
                <div className="absolute left-1/2 -translate-x-1/2 top-0 z-10">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shadow-lg">
                    {step.number}
                  </div>
                </div>

                <Card className="step-card text-center p-8 relative z-10">
                  <CardContent>
                    <StepIcon step={index + 1} className="mx-auto mb-6" />
                    <h3 className="text-lg font-semibold text-foreground mb-3">
                      {step.title}
                    </h3>
                    <p className="text-muted-foreground mb-6">
                      {step.description}
                    </p>
                    {/* Step illustration placeholder */}
                    <div className="aspect-video bg-muted rounded-xl flex items-center justify-center overflow-hidden">
                      <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground/50" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
                        <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </CardContent>
                </Card>

                {/* Connector line between cards (mobile) */}
                {index < howItWorksContent.steps.length - 1 && (
                  <div className="step-connector lg:hidden absolute bottom-[-2rem] left-1/2 -translate-x-1/2 w-px h-8 bg-gradient-to-b from-primary/20 via-primary/40 to-primary/20" aria-hidden="true" />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 text-center">
          <Button variant="outline" size="lg" rightIcon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          }>
            View Detailed Setup Guide
          </Button>
        </div>
      </div>
    </SectionWrapper>
  );
}