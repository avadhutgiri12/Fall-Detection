// Fall Detection Application - Animation Configurations
// GSAP ScrollTrigger and animation presets

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// Animation durations
export const durations = {
  fast: 0.3,
  normal: 0.6,
  slow: 1.0,
  entrance: 1.2
};

// Easing functions
export const easings = {
  smooth: "power2.out",
  smoothIn: "power2.in",
  smoothInOut: "power2.inOut",
  bounce: "back.out(1.5)",
  elastic: "elastic.out(1, 0.5)",
  expo: "expo.out",
  circ: "circ.out"
};

// Stagger configurations
export const staggers = {
  tight: 0.05,
  normal: 0.1,
  loose: 0.15,
  section: 0.2
};

// ScrollTrigger default configuration
export const scrollTriggerDefaults = {
  toggleActions: "play none none reverse",
  start: "top 80%",
  end: "bottom 20%",
  markers: false
};

// Animation presets
export const animationPresets = {
  // Fade up from bottom
  fadeUp: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        ...options
      }
    );
  },

  // Fade down from top
  fadeDown: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { y: -60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        ...options
      }
    );
  },

  // Slide in from left
  slideFromLeft: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { x: -80, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        ...options
      }
    );
  },

  // Slide in from right
  slideFromRight: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { x: 80, opacity: 0 },
      {
        x: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        ...options
      }
    );
  },

  // Scale up from center
  scaleUp: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { scale: 0.8, opacity: 0 },
      {
        scale: 1,
        opacity: 1,
        duration: durations.normal,
        ease: easings.bounce,
        ...options
      }
    );
  },

  // Staggered children animation
  staggerChildren: (container: string | Element, selector: string = "> *", options: gsap.TweenVars = {}) => {
    return gsap.fromTo(`${container} ${selector}`,
      { y: 40, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        stagger: staggers.normal,
        ...options
      }
    );
  },

  // Text reveal (line by line)
  textReveal: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { y: "100%", opacity: 0 },
      {
        y: "0%",
        opacity: 1,
        duration: durations.entrance,
        ease: easings.expo,
        ...options
      }
    );
  },

  // Clip path reveal
  clipReveal: (element: string | Element, options: gsap.TweenVars = {}) => {
    return gsap.fromTo(element,
      { clipPath: "inset(0 100% 0 0)" },
      {
        clipPath: "inset(0 0% 0 0)",
        duration: durations.entrance,
        ease: easings.expo,
        ...options
      }
    );
  }
};

// Scroll-triggered animations
export const scrollAnimations = {
  // Basic fade up on scroll
  fadeUpOnScroll: (element: string | Element, options: Record<string, any> = {}) => {
    return gsap.fromTo(element,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        scrollTrigger: {
          trigger: element,
          ...scrollTriggerDefaults,
          ...options
        }
      }
    );
  },

  // Staggered cards on scroll
  staggerCardsOnScroll: (container: string | Element, selector: string = "> *", options: Record<string, any> = {}) => {
    return gsap.fromTo(`${container} ${selector}`,
      { y: 60, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: durations.normal,
        ease: easings.smooth,
        stagger: staggers.normal,
        scrollTrigger: {
          trigger: container,
          ...scrollTriggerDefaults,
          ...options
        }
      }
    );
  },

  // Parallax effect
  parallax: (element: string | Element, speed: number = 0.5, options: Record<string, any> = {}) => {
    return gsap.to(element, {
      yPercent: -50 * speed,
      ease: "none",
      scrollTrigger: {
        trigger: element,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
        ...options
      }
    });
  },

  // Pin section
  pinSection: (element: string | Element, options: Record<string, any> = {}) => {
    return ScrollTrigger.create({
      trigger: element,
      pin: true,
      start: "top top",
      end: "+=500%",
      pinSpacing: true,
      ...options
    });
  },

  // Horizontal scroll
  horizontalScroll: (container: string | Element, options: Record<string, any> = {}) => {
    const elements = gsap.utils.toArray(`${container} > *`);
    return gsap.to(elements, {
      xPercent: -100 * (elements.length - 1),
      ease: "none",
      scrollTrigger: {
        trigger: container,
        pin: true,
        scrub: 1,
        end: `+=${elements.length * 100}%`,
        ...options
      }
    });
  }
};

