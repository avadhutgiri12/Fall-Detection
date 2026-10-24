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
    default: "FallGuard - Advanced Fall Detection for Safer Living",
    template: "%s | FallGuard"
  },
  description: "AI-powered fall detection system with real-time monitoring, instant caregiver alerts, and 99.2% accuracy. Protect your loved ones with confidence.",
  keywords: ["fall detection", "senior safety", "elderly monitoring", "caregiver alerts", "AI healthcare", "aging in place", "medical alert"],
  authors: [{ name: "FallGuard" }],
  creator: "FallGuard",
  publisher: "FallGuard",
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
    url: "https://fallguard.com",
    siteName: "FallGuard",
    title: "FallGuard - Advanced Fall Detection for Safer Living",
    description: "AI-powered fall detection system with real-time monitoring and instant caregiver alerts.",
    images: [
      {
        url: "/images/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "FallGuard - Advanced Fall Detection System",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FallGuard - Advanced Fall Detection",
    description: "AI-powered fall detection with 99.2% accuracy and instant alerts.",
    images: ["/images/og-image.jpg"],
    creator: "@fallguard",
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