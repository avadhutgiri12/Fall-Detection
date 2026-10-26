import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navbar } from "@/components/ui/Navbar";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "CareSight AI - Camera-Based Fall Detection with YOLOv8",
    template: "%s | CareSight AI"
  },
  description: "Camera-based fall detection system powered by YOLOv8 pose estimation. Turn any webcam into an intelligent fall detection system with instant alerts and privacy-first processing.",
  keywords: ["fall detection", "camera fall detection", "YOLOv8 pose estimation", "senior safety", "elderly monitoring", "caregiver alerts", "AI healthcare", "aging in place", "webcam fall detection"],
  authors: [{ name: "CareSight AI" }],
  creator: "CareSight AI",
  publisher: "CareSight AI",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://caresight.ai",
    siteName: "CareSight AI",
    title: "CareSight AI - Camera-Based Fall Detection with YOLOv8",
    description: "Camera-based fall detection system powered by YOLOv8 pose estimation. Turn any webcam into an intelligent fall detection system.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "CareSight AI - Camera-Based Fall Detection System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "CareSight AI - Camera-Based Fall Detection",
    description: "Camera-based fall detection powered by YOLOv8 pose estimation with instant alerts.",
    images: ["/images/og-image.jpg"],
    creator: "@caresightai",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon-16x16.png",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
  verification: {
    google: "google-site-verification-code",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fae3ac" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        
        <Navbar />
        <main id="main-content" className="flex-1">
          {children}
        </main>
      </body>
    </html>
  );
}