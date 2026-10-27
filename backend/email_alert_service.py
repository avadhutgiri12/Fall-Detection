"""
Email Alert Service for Fall Detection

Centralized service for sending fall detection alert emails with:
- Per-session rate limiting
- Configurable templates per detection type
- Rich metadata in email content
- Testable/mockable design
"""

import os
import time
import threading
import smtplib
from email.message import EmailMessage
from dataclasses import dataclass
from typing import Optional, Dict, Any
from dotenv import load_dotenv

load_dotenv()


@dataclass
class EmailConfig:
    """Configuration for email alerts."""
    smtp_server: str = os.getenv("SMTP_SERVER", "smtp.gmail.com")
    smtp_port: int = int(os.getenv("SMTP_PORT", "465"))
    smtp_use_ssl: bool = os.getenv("SMTP_USE_SSL", "true").lower() == "true"
    sender_email: str = os.getenv("SMTP_USERNAME", "your-email@gmail.com")
    sender_password: str = os.getenv("SMTP_PASSWORD", "your-app-password")
    default_target_email: str = os.getenv("TARGET_EMAIL", "").strip()
    rate_limit_window_seconds: int = int(os.getenv("EMAIL_RATE_LIMIT_SECONDS", "60"))
    enabled: bool = os.getenv("EMAIL_ALERTS_ENABLED", "true").lower() == "true"


@dataclass
class EmailAlertResult:
    """Result of an email alert attempt."""
    sent: bool
    reason: str
    timestamp: float
    session_id: str
    detection_type: str
    target_email: str


