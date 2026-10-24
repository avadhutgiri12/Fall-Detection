"use client";

import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "./ui/Button";
import { SectionWrapper } from "./ui/Section";
import { footerContent } from "../data/content";

gsap.registerPlugin(ScrollTrigger);

interface SocialIconProps {
  platform: string;
  href: string;
  label: string;
}

function SocialIcon({ platform, href, label }: SocialIconProps) {
  const icons: Record<string, React.ReactNode> = {
    twitter: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M23 3a10.9 10.9 0 0 1-3.14 1.53 4.48 4.48 0 0 0-7.86 3v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z" />
      </svg>
    ),
    linkedin: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
        <rect x="2" y="9" width="4" height="12" />
        <circle cx="4" cy="4" r="2" />
      </svg>
    ),
    facebook: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
      </svg>
    ),
    instagram: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
        <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
        <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
      </svg>
    ),
  };

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
    >
      {icons[platform]}
    </a>
  );
}

function NavColumn({ title, links, className = "" }: { title: string; links: Array<{ label: string; href: string }>; className?: string }) {
  return (
    <div className={className}>
      <h4 className="font-semibold text-foreground mb-4">{title}</h4>
      <ul className="space-y-3" role="list">
        {links.map((link) => (
          <li key={link.label}>
            <a
              href={link.href}
              className="text-muted-foreground hover:text-primary transition-colors text-sm"
            >
              {link.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  const footerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const footer = footerRef.current;
      if (!footer) return;

      const sections = footer.querySelectorAll(".footer-section");
      if (sections.length > 0) {
        gsap.fromTo(sections,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            ease: "expo.out",
            stagger: 0.1,
            scrollTrigger: {
              trigger: footer,
              start: "top 90%",
              toggleActions: "play none none reverse",
            }
          }
        );
      }
    }, footerRef);

    return () => ctx.revert();
  }, []);

  return (
    <footer ref={footerRef} className="bg-muted/50 border-t border-border" role="contentinfo">
      <SectionWrapper as="div" size="lg" className="relative z-10">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-8 md:gap-12 mb-16">
          {/* Brand column */}
          <div className="col-span-2 lg:col-span-1 footer-section">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-primary-foreground">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  <path d="M12 12v4M12 16h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <span className="text-xl font-bold text-foreground">{footerContent.companyName}</span>
            </div>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {footerContent.tagline}
            </p>
            <div className="flex gap-3" role="list" aria-label="Social media links">
              {footerContent.socialLinks.map((social) => (
                <SocialIcon key={social.platform} {...social} />
              ))}
            </div>
          </div>

          {/* Navigation columns */}
          <NavColumn
            title="Product"
            links={footerContent.navigation.product}
            className="footer-section"
          />
          <NavColumn
            title="Company"
            links={footerContent.navigation.company}
            className="footer-section"
          />
          <NavColumn
            title="Support"
            links={footerContent.navigation.support}
            className="footer-section"
          />
        </div>

        {/* Divider */}
        <div className="border-t border-border mb-8" aria-hidden="true" />

        {/* Bottom bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground text-center md:text-left">
            {footerContent.copyright}
          </p>

          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#privacy" className="hover:text-primary transition-colors">
              Privacy Policy
            </a>
            <a href="#terms" className="hover:text-primary transition-colors">
              Terms of Service
            </a>
            <a href="#cookies" className="hover:text-primary transition-colors">
              Cookie Policy
            </a>
          </div>

          <Button variant="ghost" size="sm" className="md:hidden">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path d="M18 15l-6-6-6 6" />
            </svg>
            Back to top
          </Button>
        </div>
      </SectionWrapper>
    </footer>
  );
}