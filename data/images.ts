// Fall Detection Application - Image Data
// All image paths, alt texts, and image configurations

export const images = {
  hero: {
    background: "/images/hero-background.jpg",
    illustration: "/images/hero-illustration.svg",
    alt: "Fall detection system monitoring a senior living independently",
    fallback: "/images/hero-fallback.jpg"
  },
  about: {
    main: "/images/about-main.jpg",
    alt: "Senior using fall detection system in home environment",
    featureIcons: {
      shield: "/icons/shield.svg",
      users: "/icons/users.svg",
      chartBar: "/icons/chart-bar.svg",
      lock: "/icons/lock.svg",
      wifi: "/icons/wifi.svg",
      battery: "/icons/battery.svg"
    }
  },
  howItWorks: {
    step1: "/images/step1-install.svg",
    step1Alt: "Installing discrete sensors in home",
    step2: "/images/step2-learn.svg",
    step2Alt: "AI learning movement patterns",
    step3: "/images/step3-alert.svg",
    step3Alt: "Caregiver receiving instant alert on phone",
    connectorLine: "/images/connector-line.svg"
  },
  contact: {
    illustration: "/images/contact-illustration.svg",
    alt: "Customer support team ready to help",
    mapPlaceholder: "/images/map-placeholder.jpg"
  },
  footer: {
    logo: "/images/logo.svg",
    logoAlt: "FallGuard Logo",
    logoWhite: "/images/logo-white.svg"
  },
  ui: {
    buttonArrow: "/icons/arrow-right.svg",
    cardArrow: "/icons/arrow-up-right.svg",
    closeIcon: "/icons/x.svg",
    menuIcon: "/icons/menu.svg",
    checkIcon: "/icons/check.svg",
    errorIcon: "/icons/alert-circle.svg"
  },
  trust: {
    hipaa: "/badges/hipaa-compliant.svg",
    fda: "/badges/fda-cleared.svg",
    hipaaAlt: "HIPAA Compliant",
    fdaAlt: "FDA Cleared"
  }
};

export const imageConfig = {
  hero: {
    priority: true,
    quality: 90,
    sizes: "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
  },
  about: {
    priority: false,
    quality: 85,
    sizes: "(max-width: 768px) 100vw, 50vw"
  },
  howItWorks: {
    priority: false,
    quality: 85,
    sizes: "(max-width: 768px) 100vw, 33vw"
  },
  placeholder: {
    blur: 20,
    backgroundColor: "#fae3ac"
  }
};