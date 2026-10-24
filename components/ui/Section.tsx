"use client";

import { forwardRef, type HTMLAttributes } from "react";

export interface SectionWrapperProps extends HTMLAttributes<HTMLElement> {
  variant?: "default" | "alternate" | "muted" | "gradient";
  size?: "sm" | "md" | "lg" | "xl";
  id?: string;
  as?: "section" | "div" | "main" | "header" | "footer" | "article";
}

export const SectionWrapper = forwardRef<any, SectionWrapperProps>(
  ({
    children,
    variant = "default",
    size = "md",
    id,
    as: Component = "section",
    className = "",
    ...props
  }, ref) => {
    const variantClasses = {
      default: "bg-background",
      alternate: "bg-muted",
      muted: "bg-muted/50",
      gradient: "bg-gradient-to-b from-background via-muted/50 to-background",
    };

    const sizeClasses = {
      sm: "py-12 md:py-16",
      md: "py-16 md:py-24",
      lg: "py-20 md:py-28",
      xl: "py-24 md:py-32",
    };

    const combinedClasses = [
      "w-full",
      variantClasses[variant],
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        id={id}
        className={combinedClasses}
        {...props}
      >
        <div className="container">
          {children}
        </div>
      </Component>
    );
  }
);

SectionWrapper.displayName = "SectionWrapper";

export interface SectionHeaderProps extends HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
  align?: "left" | "center" | "right";
  action?: React.ReactNode;
}

export const SectionHeader = forwardRef<HTMLDivElement, SectionHeaderProps>(
  ({
    title,
    subtitle,
    align = "left",
    action,
    className = "",
    ...props
  }, ref) => {
    const alignClasses = {
      left: "text-left items-start",
      center: "text-center items-center",
      right: "text-right items-end",
    };

    const combinedClasses = [
      "flex flex-col",
      alignClasses[align],
      "max-w-3xl",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        className={combinedClasses}
        {...props}
      >
        {action && (
          <div className="w-full mb-4">
            {action}
          </div>
        )}
        <h2 className="text-3xl md:text-4xl font-bold text-foreground tracking-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-4 text-base text-muted-foreground max-w-none">
            {subtitle}
          </p>
        )}
      </div>
    );
  }
);

SectionHeader.displayName = "SectionHeader";