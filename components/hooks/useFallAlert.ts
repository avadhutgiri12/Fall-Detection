
"use client";

import { useCallback, useState, useEffect, useRef } from "react";
import { useToast } from "@/components/ui/ToastProvider";

export interface EmailAlertResult {
  sent: boolean;
  reason: string;
  timestamp: number;
  target_email: string;
  session_id?: string;
  detection_type?: string;
}

export interface FallAlertOptions {
  apiUrl: string;
  sessionId: string;
  onAlertSent?: (result: EmailAlertResult) => void;
  onAlertFailed?: (reason: string) => void;
  onFallDetected?: (
    score: number,
    emailSent: boolean,
    emailAlertResult?: EmailAlertResult
  ) => void;
}

export interface UseFallAlertReturn {
  isEmailConfigured: boolean;
  email: string;
  setEmail: (email: string) => void;
  configureEmail: (targetEmail: string) => Promise<boolean>;
  triggerFallAlert: (
    score: number,
    emailSent: boolean,
    emailAlertResult?: EmailAlertResult
  ) => void;
  checkEmailConfigured: () => Promise<void>;
}

const isValidEmail = (value: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function useFallAlert({
  apiUrl,
  sessionId,
  onAlertSent,
  onAlertFailed,
  onFallDetected,
}: FallAlertOptions): UseFallAlertReturn {
  const [email, setEmail] = useState("");
  const [isEmailConfigured, setIsEmailConfigured] = useState(false);

  const checkingEmailRef = useRef(false);
  const lastAlertTimeRef = useRef(0);
  const { toast } = useToast();

  const checkEmailConfigured = useCallback(async () => {
    if (checkingEmailRef.current || !sessionId) return;

    checkingEmailRef.current = true;

    try {
      const response = await fetch(
        `${apiUrl}/api/config?session_id=${encodeURIComponent(sessionId)}`
      );

      if (!response.ok) {
        setIsEmailConfigured(false);
        return;
      }

      const data = await response.json();
      const savedEmail =
        typeof data.target_email === "string"
          ? data.target_email.trim()
          : "";

      const configured =
        isValidEmail(savedEmail) &&
        savedEmail.toLowerCase() !== "your-email@example.com" &&
        savedEmail.toLowerCase() !== "your-alert-email@example.com";

      setIsEmailConfigured(configured);

      if (configured) {
        setEmail(savedEmail);
      } else {
        setEmail("");
      }
    } catch (error) {
      console.error(
        "[useFallAlert] Failed to check email configuration:",
        error
      );
      setIsEmailConfigured(false);
    } finally {
      checkingEmailRef.current = false;
    }
  }, [apiUrl, sessionId]);

  useEffect(() => {
    void checkEmailConfigured();
  }, [checkEmailConfigured]);

  const configureEmail = useCallback(
    async (targetEmail: string): Promise<boolean> => {
      const normalizedEmail = targetEmail.trim();

      if (!sessionId) {
        toast({
          type: "error",
          title: "Session Not Ready",
          message: "Please wait for the detection session to initialize.",
        });
        return false;
      }

      if (!isValidEmail(normalizedEmail)) {
        toast({
          type: "error",
          title: "Invalid Email",
          message: "Please enter a valid email address.",
        });
        return false;
      }

      const placeholderEmails = [
        "your-email@example.com",
        "your-alert-email@example.com",
      ];

      if (placeholderEmails.includes(normalizedEmail.toLowerCase())) {
        toast({
          type: "error",
          title: "Invalid Email",
          message: "Please enter your actual email address.",
        });
        return false;
      }

      try {
        // Do not mark the email configured until the backend confirms it.
        setIsEmailConfigured(false);

        const response = await fetch(
          `${apiUrl}/api/config?session_id=${encodeURIComponent(sessionId)}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              target_email: normalizedEmail,
            }),
          }
        );

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            data.detail || data.message || "The server rejected the email."
          );
        }

        // Require the backend to return the email it actually saved.
        const savedEmail =
          typeof data.target_email === "string"
            ? data.target_email.trim()
            : "";

        if (
          !isValidEmail(savedEmail) ||
          savedEmail.toLowerCase() !== normalizedEmail.toLowerCase()
        ) {
          throw new Error(
            "The server did not confirm saving the requested email. Check the backend /api/config endpoint."
          );
        }

        setEmail(savedEmail);
        setIsEmailConfigured(true);

        toast({
          type: "success",
          title: "Email Configured",
          message: `Fall alerts will be sent to ${savedEmail}.`,
        });

        return true;
      } catch (error) {
        console.error("[useFallAlert] Failed to configure email:", error);

        setIsEmailConfigured(false);

        const message =
          error instanceof Error
            ? error.message
            : "Failed to configure email.";

        toast({
          type: "error",
          title: "Email Not Configured",
          message,
        });

        return false;
      }
    },
    [apiUrl, sessionId, toast]
  );

  const triggerFallAlert = useCallback(
    (
      score: number,
      emailSent: boolean,
      emailAlertResult?: EmailAlertResult
    ) => {
      const now = Date.now();

      // Prevent duplicate notifications within two seconds.
      if (now - lastAlertTimeRef.current < 2000) return;

      lastAlertTimeRef.current = now;

      const confidencePct = (score * 100).toFixed(0);

      toast({
        type: "warning",
        title: "Fall Detected",
        message: `Fall detected (${confidencePct}% confidence).`,
        duration: 5000,
      });

      if (emailSent) {
        toast({
          type: "success",
          title: "Email Alert Sent",
          message: emailAlertResult?.target_email
            ? `Alert sent to ${emailAlertResult.target_email}.`
            : "The backend reported that the alert was sent.",
          duration: 4000,
        });

        onAlertSent?.(
          emailAlertResult ?? {
            sent: true,
            reason: "Email sent successfully",
            timestamp: now,
            target_email: email,
          }
        );
      } else if (isEmailConfigured) {
        const reason =
          emailAlertResult?.reason ||
          "Email could not be sent. Check the backend email configuration and logs.";

        toast({
          type: "error",
          title: "Email Not Sent",
          message: reason,
          duration: 6000,
        });

        onAlertFailed?.(reason);
      }

      onFallDetected?.(score, emailSent, emailAlertResult);
    },
    [
      toast,
      email,
      isEmailConfigured,
      onAlertSent,
      onAlertFailed,
      onFallDetected,
    ]
  );

  return {
    isEmailConfigured,
    email,
    setEmail,
    configureEmail,
    triggerFallAlert,
    checkEmailConfigured,
  };
}
