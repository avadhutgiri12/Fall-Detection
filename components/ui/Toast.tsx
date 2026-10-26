"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";

export type ToastType = "success" | "error" | "info" | "warning";

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const typeStyles: Record<ToastType, string> = {
  success: "bg-green-50 text-green-900 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800",
  error: "bg-red-50 text-red-900 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800",
  info: "bg-blue-50 text-blue-900 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800",
  warning: "bg-amber-50 text-amber-900 border-amber-200 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-800",
};

const typeIcons: Record<ToastType, React.ReactNode> = {
  success: (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L23.71 3.86a2 2 0 0 0-3.42 0L12 14.34 6.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
};

interface ToastProps {
  toast: Toast;
  onClose: (id: string) => void;
  index: number;
  total: number;
}

export function Toast({ toast, onClose, index, total }: ToastProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Enter animation
    setTimeout(() => setIsVisible(true), index * 100);

    // Auto-dismiss timer
    const duration = toast.duration ?? 5000;
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onClose(toast.id), 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, index, onClose]);

  // Don't render if exiting and not visible
  if (isExiting && !isVisible) return null;

  const baseStyles = `
    fixed bottom-4 right-4 z-50 w-full max-w-sm pointer-events-none
    transition-all duration-300 ease-out
    ${isVisible ? "translate-y-0 opacity-100" : "translate-y-20 opacity-0"}
    ${isExiting ? "translate-x-full opacity-0" : ""}
  `;

  const stackOffset = index > 0 ? `bottom-${4 + index * 96}` : "bottom-4";

  return (
    <div
      className={`${baseStyles} ${stackOffset}`}
      style={{ pointerEvents: "auto" as const }}
      role="alert"
      aria-live="polite"
      aria-atomic="true"
    >
      <div
        className={`
          flex items-start gap-3 p-4 rounded-xl border shadow-lg
          ${typeStyles[toast.type]}
          animate-in slide-in-from-right-full duration-300
        `}
      >
        <div className="flex-shrink-0 text-current">{typeIcons[toast.type]}</div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">{toast.title}</p>
          {toast.message && (
            <p className="text-sm opacity-90 mt-0.5">{toast.message}</p>
          )}
        </div>
        <button
          onClick={() => {
            setIsExiting(true);
            setTimeout(() => onClose(toast.id), 300);
          }}
          className="flex-shrink-0 p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          aria-label="Dismiss notification"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}