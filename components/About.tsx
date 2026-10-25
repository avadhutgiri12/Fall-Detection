"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { SectionWrapper, SectionHeader } from "./ui/Section";
import { aboutContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

interface FeatureIconProps {
  name: string;
  className?: string;
}

function FeatureIcon({ name, className = "" }: FeatureIconProps) {
  const icons: Record<string, React.ReactNode> = {
    shield: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    users: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
    "chart-bar": (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
    lock: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    ),
    wifi: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M5 12.55a11 11 0 0 1 14.08 0" />
        <path d="M1.42 9a16 16 0 0 1 21.16 0" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
    ),
    battery: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="23" y1="10" x2="23" y2="14" />
      </svg>
    ),
    cpu: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M9 9h6v6H9z" />
        <path d="M9 1h6v2H9z" />
        <path d="M9 21h6v2H9z" />
        <path d="M1 9h2v6H1z" />
        <path d="M21 9h2v6H21z" />
      </svg>
    ),
    bell: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
        <path d="M13.73 21a2 2 0 0 1-3.46 0" />
      </svg>
    ),
    sliders: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <line x1="4" y1="21" x2="4" y2="14" />
        <line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" />
        <line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" />
        <line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" />
        <line x1="9" y1="8" x2="15" y2="8" />
        <line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
    "file-video": (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M23 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="1" width="14" height="10" rx="2" />
      </svg>
    ),
    globe: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    ),
  };

  return (
    <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ${className}`} aria-hidden="true">
      {icons[name] || icons.shield}
    </div>
  );
}

export function About() {
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

      // Animate feature cards
      const featureCards = section.querySelectorAll(".feature-card");
      if (featureCards.length > 0) {
        gsap.fromTo(featureCards,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: section,
              start: "top 75%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }

      // Animate CTA button
      const cta = section.querySelector(".about-cta");
      if (cta) {
        gsap.fromTo(cta,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            delay: 0.3,
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
      id="about"
      variant="alternate"
      size="lg"
      className="relative"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <SectionHeader
            className="section-header"
            title={aboutContent.title}
            subtitle={aboutContent.description}
            align="center"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {aboutContent.features.map((feature, index) => (
            <Card
              key={feature.title}
              className="feature-card group"
              padding="lg"
              hover
            >
              <CardContent className="text-center">
                <FeatureIcon name={feature.icon} className="mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-16 text-center">
          <Link href="/about" className="inline-block">
            <Button
              className="about-cta w-full sm:w-auto"
              size="lg"
              rightIcon={
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              }
            >
              About Our Technology
            </Button>
          </Link>
        </div>
      </div>
    </SectionWrapper>
  );
}