"use client";

import Image from "next/image";
import Link from "next/link";

export interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-32 h-10",
  md: "w-40 h-14",
  lg: "w-52 h-18",
};

const sizeValues = {
  sm: { width: 128, height: 40 },
  md: { width: 160, height: 56 },
  lg: { width: 208, height: 72 },
};

export function Logo({ size = "md", className = "" }: LogoProps) {
  const dimensions = sizeValues[size];
  const classes = sizeClasses[size];

  return (
    <Link href="/" className={`flex items-center ${classes} ${className}`} aria-label="CareSight AI Home">
      <Image
        src="/images/logo.png"
        alt="CareSight AI Logo"
        width={dimensions.width}
        height={dimensions.height}
        priority
        className="opacity-90 hover:opacity-100 absolute top-1 left-10 transition-opacity duration-300"
      />
    </Link>
  );
}