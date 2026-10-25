// Fall Detection Application - Content Data
// All text content, titles, descriptions for the application
// Updated for Camera-based Fall Detection with YOLOv8 Pose Estimation

export const heroContent = {
  headline: "CareSight AI",
  subheadline: "Turn any webcam into an intelligent fall detection system. Powered by YOLOv8 pose estimation for instant, accurate fall alerts.",
  ctaPrimary: "Try Live Demo",
  ctaSecondary: "View Video Analysis",
  trustIndicators: [
    "YOLOv8 Pose Estimation",
    "< 100ms Inference",
    "Privacy-First Local Processing",
    "Open Source Model"
  ]
};

export const aboutContent = {
  title: "Why Choose Camera-Based Fall Detection?",
  description: "Our system transforms any webcam into a powerful fall detection tool using state-of-the-art YOLOv8 pose estimation. No wearables, no sensors—just your camera and AI.",
  features: [
    {
      icon: "cpu",
      title: "Real-Time Camera Monitoring",
      description: "Live webcam feed analysis with YOLOv8 pose estimation for instant fall detection at 10+ FPS."
    },
    {
      icon: "bell",
      title: "Instant Fall Alerts",
      description: "Email notifications with confidence scores sent immediately when a fall is detected."
    },
    {
      icon: "sliders",
      title: "Adjustable Sensitivity",
      description: "Configurable confidence threshold (0-1) to balance sensitivity vs. false positives."
    },
    {
      icon: "shield",
      title: "Privacy-First Processing",
      description: "No video storage, only skeletal pose estimation. All processing on your server."
    },
    {
      icon: "file-video",
      title: "Video Upload Analysis",
      description: "Upload recorded videos for batch fall detection analysis with annotated output video."
    },
    {
      icon: "globe",
      title: "Easy Web Deployment",
      description: "Run locally or deploy anywhere. Just a webcam and Python FastAPI backend required."
    }
  ]
};

export const howItWorksContent = {
  title: "How to Use the Fall Detection App",
  subtitle: "Get started in three simple steps—no installation required, works in your browser",
  steps: [
    {
      number: "01",
      title: "Open Canvas & Choose Mode",
      description: "Navigate to the Canvas page and select Live Camera for real-time webcam detection or Video Upload to analyze a recorded video.",
      image: "/images/step1-canvas.svg"
    },
    {
      number: "02",
      title: "Configure & Start Detection",
      description: "For Live Camera: Click Start Camera, wait for preview, enter alert email (optional), then click Start Detection. For Video Upload: Drag & drop a video file, set confidence threshold, then click Upload & Analyze.",
      image: "/images/step2-configure.svg"
    },
    {
      number: "03",
      title: "Monitor Results & Get Alerts",
      description: "Watch real-time pose estimation with bounding boxes. Falls are highlighted in red. Email alerts sent automatically when falls are detected.",
      image: "/images/step3-monitor.svg"
    }
  ]
};

export const contactContent = {
  title: "Get in Touch",
  subtitle: "Have questions about the fall detection system? Reach out to our team for support or collaboration inquiries.",
  form: {
    nameLabel: "Full Name",
    namePlaceholder: "John Doe",
    emailLabel: "Email Address",
    emailPlaceholder: "john@example.com",
    phoneLabel: "Phone Number (Optional)",
    phonePlaceholder: "+1 (555) 000-0000",
    messageLabel: "Message",
    messagePlaceholder: "Tell us about your use case or ask a question...",
    submitButton: "Send Message",
    successMessage: "Thank you! We'll be in touch within 24 hours.",
    errorMessage: "Something went wrong. Please try again."
  },
  contactInfo: [
    {
      icon: "mail",
      label: "Email",
      value: "avadhutgiri143@gmail.com",
      link: "mailto:support@falldetection.ai"
    },
    {
      icon: "github",
      label: "GitHub",
      value: "github.com/falldetection",
      link: "https://github.com/avadhutgiri12/Fall-Detection"
    },
    {
      icon: "mail",
      label: "Issues & Bug Reports",
      value: "GitHub Issues",
      link: "https://github.com/avadhutgiri12/fall-detection/issues"
    },
    {
      icon: "book",
      label: "Documentation",
      value: "API Docs & Guides",
      link: "https://github.com/falldetection/docs"
    }
  ]
};

export const footerContent = {
  companyName: "CareSight AI",
  tagline: "Camera-based fall detection powered by YOLOv8",
  navigation: {
    product: [
      { label: "Live Demo", href: "/canvas" },
      { label: "Video Analysis", href: "/canvas" },
      { label: "How It Works", href: "/how-it-works" },
      { label: "Documentation", href: "https://github.com/falldetection/docs" }
    ],
    company: [
      { label: "About", href: "/about" },
      { label: "Technology", href: "/about" },
      { label: "Privacy", href: "/contact" },
      { label: "Open Source", href: "https://github.com/avadhutgiri12/Fall-Detection" }
    ],
    support: [
      { label: "Help Center", href: "https://github.com/avadhutgiri12/fall-detection/issues" },
      { label: "Contact", href: "/contact" },
      { label: "API Reference", href: "https://github.com/falldetection/docs" },
      { label: "Community", href: "https://github.com/avadhutgiri12/Fall-Detection" }
    ]
  },
  socialLinks: [
    { platform: "github", href: "https://github.com/falldetection", label: "GitHub" },
    { platform: "twitter", href: "https://twitter.com/falldetection", label: "Twitter" },
    { platform: "linkedin", href: "https://linkedin.com/company/falldetection", label: "LinkedIn" }
  ],
  copyright: "© 2025 Avadhut Giri."
};

export const uiContent = {
  button: {
    primary: "Get Started",
    secondary: "Learn More",
    outline: "View Docs",
    loading: "Processing...",
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
  title: "Live Camera & Video Analysis",
  subtitle: "Experience real-time fall detection with your webcam or analyze recorded videos with YOLOv8 pose estimation",
  features: [
    {
      icon: "cpu",
      title: "Live Camera Detection",
      description: "Real-time webcam fall detection with pose estimation overlay. Adjust confidence threshold and get instant email alerts.",
      demoType: "webcam"
    },
    {
      icon: "file-video",
      title: "Video Upload Analysis",
      description: "Upload MP4, MOV, AVI, or MKV videos for batch fall detection. Download annotated video with detection boxes.",
      demoType: "upload"
    },
    {
      icon: "activity",
      title: "Pose Visualization",
      description: "See skeletal keypoints and bounding boxes in real-time. Green for normal posture, red for detected falls.",
      demoType: "pose"
    },
    {
      icon: "sliders",
      title: "Confidence Tuning",
      description: "Fine-tune detection sensitivity with the confidence threshold slider (0.0-1.0) to match your environment.",
      demoType: "tuning"
    }
  ],
  cta: {
    primary: "Start Live Detection",
    secondary: "Upload Video"
  }
};