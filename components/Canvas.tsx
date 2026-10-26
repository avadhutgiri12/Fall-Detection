"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Card, CardContent } from "./ui/Card";
import { Button } from "./ui/Button";
import { SectionWrapper, SectionHeader } from "./ui/Section";
import { Container } from "./ui/Container";
import { WebcamDetector } from "./ui/WebcamDetector";
import { VideoUploadDetector } from "./ui/VideoUploadDetector";
import { canvasContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

// Use environment variables for backend URLs (with localhost fallbacks for dev)
const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const WS_URL = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000";

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
    "file-video": (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <path d="M23 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polygon points="23 7 16 12 23 17 23 7" />
        <rect x="1" y="1" width="14" height="10" rx="2" />
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
  };

  return (
    <div className={`w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary ${className}`} aria-hidden="true">
      {icons[name] || icons.cpu}
    </div>
  );
}

export function Canvas() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState<"webcam" | "upload" | "features">("features");

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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const handleFallDetected = (score: number) => {
    // Could show a toast notification here
    console.log("[Canvas] Fall detected with score:", score);
  };

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
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z' fill='%232D6A4F' fill-opacity='0.03'/%3E%3C/g%3E%3C/svg%3E")`,
        }} />
      </div>

      <div className="relative z-10">
        <div className="max-w-3xl mx-auto text-center mb-12">
          <SectionHeader
            className="section-header"
            title={canvasContent.title}
            subtitle={canvasContent.subtitle}
            align="center"
          />
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center gap-2 mb-8" role="tablist" aria-label="Demo modes">
          <button
            role="tab"
            aria-selected={activeTab === "features"}
            onClick={() => setActiveTab("features")}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === "features"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-primary/5"
            }`}
          >
            Overview
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "webcam"}
            onClick={() => setActiveTab("webcam")}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === "webcam"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-primary/5"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <circle cx="12" cy="13" r="4" />
              </svg>
              Live Camera
            </span>
          </button>
          <button
            role="tab"
            aria-selected={activeTab === "upload"}
            onClick={() => setActiveTab("upload")}
            className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
              activeTab === "upload"
                ? "bg-primary text-primary-foreground shadow-lg"
                : "bg-background text-muted-foreground hover:text-foreground hover:bg-primary/5"
            }`}
          >
            <span className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              Video Upload
            </span>
          </button>
        </div>

        {/* Tab Panels */}
        <div className="canvas-area">
          {/* Features Overview Tab */}
          {activeTab === "features" && (
            <div role="tabpanel" aria-label="Features overview">
              {/* Interactive Canvas Area Placeholder */}
              <div className="relative mb-16" aria-hidden="true">
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
                      <h3 className="text-lg font-semibold text-foreground mb-2">Interactive Demos</h3>
                      <p className="text-muted-foreground max-w-md mx-auto">
                        Select "Live Camera" or "Video Upload" tabs above to experience real-time fall detection powered by YOLOv8 pose estimation.
                      </p>
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
                <Button variant="fancy" size="lg" onClick={() => setActiveTab("webcam")}>
                  {canvasContent.cta.primary}
                </Button>
                <Button variant="outline" size="lg" onClick={() => setActiveTab("upload")}>
                  {canvasContent.cta.secondary}
                </Button>
              </div>
            </div>
          )}

          {/* Live Webcam Tab */}
          {activeTab === "webcam" && (
            <div role="tabpanel" aria-label="Live camera detection">
              <WebcamDetector
                wsUrl={`${WS_URL}/ws/detect`}
                apiUrl={API_URL}
                initialConfThreshold={0.6}
                onFallDetected={handleFallDetected}
              />
            </div>
          )}

          {/* Video Upload Tab */}
          {activeTab === "upload" && (
            <div role="tabpanel" aria-label="Video upload analysis">
              <VideoUploadDetector
                apiUrl={API_URL}
                initialConfThreshold={0.6}
              />
            </div>
          )}
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
      </div>
    </SectionWrapper>
  );
}

export default Canvas;