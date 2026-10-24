"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "./ui/Button";
import { Container } from "./ui/Container";
import { heroContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

export function Hero() {
  const heroRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subheadlineRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const trustRef = useRef<HTMLDivElement>(null);
  const illustrationRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "expo.out" } });

      tl.fromTo(headlineRef.current,
        { y: "100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 1.2 }, 0
      )
      .fromTo(subheadlineRef.current,
        { y: "100%", opacity: 0 },
        { y: "0%", opacity: 1, duration: 1.2 }, 0.15
      )
      .fromTo(ctaRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 }, 0.3
      )
      .fromTo(trustRef.current,
        { y: 40, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.8 }, 0.45
      )
      .fromTo(illustrationRef.current,
        { scale: 0.9, opacity: 0 },
        { scale: 1, opacity: 1, duration: 1.2, ease: "back.out(1.5)" }, 0.2
      );

      // Floating animation for illustration
      gsap.to(illustrationRef.current, {
        y: -20,
        duration: 3,
        ease: "sine.inOut",
        yoyo: true,
        repeat: -1,
      });
    }, heroRef);

    return () => ctx.revert();
  }, []);

  // Background pattern as inline style to avoid Tailwind parsing issues
  const bgPatternStyle: React.CSSProperties = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%232D6A4F' fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E")`,
  };

  return (
    <section
      ref={heroRef}
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
      aria-labelledby="hero-headline"
    >
      {/* Background pattern */}
      <div className="absolute inset-0" aria-hidden="true">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-transparent opacity-10" />
        <div className="absolute inset-0 opacity-5" style={bgPatternStyle} />
      </div>

      <div className="relative z-10 w-full">
        <Container>
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Content */}
          <div className="text-center lg:text-left">
            <h1
              ref={headlineRef}
              id="hero-headline"
              className="text-4xl md:text-5xl lg:text-6xl font-bold text-foreground leading-tight tracking-tight"
            >
              {heroContent.headline}
            </h1>
            <p
              ref={subheadlineRef}
              className="mt-6 text-base text-muted-foreground max-w-xl mx-auto lg:mx-0"
            >
              {heroContent.subheadline}
            </p>

            <div ref={ctaRef} className="mt-10 flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Button variant="fancy" size="md" className="w-full sm:w-auto">
                {heroContent.ctaPrimary}
              </Button>
              <Button variant="outline" size="md" className="w-full sm:w-auto">
                {heroContent.ctaSecondary}
              </Button>
            </div>

            <div ref={trustRef} className="mt-12 flex flex-wrap items-center justify-center lg:justify-start gap-6 text-sm text-muted-foreground">
              {heroContent.trustIndicators.map((indicator, index) => (
                <span key={index} className="flex items-center gap-2">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary" aria-hidden="true">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  {indicator}
                </span>
              ))}
            </div>
          </div>

          {/* Illustration */}
          <div ref={illustrationRef} className="relative" aria-hidden="true">
            <div className="relative aspect-square max-w-md mx-auto">
              {/* Main illustration container */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative w-full h-full max-w-96 max-h-96">
                  {/* Decorative circles */}
                  <div className="absolute -inset-8 border-2 border-primary/10 rounded-full" />
                  <div className="absolute -inset-16 border-2 border-primary/5 rounded-full" />

                  {/* Central illustration */}
                  <div className="relative w-full h-full flex items-center justify-center">
                    <svg
                      viewBox="0 0 400 400"
                      className="w-full h-full text-primary"
                      aria-hidden="true"
                    >
                      <defs>
                        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                          <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                          <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                          </feMerge>
                        </filter>
                      </defs>

                      {/* Shield icon representing protection */}
                      <g filter="url(#glow)">
                        <path
                          d="M200 50 C280 50 320 100 320 180 C320 280 200 350 200 350 C200 350 80 280 80 180 C80 100 120 50 200 50 Z"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3"
                          opacity="0.3"
                        />
                        <path
                          d="M200 80 C250 80 285 115 285 170 C285 240 200 300 200 300 C200 300 115 240 115 170 C115 115 150 80 200 80 Z"
                          fill="currentColor"
                          opacity="0.2"
                        />
                        <path
                          d="M200 120 L200 220 M160 170 L240 170"
                          stroke="currentColor"
                          strokeWidth="4"
                          strokeLinecap="round"
                          opacity="0.6"
                        />
                      </g>

                      {/* Pulse rings */}
                      <g className="pulse-rings">
                        <circle cx="200" cy="200" r="140" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.15">
                          <animate attributeName="r" values="100;140" dur="3s" repeatCount="indefinite" />
                          <animate attributeName="opacity" values="0.2;0" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <circle cx="200" cy="200" r="160" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.1">
                          <animate attributeName="r" values="120;160" dur="3s" repeatCount="indefinite" begin="1.5s" />
                          <animate attributeName="opacity" values="0.15;0" dur="3s" repeatCount="indefinite" begin="1.5s" />
                        </circle>
                      </g>
                    </svg>
                  </div>
                </div>
              </div>

              {/* Floating stat badges */}
              <div className="absolute -top-4 -right-4 md:-top-6 md:-right-6 animate-float">
                <div className="bg-card border border-border rounded-xl p-4 shadow-xl min-w-45">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-primary">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">99.2%</p>
                      <p className="text-xs text-muted-foreground">Detection Accuracy</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="absolute bottom-4 -left-4 md:bottom-6 md:-left-6 animate-float" style={{ animationDelay: "1.5s" }}>
                <div className="bg-card border border-border rounded-xl p-4 shadow-xl min-w-45">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg bg-secondary/20 flex items-center justify-center">
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-secondary">
                        <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground">3s</p>
                      <p className="text-xs text-muted-foreground">Response Time</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        </Container>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" aria-hidden="true">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-muted-foreground">
            <path d="M12 5v14M19 12l-7 7-7-7" />
          </svg>
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
    </section>
  );
}