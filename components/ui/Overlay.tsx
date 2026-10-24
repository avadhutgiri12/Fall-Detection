"use client";

import { forwardRef, type HTMLAttributes, type ReactNode, useEffect, useRef } from "react";
import { createPortal } from "react-dom";

export interface OverlayProps extends HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const Overlay = forwardRef<HTMLDivElement, OverlayProps>(
  ({
    isOpen,
    onClose,
    children,
    title,
    description,
    closeOnOverlayClick = true,
    closeOnEscape = true,
    className = "",
    ...props
  }, ref) => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);

    useEffect(() => {
      if (isOpen) {
        previousActiveElement.current = document.activeElement as HTMLElement;
        document.body.style.overflow = "hidden";
        contentRef.current?.focus();

        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === "Escape" && closeOnEscape) {
            onClose();
          }

          if (event.key === "Tab") {
            const focusableElements = contentRef.current?.querySelectorAll(
              'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            if (!focusableElements || focusableElements.length === 0) return;

            const firstElement = focusableElements[0] as HTMLElement;
            const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

            if (event.shiftKey && document.activeElement === firstElement) {
              event.preventDefault();
              lastElement.focus();
            } else if (!event.shiftKey && document.activeElement === lastElement) {
              event.preventDefault();
              firstElement.focus();
            }
          }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => {
          document.removeEventListener("keydown", handleKeyDown);
          document.body.style.overflow = "";
          previousActiveElement.current?.focus();
        };
      }
    }, [isOpen, onClose, closeOnEscape]);

    if (!isOpen) return null;

    const overlayContent = (
      <div
        ref={overlayRef}
        className={`overlay ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "overlay-title" : undefined}
        aria-describedby={description ? "overlay-description" : undefined}
        onClick={(e) => {
          if (closeOnOverlayClick && e.target === overlayRef.current) {
            onClose();
          }
        }}
        {...props}
      >
        <div
          ref={contentRef}
          className="modal"
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
        >
          {(title || description) && (
            <div className="p-6 border-b border-border">
              {title && (
                <h2 id="overlay-title" className="text-xl font-semibold text-foreground">
                  {title}
                </h2>
              )}
              {description && (
                <p id="overlay-description" className="text-muted-foreground mt-1">
                  {description}
                </p>
              )}
            </div>
          )}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    );

    if (typeof window === "undefined") return null;

    return createPortal(overlayContent, document.body);
  }
);

Overlay.displayName = "Overlay";

export interface ModalProps extends Omit<OverlayProps, "isOpen"> {
  isOpen: boolean;
  onClose: () => void;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

export const Modal = forwardRef<HTMLDivElement, ModalProps>(
  ({
    isOpen,
    onClose,
    children,
    title,
    description,
    size = "md",
    ...props
  }, ref) => {
    const sizeClasses = {
      sm: "max-w-md",
      md: "max-w-lg",
      lg: "max-w-2xl",
      xl: "max-w-4xl",
      full: "max-w-[90vw]",
    };

    return (
      <Overlay
        ref={ref}
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        className={sizeClasses[size]}
        {...props}
      >
        {children}
      </Overlay>
    );
  }
);

Modal.displayName = "Modal";

export interface DrawerProps extends Omit<OverlayProps, "isOpen"> {
  isOpen: boolean;
  onClose: () => void;
  position?: "left" | "right" | "bottom";
  size?: "sm" | "md" | "lg" | "full";
}

export const Drawer = forwardRef<HTMLDivElement, DrawerProps>(
  ({
    isOpen,
    onClose,
    children,
    title,
    description,
    position = "right",
    size = "md",
    ...props
  }, ref) => {
    const positionClasses = {
      left: "justify-start",
      right: "justify-end",
      bottom: "items-end",
    };

    const sizeClasses = {
      sm: "w-64 sm:w-80",
      md: "w-80 sm:w-96",
      lg: "w-96 sm:w-[32rem]",
      full: "w-full max-w-[90vw]",
    };

    const overlayStyles: React.CSSProperties = {
      alignItems: position === "bottom" ? "flex-end" : "center",
      justifyContent: position === "left" ? "flex-start" : position === "right" ? "flex-end" : "center",
    };

    return (
      <Overlay
        ref={ref}
        isOpen={isOpen}
        onClose={onClose}
        title={title}
        description={description}
        className={`${positionClasses[position]} ${sizeClasses[size]}`}
        style={overlayStyles}
        {...props}
      >
        <div
          className={`modal h-full ${position === "bottom" ? "rounded-t-2xl" : "rounded-xl"} max-h-[90vh] ${position === "bottom" ? "rounded-b-none" : ""}`}
        >
          {children}
        </div>
      </Overlay>
    );
  }
);

Drawer.displayName = "Drawer";