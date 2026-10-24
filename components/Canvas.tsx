"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { SectionWrapper, SectionHeader } from "./ui/Section";
import { Container } from "./ui/Container";
import { canvasContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

interface DemoIconProps {
  name: string;
  className?: string;
}

function DemoIcon({ name, className = "" }: DemoIconProps) {
  const icons: Record<string, React.ReactNode> = {
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
    activity: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    zap: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
    "shield-check": (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <path d="M9 12l2 2 4-4" />
      </svg>
    ),
  };

  return (
    <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ${className}`} aria-hidden="true">
      {icons[name] || icons.cpu}
    </div>
  );
}

export function Canvas() {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

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

      // Animate demo cards
      const demoCards = section.querySelectorAll(".demo-card");
      if (demoCards.length > 0) {
        gsap.fromTo(demoCards,
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

      // Animate CTA buttons
      const cta = section.querySelector(".canvas-cta");
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

      // Floating animation for canvas area
      const canvasArea = canvasRef.current;
      if (canvasArea) {
        gsap.to(canvasArea, {
          y: -15,
          duration: 4,
          ease: "sine.inOut",
          yoyo: true,
          repeat: -1,
        });
      }
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <SectionWrapper
      ref={sectionRef}
      id="canvas"
      variant="alternate"
      size="lg"
      className="relative"
    >
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-x-1/2 translate-y-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary/20 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%232D6A4F' fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-16">
          <SectionHeader
            className="section-header"
            title={canvasContent.title}
            subtitle={canvasContent.subtitle}
            align="center"
          />
        </div>

        {/* Interactive Canvas Area */}
        <div ref={canvasRef} className="relative mb-16" aria-hidden="true">
          <div className="aspect-video max-w-4xl mx-auto rounded-2xl overflow-hidden border border-border bg-gradient-to-br from-primary/5 via-background to-secondary/5">
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center p-8">
                <div className="w-24 h-24 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-primary" aria-hidden="true">
                    <rect x="2" y="2" width="20" height="20" rx="2" />
                    <path d="M8 12l4 4 8-8" />
                    <circle cx="12" cy="12" r="8" strokeDasharray="32" strokeDashoffset="32">
                      <animate attributeName="strokeDashoffset" from="32" to="0" dur="2s" repeatCount="indefinite" />
                    </circle>
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Live Demo Preview</h3>
                <p className="text-muted-foreground max-w-md mx-auto">Interactive visualizations coming soon. This area will showcase real-time AI detection, movement heatmaps, and alert timelines.</p>
              </div>
            </div>
            {/* Corner accents */}
            <div className="absolute top-4 left-4 w-16 h-16 border-2 border-primary/20 rounded-t-xl border-b-0 border-r-0" />
            <div className="absolute top-4 right-4 w-16 h-16 border-2 border-primary/20 rounded-tr-xl border-b-0 border-l-0" />
            <div className="absolute bottom-4 left-4 w-16 h-16 border-2 border-primary/20 rounded-bl-xl border-t-0 border-r-0" />
            <div className="absolute bottom-4 right-4 w-16 h-16 border-2 border-primary/20 rounded-br-xl border-t-0 border-l-0" />
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {canvasContent.features.map((feature, index) => (
            <Card
              key={feature.title}
              className="demo-card group"
              padding="lg"
              hover
            >
              <CardContent className="text-center">
                <DemoIcon name={feature.icon} className="mx-auto mb-4 group-hover:scale-110 transition-transform duration-300" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm mb-4">
                  {feature.description}
                </p>
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors">
                  Explore Demo
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="canvas-cta flex flex-col sm:flex-row gap-4 justify-center">
          <Button variant="fancy" size="lg">
            {canvasContent.cta.primary}
          </Button>
          <Button variant="outline" size="lg">
            {canvasContent.cta.secondary}
          </Button>
        </div>
      </div>

      <style jsx>{`
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </SectionWrapper>
  );
}

export default Canvas;