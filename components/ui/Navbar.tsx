"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "./Logo";

if (typeof window !== "undefined") {
  // ScrollTrigger not needed for page-based navigation
}

interface NavItem {
  label: string;
  href: string;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "About", href: "/about" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Contact", href: "/contact" },
  { label: "Canvas", href: "/canvas" },
];

export function Navbar() {
  const navRef = useRef<HTMLElement>(null);
  const itemsRef = useRef<(HTMLAnchorElement | null)[]>([]);
  const pathname = usePathname();

  const [activePath, setActivePath] = useState("/");
  const [isScrolled, setIsScrolled] = useState(false);
  const [prevActivePath, setPrevActivePath] = useState("/");

  // GSAP entrance animation
  useEffect(() => {
    const nav = navRef.current;

    if (!nav) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        nav,
        {
          y: -35,
          opacity: 0,
          scale: 0.96,
        },
        {
          y: 0,
          opacity: 1,
          scale: 1,
          duration: 0.8,
          ease: "power3.out",
        }
      );

      gsap.fromTo(
        itemsRef.current.filter(Boolean),
        {
          y: -10,
          opacity: 0,
        },
        {
          y: 0,
          opacity: 1,
          duration: 0.5,
          stagger: 0.08,
          delay: 0.15,
          ease: "power2.out",
        }
      );
    }, nav);

    return () => ctx.revert();

  }, []);

  // Track scroll for background change
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };

    handleScroll();

    window.addEventListener("scroll", handleScroll, {
      passive: true,
    });

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Track active path from pathname
  useEffect(() => {
    setActivePath(pathname);
  }, [pathname]);

  // Smooth active state transition with GSAP
  useEffect(() => {
    if (activePath !== prevActivePath) {
      const prevIndex = navItems.findIndex(item => item.href === prevActivePath);
      const nextIndex = navItems.findIndex(item => item.href === activePath);

      const prevEl = itemsRef.current[prevIndex];
      const nextEl = itemsRef.current[nextIndex];

      const tl = gsap.timeline();

      // Animate out previous active item
      if (prevEl) {
        tl.to(prevEl, {
          scale: 0.92,
          backgroundColor: "rgba(255,255,255,0.06)",
          color: "#ffffff",
          duration: 0.25,
          ease: "power2.inOut",
        }, 0);
      }

      // Animate in new active item
      if (nextEl) {
        tl.to(nextEl, {
          scale: 1.02,
          backgroundColor: "#f9e3ac",
          color: "#0c3f29",
          duration: 0.35,
          ease: "elastic.out(1, 0.6)",
        }, 0.05)
        .to(nextEl, {
          scale: 1,
          duration: 0.3,
          ease: "power2.out",
        }, 0.3);
      }

      setPrevActivePath(activePath);
    }
  }, [activePath]);

  return (
    <header className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4">
      <Logo size="md" className="flex-shrink-0 mr-4" />
      <nav
        ref={navRef}
        aria-label="Main navigation"
        className={`
          fixed
          flex
          w-full
          max-w-[850px]
          items-center
          rounded-full
          border
          h-15
          p-1
          transition-all
          duration-300
          ${
            isScrolled
              ? "border-[#f9e3ac]/20 bg-[#0c3f29]/95 shadow-[0_12px_35px_rgba(12,63,41,0.22)] backdrop-blur-xl"
              : "border-[#f9e3ac]/15 bg-[#0c3f29] shadow-[0_8px_28px_rgba(12,63,41,0.14)]"
          }
        `}
      >
        {/* Logo on the left */}

        {navItems.map((item, index) => {
          const isActive = activePath === item.href;

          return (
            <Link
              key={item.href}
              ref={(element) => {
                itemsRef.current[index] = element;
              }}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`
                relative
                flex
                min-h-[40px]
                min-w-fit
                flex-1
                items-center
                justify-center
                gap-2
                rounded-full
                px-8
                py-1.5
                text-center
                text-sm
                font-semibold
                tracking-tight
                transition-all
                duration-300
                ease-out
                sm:min-h-[44px]
                sm:px-8
                sm:text-base
                ${
                  isActive
                    ? "bg-[#f9e3ac] text-[#0c3f29] shadow-[0_3px_12px_rgba(0,0,0,0.08)]"
                    : "text-white hover:bg-white/10 hover:text-[#f9e3ac]"
                }
              `}
            >
              <span>{item.label}</span>

              {isActive && (
                <span
                  className="absolute inset-0 rounded-full ring-1 ring-inset ring-[#0c3f29]/[0.04]"
                  aria-hidden="true"
                />
              )}
            </Link>
          );
        })}

        {/* Subtle top highlight */}
        <div
          className="pointer-events-none absolute inset-x-4 top-1 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent"
          aria-hidden="true"
        />
      </nav>
    </header>
  );
}

export default Navbar;