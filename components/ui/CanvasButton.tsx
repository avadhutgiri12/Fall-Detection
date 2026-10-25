"use client";

import { forwardRef, ButtonHTMLAttributes } from "react";

type CanvasButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type CanvasButtonSize = "sm" | "md" | "lg";

export interface CanvasButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: CanvasButtonVariant;
  /** Button size */
  size?: CanvasButtonSize;
  /** Loading state */
  isLoading?: boolean;
  /** Button children */
  children: React.ReactNode;
}

const variantStyles: Record<CanvasButtonVariant, string> = {
  primary: `
    --btn-bg: hsl(248, 53%, 58%);
    --btn-bg-start: hsl(248, 39%, 39%);
    --btn-bg-mid: hsl(248, 39%, 49%);
    --btn-bg-end: hsl(248, 39%, 29%);
    --btn-shadow: hsl(226, 25%, 69%);
  `,
  secondary: `
    --btn-bg: hsl(200, 53%, 58%);
    --btn-bg-start: hsl(200, 39%, 39%);
    --btn-bg-mid: hsl(200, 39%, 49%);
    --btn-bg-end: hsl(200, 39%, 29%);
    --btn-shadow: hsl(200, 25%, 69%);
  `,
  danger: `
    --btn-bg: hsl(0, 70%, 55%);
    --btn-bg-start: hsl(0, 60%, 35%);
    --btn-bg-mid: hsl(0, 60%, 45%);
    --btn-bg-end: hsl(0, 60%, 25%);
    --btn-shadow: hsl(0, 40%, 60%);
  `,
  ghost: `
    --btn-bg: hsl(0, 0%, 95%);
    --btn-bg-start: hsl(0, 0%, 80%);
    --btn-bg-mid: hsl(0, 0%, 85%);
    --btn-bg-end: hsl(0, 0%, 70%);
    --btn-shadow: hsl(0, 0%, 70%);
    --btn-text: hsl(248, 30%, 30%);
  `,
};

const sizeStyles: Record<CanvasButtonSize, React.CSSProperties> = {
  sm: { padding: "10px 20px", fontSize: "0.875rem", letterSpacing: "1px" },
  md: { padding: "14px 28px", fontSize: "0.9375rem", letterSpacing: "1.25px" },
  lg: { padding: "18px 36px", fontSize: "1rem", letterSpacing: "1.5px" },
};

export const CanvasButton = forwardRef<HTMLButtonElement, CanvasButtonProps>(
  (
    {
      children,
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled,
      className = "",
      style: styleProp,
      ...props
    },
    ref
  ) => {
    const baseStyle: React.CSSProperties = styleProp || {};

    // Create combined style with CSS custom properties from variant
    const variantStyle = variantStyles[variant];
    const combinedStyle: React.CSSProperties = { ...baseStyle };

    // Parse CSS custom properties from variant string and apply to style
    if (variantStyle) {
      const cssVars = variantStyle
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean)
        .reduce((acc, prop) => {
          const [key, value] = prop.split(":").map((s) => s.trim());
          if (key && value) {
            (acc as Record<string, string>)[key] = value;
          }
          return acc;
        }, {} as Record<string, string>);
      Object.assign(combinedStyle, cssVars);
    }

    return (
      <button
        ref={ref}
        className={`pushable ${className}`}
        disabled={disabled || isLoading}
        style={combinedStyle}
        {...props}
      >
        <span className="shadow" aria-hidden="true" />
        <span className="edge" aria-hidden="true" />
        <span className="front" style={sizeStyles[size]}>
          {isLoading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Loading...
            </span>
          ) : (
            children
          )}
        </span>
        <style jsx>{`
          .pushable {
            position: relative;
            background: transparent;
            padding: 0;
            border: none;
            cursor: pointer;
            outline-offset: 4px;
            outline-color: deeppink;
            transition: filter 250ms;
            -webkit-tap-highlight-color: rgba(0, 0, 0, 0);
            font-family: inherit;
            font-weight: 600;
            text-transform: uppercase;
            color: var(--btn-text, white);
          }

          .pushable:disabled {
            cursor: not-allowed;
            filter: grayscale(60%) brightness(80%);
            pointer-events: none;
          }

          .shadow {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 100%;
            background: var(--btn-shadow, hsl(226, 25%, 69%));
            border-radius: 8px;
            filter: blur(2px);
            will-change: transform;
            transform: translateY(2px);
            transition: transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1);
          }

          .edge {
            position: absolute;
            top: 0;
            left: 0;
            height: 100%;
            width: 100%;
            border-radius: 8px;
            background: linear-gradient(
              to right,
              var(--btn-bg-start, hsl(248, 39%, 39%)) 0%,
              var(--btn-bg-mid, hsl(248, 39%, 49%)) 8%,
              var(--btn-bg-end, hsl(248, 39%, 39%)) 92%,
              var(--btn-bg-end, hsl(248, 39%, 29%)) 100%
            );
          }

          .front {
            display: block;
            position: relative;
            border-radius: 8px;
            background: var(--btn-bg, hsl(248, 53%, 58%));
            color: var(--btn-text, white);
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            font-size: 1rem;
            transform: translateY(-4px);
            transition: transform 600ms cubic-bezier(0.3, 0.7, 0.4, 1);
            white-space: nowrap;
          }

          .pushable:hover:not(:disabled) {
            filter: brightness(110%);
          }

          .pushable:hover:not(:disabled) .front {
            transform: translateY(-6px);
            transition: transform 250ms cubic-bezier(0.3, 0.7, 0.4, 1.5);
          }

          .pushable:active:not(:disabled) .front {
            transform: translateY(-2px);
            transition: transform 34ms;
          }

          .pushable:hover:not(:disabled) .shadow {
            transform: translateY(4px);
            transition: transform 250ms cubic-bezier(0.3, 0.7, 0.4, 1.5);
          }

          .pushable:active:not(:disabled) .shadow {
            transform: translateY(1px);
            transition: transform 34ms;
          }

          .pushable:focus:not(:focus-visible) {
            outline: none;
          }

          .pushable:focus-visible {
            outline: 2px solid var(--btn-shadow, hsl(226, 25%, 69%));
            outline-offset: 4px;
          }
        `}</style>
      </button>
    );
  }
);

CanvasButton.displayName = "CanvasButton";

export default CanvasButton;