// Hero entrance timeline
export const createHeroTimeline = () => {
  const tl = gsap.timeline({ defaults: { ease: easings.expo } });

  tl.fromTo(".hero-headline",
    { y: "100%", opacity: 0 },
    { y: "0%", opacity: 1, duration: durations.entrance }, 0
  )
  .fromTo(".hero-subheadline",
    { y: "100%", opacity: 0 },
    { y: "0%", opacity: 1, duration: durations.entrance }, 0.15
  )
  .fromTo(".hero-cta",
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: durations.normal }, 0.3
  )
  .fromTo(".hero-trust",
    { y: 40, opacity: 0 },
    { y: 0, opacity: 1, duration: durations.normal }, 0.45
  )
  .fromTo(".hero-illustration",
    { scale: 0.9, opacity: 0 },
    { scale: 1, opacity: 1, duration: durations.entrance, ease: easings.bounce }, 0.2
  );

  return tl;
};

// Section entrance animation
export const createSectionEntrance = (sectionRef: React.RefObject<HTMLElement>) => {
  if (!sectionRef.current) return;

  const ctx = gsap.context(() => {
    const elements = sectionRef.current?.querySelectorAll("[data-animate]");
    if (!elements) return;

    elements.forEach((el, index) => {
      const animationType = el.getAttribute("data-animate") || "fadeUp";
      const delay = parseFloat(el.getAttribute("data-delay") || "0") + (index * staggers.tight);

      let animation: gsap.TweenVars = {
        scrollTrigger: {
          trigger: el,
          ...scrollTriggerDefaults
        }
      };

      switch (animationType) {
        case "fadeUp":
          animation = { ...animation, ...{ y: 60, opacity: 0 }, y: 0, opacity: 1, duration: durations.normal, ease: easings.smooth, delay };
          break;
        case "fadeDown":
          animation = { ...animation, ...{ y: -60, opacity: 0 }, y: 0, opacity: 1, duration: durations.normal, ease: easings.smooth, delay };
          break;
        case "slideLeft":
          animation = { ...animation, ...{ x: -80, opacity: 0 }, x: 0, opacity: 1, duration: durations.normal, ease: easings.smooth, delay };
          break;
        case "slideRight":
          animation = { ...animation, ...{ x: 80, opacity: 0 }, x: 0, opacity: 1, duration: durations.normal, ease: easings.smooth, delay };
          break;
        case "scaleUp":
          animation = { ...animation, ...{ scale: 0.8, opacity: 0 }, scale: 1, opacity: 1, duration: durations.normal, ease: easings.bounce, delay };
          break;
        case "clipReveal":
          animation = { ...animation, ...{ clipPath: "inset(0 100% 0 0)" }, clipPath: "inset(0 0% 0 0)", duration: durations.entrance, ease: easings.expo, delay };
          break;
      }

      gsap.fromTo(el, { ...animation }, animation);
    });
  }, sectionRef);

  return () => ctx.revert();
};

// Reduced motion check
export const prefersReducedMotion = (): boolean => {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
};

// Initialize ScrollTrigger with reduced motion support
export const initScrollAnimations = () => {
  if (prefersReducedMotion()) {
    // Disable all scroll animations for reduced motion
    ScrollTrigger.getAll().forEach(trigger => trigger.kill());
    gsap.set("[data-animate]", { opacity: 1, y: 0, x: 0, scale: 1, clipPath: "inset(0 0% 0 0)" });
    return;
  }

  ScrollTrigger.refresh();
};

// Cleanup function
export const cleanupAnimations = () => {
  ScrollTrigger.getAll().forEach(trigger => trigger.kill());
  gsap.killTweensOf("*");
};