class EmailAlertService:
    """
    Centralized email alert service for fall detection.

    Features:
    - Per-session rate limiting (configurable window)
    - Template system for different detection types
    - Rich metadata in email content
    - Thread-safe operations
    - Configurable via EmailConfig (dependency injection friendly)
    """

    # Detection type constants
    DETECTION_TYPE_WEBCAM = "webcam"
    DETECTION_TYPE_VIDEO_UPLOAD = "video_upload"
    DETECTION_TYPE_VIDEO_CHUNK = "video_chunk"

    def __init__(self, config: Optional[EmailConfig] = None):
        self.config = config or EmailConfig()
        self._last_sent: Dict[str, float] = {}  # session_id -> last_sent_timestamp
        self._lock = threading.Lock()

    def should_send_alert(self, session_id: str, fall_score: float) -> tuple[bool, str]:
        """
        Check if an alert should be sent based on rate limits.

        Args:
            session_id: Unique session identifier
            fall_score: Confidence score of the fall detection

        Returns:
            Tuple of (should_send, reason)
        """
        if not self.config.enabled:
            return False, "Email alerts disabled in configuration"

        if fall_score <= 0:
            return False, "Invalid fall score"

        with self._lock:
            now = time.time()
            last_sent = self._last_sent.get(session_id, 0)

            if now - last_sent < self.config.rate_limit_window_seconds:
                remaining = self.config.rate_limit_window_seconds - (now - last_sent)
                return False, f"Rate limited: {remaining:.0f}s remaining"

            return True, "Allowed"

    def send_fall_alert(
        self,
        session_id: str,
        fall_score: float,
        detection_type: str,
        target_email: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> EmailAlertResult:
        """
        Send a fall detection alert email.

        Args:
            session_id: Unique session identifier
            fall_score: Confidence score of the fall detection (0-1)
            detection_type: Type of detection (webcam, video_upload, video_chunk)
            target_email: Explicit recipient email configured for this session.
                Alerts are not sent when this value is missing or looks like a placeholder.
            metadata: Additional context (frame_index, timestamp, etc.)

        Returns:
            EmailAlertResult with sent status and details
        """
        timestamp = time.time()
        target = (target_email or "").strip()

        # Fail closed: never silently send a session alert to a global/default
        # recipient, especially a placeholder address from deployment settings.
        lowered_target = target.lower()
        placeholder_markers = (
            "your-email", "your-alert-email", "example.com", "example.org",
            "replace-me", "your_email", "your_alert_email",
        )
        if not target or "@" not in target or any(marker in lowered_target for marker in placeholder_markers):
            return EmailAlertResult(
                sent=False,
                reason="No valid recipient email is configured for this session",
                timestamp=timestamp,
                session_id=session_id,
                detection_type=detection_type,
                target_email=target,
            )

        # Check rate limit only after confirming there is a real recipient.
        should_send, reason = self.should_send_alert(session_id, fall_score)
        if not should_send:
            return EmailAlertResult(
                sent=False,
                reason=reason,
                timestamp=timestamp,
                session_id=session_id,
                detection_type=detection_type,
                target_email=target
            )

        # Build and send email
        try:
            msg = self._build_email_content(fall_score, detection_type, metadata, session_id)
            msg['To'] = target

            sent = self._send_email(msg)

            if sent:
                with self._lock:
                    self._last_sent[session_id] = timestamp
                return EmailAlertResult(
                    sent=True,
                    reason="Email sent successfully",
                    timestamp=timestamp,
                    session_id=session_id,
                    detection_type=detection_type,
                    target_email=target
                )
            else:
                return EmailAlertResult(
                    sent=False,
                    reason="SMTP send failed",
                    timestamp=timestamp,
                    session_id=session_id,
                    detection_type=detection_type,
                    target_email=target
                )

        except Exception as e:
            return EmailAlertResult(
                sent=False,
                reason=f"Email error: {str(e)}",
                timestamp=timestamp,
                session_id=session_id,
                detection_type=detection_type,
                target_email=target
            )

    def _build_email_content(
        self,
        fall_score: float,
        detection_type: str,
        metadata: Optional[Dict[str, Any]],
        session_id: str
    ) -> EmailMessage:
        """Build email message with appropriate template for detection type."""
        msg = EmailMessage()
        msg['Subject'] = self._get_subject(detection_type, fall_score)
        msg['From'] = self.config.sender_email

        content = self._get_email_body(fall_score, detection_type, metadata, session_id)
        msg.set_content(content)

        return msg

    def _get_subject(self, detection_type: str, fall_score: float) -> str:
        """Get email subject based on detection type."""
        confidence_pct = f"{fall_score:.0%}"

        subjects = {
            self.DETECTION_TYPE_WEBCAM: f"⚠️ Fall Detected - Live Webcam ({confidence_pct} confidence)",
            self.DETECTION_TYPE_VIDEO_UPLOAD: f"⚠️ Fall Detected - Video Analysis ({confidence_pct} confidence)",
            self.DETECTION_TYPE_VIDEO_CHUNK: f"⚠️ Fall Detected - Video Chunk Processing ({confidence_pct} confidence)",
        }
        return subjects.get(detection_type, f"⚠️ Fall Detected ({confidence_pct} confidence)")

    def _get_email_body(
        self,
        fall_score: float,
        detection_type: str,
        metadata: Optional[Dict[str, Any]],
        session_id: str
    ) -> str:
        """Get email body with rich metadata."""
        confidence_pct = f"{fall_score:.1%}"
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S UTC", time.gmtime())

        # Base info
        lines = [
            f"Fall Detection Alert",
            f"====================",
            f"",
            f"Detection Type: {detection_type.replace('_', ' ').title()}",
            f"Session ID: {session_id}",
            f"Timestamp: {timestamp}",
            f"Confidence: {confidence_pct}",
            f"",
        ]

        # Add metadata if available
        if metadata:
            lines.append("Additional Details:")
            lines.append("-" * 20)
            for key, value in metadata.items():
                if value is not None:
                    lines.append(f"  {key.replace('_', ' ').title()}: {value}")
            lines.append("")

        # Detection type specific info
        type_info = {
            self.DETECTION_TYPE_WEBCAM: [
                "This alert was triggered by real-time webcam monitoring.",
                "The system continuously analyzes live video feed for fall events.",
            ],
            self.DETECTION_TYPE_VIDEO_UPLOAD: [
                "This alert was triggered during full video file processing.",
                "The video was uploaded and analyzed frame by frame.",
            ],
            self.DETECTION_TYPE_VIDEO_CHUNK: [
                "This alert was triggered during chunked video processing.",
                "The video is being processed in batches of frames.",
            ],
        }

        for line in type_info.get(detection_type, []):
            lines.append(line)

        lines.extend([
            "",
            "---",
            "Fall Detection System",
            "This is an automated alert. Please do not reply to this email.",
        ])

        return "\n".join(lines)

    def _send_email(self, msg: EmailMessage) -> bool:
        """Send email via SMTP."""
        try:
            if self.config.smtp_use_ssl:
                with smtplib.SMTP_SSL(self.config.smtp_server, self.config.smtp_port) as smtp:
                    smtp.login(self.config.sender_email, self.config.sender_password)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(self.config.smtp_server, self.config.smtp_port) as smtp:
                    smtp.starttls()
                    smtp.login(self.config.sender_email, self.config.sender_password)
                    smtp.send_message(msg)
            return True
        except Exception as e:
            print(f"[EmailAlertService] Failed to send email: {e}")
            return False

    def clear_rate_limit(self, session_id: str) -> bool:
        """Clear rate limit for a session (useful for testing or session cleanup)."""
        with self._lock:
            if session_id in self._last_sent:
                del self._last_sent[session_id]
                return True
            return False

    def get_rate_limit_status(self, session_id: str) -> Dict[str, Any]:
        """Get current rate limit status for a session."""
        with self._lock:
            now = time.time()
            last_sent = self._last_sent.get(session_id, 0)
            elapsed = now - last_sent
            remaining = max(0, self.config.rate_limit_window_seconds - elapsed)
            return {
                "session_id": session_id,
                "last_sent": last_sent if last_sent > 0 else None,
                "elapsed_seconds": elapsed if last_sent > 0 else None,
                "remaining_seconds": remaining,
                "can_send": remaining <= 0,
            }