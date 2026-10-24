"use client";

import { forwardRef, type HTMLAttributes, type ReactNode } from "react";

export interface ContainerProps extends HTMLAttributes<HTMLDivElement> {
  size?: "sm" | "md" | "lg" | "xl" | "full";
  as?: "div" | "main" | "section" | "header" | "footer";
}

export const Container = forwardRef<HTMLDivElement, ContainerProps>(
  ({
    children,
    size = "lg",
    as: Component = "div",
    className = "",
    ...props
  }, ref) => {
    const sizeClasses = {
      sm: "max-w-3xl",
      md: "max-w-5xl",
      lg: "max-w-7xl",
      xl: "max-w-[1440px]",
      full: "max-w-full",
    };

    const combinedClasses = [
      "container",
      sizeClasses[size],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <Component
        ref={ref}
        className={combinedClasses}
        {...props}
      >
        {children}
      </Component>
    );
  }
);

Container.displayName = "Container";

export interface SectionProps extends HTMLAttributes<HTMLElement> {
  variant?: "default" | "alternate" | "muted";
  size?: "sm" | "md" | "lg";
  id?: string;
  as?: "section" | "div" | "main" | "header" | "footer" | "article";
}

export const Section = forwardRef<any, SectionProps>(
  ({
    children,
    variant = "default",
    size = "md",
    id,
    className = "",
    as: Component = "section",
    ...props
  }, ref) => {
    const variantClasses = {
      default: "bg-background",
      alternate: "bg-muted",
      muted: "bg-muted/50",
    };

    const sizeClasses = {
      sm: "py-16 md:py-20",
      md: "py-20 md:py-28",
      lg: "py-24 md:py-32",
    };

    const combinedClasses = [
      "section",
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
        <Container>{children}</Container>
      </Component>
    );
  }
);

Section.displayName = "Section";

export interface GridProps extends HTMLAttributes<HTMLDivElement> {
  columns?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: "none" | "sm" | "md" | "lg" | "xl";
  responsive?: boolean;
}

export const Grid = forwardRef<HTMLDivElement, GridProps>(
  ({
    children,
    columns = 3,
    gap = "md",
    responsive = true,
    className = "",
    ...props
  }, ref) => {
    const gapClasses = {
      none: "gap-0",
      sm: "gap-3 md:gap-4",
      md: "gap-4 md:gap-6",
      lg: "gap-6 md:gap-8",
      xl: "gap-8 md:gap-12",
    };

    const columnClasses = responsive
      ? `grid-cols-1 sm:grid-cols-2 lg:grid-cols-${columns}`
      : `grid-cols-${columns}`;

    const combinedClasses = [
      "grid",
      columnClasses,
      gapClasses[gap],
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
        {children}
      </div>
    );
  }
);

Grid.displayName = "Grid";

export interface FlexProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "row" | "col" | "row-reverse" | "col-reverse";
  align?: "start" | "center" | "end" | "stretch" | "baseline";
  justify?: "start" | "center" | "end" | "between" | "around" | "evenly";
  gap?: "none" | "sm" | "md" | "lg" | "xl";
  wrap?: boolean;
}

export const Flex = forwardRef<HTMLDivElement, FlexProps>(
  ({
    children,
    direction = "row",
    align = "stretch",
    justify = "start",
    gap = "md",
    wrap = false,
    className = "",
    ...props
  }, ref) => {
    const directionClasses = {
      row: "flex-row",
      col: "flex-col",
      "row-reverse": "flex-row-reverse",
      "col-reverse": "flex-col-reverse",
    };

    const alignClasses = {
      start: "items-start",
      center: "items-center",
      end: "items-end",
      stretch: "items-stretch",
      baseline: "items-baseline",
    };

    const justifyClasses = {
      start: "justify-start",
      center: "justify-center",
      end: "justify-end",
      between: "justify-between",
      around: "justify-around",
      evenly: "justify-evenly",
    };

    const gapClasses = {
      none: "gap-0",
      sm: "gap-2",
      md: "gap-4",
      lg: "gap-6",
      xl: "gap-8",
    };

    const combinedClasses = [
      "flex",
      directionClasses[direction],
      alignClasses[align],
      justifyClasses[justify],
      gapClasses[gap],
      wrap ? "flex-wrap" : "flex-nowrap",
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
        {children}
      </div>
    );
  }
);

Flex.displayName = "Flex";

export interface StackProps extends HTMLAttributes<HTMLDivElement> {
  direction?: "vertical" | "horizontal";
  gap?: "none" | "sm" | "md" | "lg" | "xl";
  divider?: ReactNode;
}

export const Stack = forwardRef<HTMLDivElement, StackProps>(
  ({
    children,
    direction = "vertical",
    gap = "md",
    divider,
    className = "",
    ...props
  }, ref) => {
    const gapClasses = {
      none: "gap-0",
      sm: direction === "vertical" ? "space-y-2" : "space-x-2",
      md: direction === "vertical" ? "space-y-4" : "space-x-4",
      lg: direction === "vertical" ? "space-y-6" : "space-x-6",
      xl: direction === "vertical" ? "space-y-8" : "space-x-8",
    };

    const directionClass = direction === "horizontal" ? "flex flex-row" : "flex flex-col";

    const childrenArray = Array.isArray(children) ? children : [children];
    const childrenWithDividers = childrenArray.flatMap((child, index) => [
      child,
      index < childrenArray.length - 1 && divider
        ? <div key={`divider-${index}`} className="flex-shrink-0">{divider}</div>
        : null,
    ]).filter(Boolean);

    const combinedClasses = [
      directionClass,
      gapClasses[gap],
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
        {childrenWithDividers}
      </div>
    );
  }
);

Stack.displayName = "Stack";