// Fall Detection Application - Content Data
// All text content, titles, descriptions for the application

export const heroContent = {
  headline: "Advanced Fall Detection for Safer Living",
  subheadline: "AI-powered monitoring system that detects falls in real-time and alerts caregivers instantly. Peace of mind for families, independence for seniors.",
  ctaPrimary: "Try it yourself",
  ctaSecondary: "Learn More",
  trustIndicators: [
    "99.2% Detection Accuracy",
    "< 3 Second Response Time",
    "HIPAA Compliant",
    "FDA Cleared"
  ]
};

export const aboutContent = {
  title: "Why Choose FallGuard?",
  description: "FallGuard combines cutting-edge AI technology with compassionate care to create the most reliable fall detection system on the market.",
  features: [
    {
      icon: "shield",
      title: "Real-Time Monitoring",
      description: "24/7 continuous monitoring with edge AI processing for instant fall detection without cloud latency."
    },
    {
      icon: "users",
      title: "Caregiver Alerts",
      description: "Instant notifications via SMS, email, and app push notifications to multiple caregivers simultaneously."
    },
    {
      icon: "chart-bar",
      title: "Health Analytics",
      description: "Comprehensive dashboards tracking mobility patterns, fall risk trends, and activity levels over time."
    },
    {
      icon: "lock",
      title: "Privacy First",
      description: "End-to-end encryption with local processing option. No video recording, only skeletal pose estimation."
    },
    {
      icon: "wifi",
      title: "Easy Setup",
      description: "Plug-and-play sensors with automatic calibration. No technical expertise required for installation."
    },
    {
      icon: "battery",
      title: "Long Battery Life",
      description: "Up to 12 months battery life on sensors with low-battery alerts sent weeks in advance."
    }
  ]
};

export const howItWorksContent = {
  title: "How It Works",
  subtitle: "Simple setup, powerful protection in three easy steps",
  steps: [
    {
      number: "01",
      title: "Install Sensors",
      description: "Place discrete sensors in key areas - bedroom, bathroom, living room. No cameras, no wearables required.",
      image: "/images/step1-install.svg"
    },
    {
      number: "02",
      title: "AI Learns Patterns",
      description: "Our AI builds a personalized movement baseline for each user, learning normal activities vs. fall patterns.",
      image: "/images/step2-learn.svg"
    },
    {
      number: "03",
      title: "Instant Alerts",
      description: "When a fall is detected, caregivers receive immediate alerts with location, time, and severity assessment.",
      image: "/images/step3-alert.svg"
    }
  ]
};

export const contactContent = {
  title: "Get in Touch",
  subtitle: "Ready to protect your loved ones? Contact our team for a personalized consultation.",
  form: {
    nameLabel: "Full Name",
    namePlaceholder: "John Doe",
    emailLabel: "Email Address",
    emailPlaceholder: "john@example.com",
    phoneLabel: "Phone Number",
    phonePlaceholder: "+1 (555) 000-0000",
    messageLabel: "Message",
    messagePlaceholder: "Tell us about your needs...",
    submitButton: "Send Message",
    successMessage: "Thank you! We'll be in touch within 24 hours.",
    errorMessage: "Something went wrong. Please try again."
  },
  contactInfo: [
    {
      icon: "mail",
      label: "Email",
      value: "support@fallguard.com",
      link: "mailto:support@fallguard.com"
    },
    {
      icon: "phone",
      label: "Phone",
      value: "+1 (800) 555-0199",
      link: "tel:+18005550199"
    },
    {
      icon: "map-pin",
      label: "Address",
      value: "123 Health Tech Ave, San Francisco, CA 94105",
      link: "https://maps.google.com"
    },
    {
      icon: "clock",
      label: "Hours",
      value: "Mon-Fri 9am-6pm EST",
      link: null
    }
  ]
};

export const footerContent = {
  companyName: "FallGuard",
  tagline: "Protecting independence through innovation",
  navigation: {
    product: [
      { label: "Features", href: "#features" },
      { label: "Pricing", href: "#pricing" },
      { label: "How It Works", href: "#how-it-works" },
      { label: "FAQ", href: "#faq" }
    ],
    company: [
      { label: "About Us", href: "#about" },
      { label: "Careers", href: "#careers" },
      { label: "Blog", href: "#blog" },
      { label: "Press", href: "#press" }
    ],
    support: [
      { label: "Help Center", href: "#help" },
      { label: "Contact", href: "#contact" },
      { label: "Privacy Policy", href: "#privacy" },
      { label: "Terms of Service", href: "#terms" }
    ]
  },
  socialLinks: [
    { platform: "twitter", href: "https://twitter.com/fallguard", label: "Twitter" },
    { platform: "linkedin", href: "https://linkedin.com/company/fallguard", label: "LinkedIn" },
    { platform: "facebook", href: "https://facebook.com/fallguard", label: "Facebook" },
    { platform: "instagram", href: "https://instagram.com/fallguard", label: "Instagram" }
  ],
  copyright: "© 2025 FallGuard. All rights reserved."
};

export const uiContent = {
  button: {
    primary: "Get Started",
    secondary: "Learn More",
    outline: "Contact Sales",
    loading: "Please wait...",
    submit: "Submit"
  },
  card: {
    readMore: "Read More",
    viewDemo: "View Demo"
  },
  form: {
    required: "This field is required",
    invalidEmail: "Please enter a valid email",
    invalidPhone: "Please enter a valid phone number"
  }
};

export const canvasContent = {
  title: "Interactive Canvas",
  subtitle: "Explore FallGuard's technology through interactive visualizations and real-time demonstrations",
  features: [
    {
      icon: "cpu",
      title: "AI Detection Engine",
      description: "Watch our neural network process movement data in real-time, distinguishing falls from daily activities with 99.2% accuracy.",
      demoType: "neural-network"
    },
    {
      icon: "activity",
      title: "Movement Heatmap",
      description: "Visualize daily activity patterns and fall risk zones throughout the home with interactive 3D mapping.",
      demoType: "heatmap"
    },
    {
      icon: "zap",
      title: "Alert Response Timeline",
      description: "Experience the sub-3-second journey from fall detection to caregiver notification across multiple channels.",
      demoType: "timeline"
    },
    {
      icon: "shield-check",
      title: "Privacy Architecture",
      description: "Explore our edge-computing architecture that processes all data locally - no video leaves the device.",
      demoType: "privacy"
    }
  ],
  cta: {
    primary: "Launch Live Demo",
    secondary: "View Documentation"
  }
};