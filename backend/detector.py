"""
Fall Detection Core Logic
Extracted from Streamlit app for reuse in FastAPI backend.
"""

import os
import cv2
import time
import smtplib
import base64
import numpy as np
from email.message import EmailMessage
from ultralytics import YOLO
from dataclasses import dataclass
from typing import List, Optional
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


@dataclass
class DetectionResult:
    """Single frame detection result."""
    boxes: List[List[int]]  # [x1, y1, x2, y2]
    scores: List[float]
    falls: List[bool]
    timestamp: float


@dataclass
class VideoDetectionResult:
    """Video processing result."""
    job_id: str
    status: str  # "processing", "completed", "failed"
    progress: float  # 0.0 to 1.0
    results: Optional[List[DetectionResult]] = None
    error: Optional[str] = None
    output_video_path: Optional[str] = None


class FallDetector:
    """Fall detection using YOLOv8 pose estimation."""

    def __init__(
        self,
        model_path: str = None,
        conf_threshold: float = None,
        sender_email: str = None,
        sender_pass: str = None,
        target_email: str = None,
    ):
        # Use environment variables as defaults, with fallbacks for local development
        self.model_path = model_path or os.getenv("MODEL_PATH", "yolov8n-pose.pt")
        self.conf_threshold = conf_threshold if conf_threshold is not None else float(os.getenv("CONF_THRESHOLD", "0.6"))
        self.sender_email = sender_email or os.getenv("SMTP_USERNAME", "your-email@gmail.com")
        self.sender_pass = sender_pass or os.getenv("SMTP_PASSWORD", "your-app-password")
        self.target_email = target_email or os.getenv("TARGET_EMAIL", "your-email@example.com")
        self._model: Optional[YOLO] = None
        self._last_alert_time = 0.0
        self._alert_lock = threading.Lock()

    @property
    def model(self) -> YOLO:
        """Lazy-load YOLO model."""
        if self._model is None:
            self._model = YOLO(self.model_path)
        return self._model

    def set_conf_threshold(self, threshold: float):
        """Update confidence threshold."""
        self.conf_threshold = max(0.0, min(1.0, threshold))

    def detect_frame(
        self,
        frame: np.ndarray,
        half: bool = False,
        conf_threshold: Optional[float] = None,
        target_email: Optional[str] = None
    ) -> DetectionResult:
        """
        Run detection on a single frame.

        Args:
            frame: BGR image as numpy array
            half: Use FP16 half-precision inference (reduces memory usage)
            conf_threshold: Override confidence threshold for this frame (uses instance default if None)
            target_email: Email to send fall alerts to (uses instance default if None)

        Returns:
            DetectionResult with boxes, scores, fall flags
        """
        # Use provided threshold or fall back to instance default
        threshold = conf_threshold if conf_threshold is not None else self.conf_threshold

        results = self.model(frame, verbose=False, half=half)

        boxes = []
        scores = []
        falls = []

        for r in results:
            if r.boxes:
                for box in r.boxes:
                    x1, y1, x2, y2 = map(int, box.xyxy[0].cpu().numpy())
                    score = box.conf[0].item()
                    w, h = x2 - x1, y2 - y1

                    # Fall logic: horizontal box (w > h) with sufficient confidence
                    is_fall = score > threshold and w > h

                    boxes.append([x1, y1, x2, y2])
                    scores.append(score)
                    falls.append(is_fall)

                    # Send alert if fall detected (rate limited) - use provided email or instance default
                    if is_fall:
                        self._maybe_send_alert(score, target_email or self.target_email)

        return DetectionResult(
            boxes=boxes,
            scores=scores,
            falls=falls,
            timestamp=time.time()
        )

    def _maybe_send_alert(self, score: float, target_email: Optional[str] = None):
        """Send email alert with rate limiting (1 per minute)."""
        with self._alert_lock:
            now = time.time()
            if now - self._last_alert_time > 60:
                if self._send_alert(score, target_email or self.target_email):
                    self._last_alert_time = now

    def _send_alert(self, score: float, target_email: str) -> bool:
        """Send fall alert email to specified address."""
        try:
            msg = EmailMessage()
            msg['Subject'] = "Fall Detected ⚠️🚨"
            msg['From'] = self.sender_email
            msg['To'] = target_email
            msg.set_content(f"System detected a fall with {score:.2%} confidence. Immediate check required.")

            smtp_server = os.getenv("SMTP_SERVER", "smtp.gmail.com")
            smtp_port = int(os.getenv("SMTP_PORT", "465"))
            use_ssl = os.getenv("SMTP_USE_SSL", "true").lower() == "true"

            if use_ssl:
                with smtplib.SMTP_SSL(smtp_server, smtp_port) as smtp:
                    smtp.login(self.sender_email, self.sender_pass)
                    smtp.send_message(msg)
            else:
                with smtplib.SMTP(smtp_server, smtp_port) as smtp:
                    smtp.starttls()
                    smtp.login(self.sender_email, self.sender_pass)
                    smtp.send_message(msg)
            return True
        except Exception as e:
            print(f"[FallDetector] Email send failed: {e}")
            return False

    def set_target_email(self, email: str):
        """Update target email for alerts."""
        self.target_email = email

    def draw_detections(self, frame: np.ndarray, result: DetectionResult) -> np.ndarray:
        """Draw bounding boxes and labels on frame."""
        annotated = frame.copy()

        for (x1, y1, x2, y2), score, is_fall in zip(result.boxes, result.scores, result.falls):
            color = (0, 0, 255) if is_fall else (255, 165, 0)  # Red for fall, Orange for normal
            cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 3)
            label = f"FALL: {score:.2f}" if is_fall else f"Score: {score:.2f}"
            cv2.putText(annotated, label, (x1, y1 - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, color, 2)

        return annotated

    def process_video(
        self,
        input_path: str,
        output_path: str,
        progress_callback=None,
        frame_skip: int = 1,
        max_resolution: int = 640,
        half: bool = True,
        target_email: Optional[str] = None,
        conf_threshold: Optional[float] = None
    ) -> List[DetectionResult]:
        """
        Process entire video file and save annotated output.

        Args:
            input_path: Path to input video
            output_path: Path to save annotated video
            progress_callback: Optional function(progress: float) called during processing
            frame_skip: Process every Nth frame (1 = all frames, 2 = every other, etc.)
            max_resolution: Max width/height for inference (frames resized if larger)
            half: Use FP16 half-precision inference (reduces memory usage ~50%)
            target_email: Email to send fall alerts to (uses instance default if None)
            conf_threshold: Override confidence threshold (uses instance default if None)

        Returns:
            List of DetectionResult per frame (only for processed frames)
        """
        import gc

        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        orig_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        orig_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        # Calculate output dimensions (respect max_resolution)
        scale = min(max_resolution / max(orig_width, orig_height), 1.0)
        out_width = int(orig_width * scale)
        out_height = int(orig_height * scale)

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (out_width, out_height))

        all_results = []
        frame_idx = 0
        processed_count = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                # Skip frames based on frame_skip
                if frame_skip > 1 and (frame_idx % frame_skip != 0):
                    # Still write the original frame to output for smooth video
                    if scale < 1.0:
                        frame = cv2.resize(frame, (out_width, out_height))
                    out.write(frame)
                    frame_idx += 1
                    if progress_callback and total_frames > 0:
                        progress_callback(frame_idx / total_frames)
                    continue

                # Resize frame for inference if needed
                inference_frame = frame
                if scale < 1.0:
                    inference_frame = cv2.resize(frame, (out_width, out_height))

                # Run detection with FP16 for memory efficiency
                result = self.detect_frame(
                    inference_frame,
                    half=half,
                    conf_threshold=conf_threshold,
                    target_email=target_email
                )
                all_results.append(result)

                # Draw detections on the inference frame (which matches output size)
                annotated = self.draw_detections(inference_frame, result)
                out.write(annotated)

                processed_count += 1
                frame_idx += 1

                # Progress based on total frames (not just processed)
                if progress_callback and total_frames > 0:
                    progress_callback(frame_idx / total_frames)

                # Periodic garbage collection to free memory
                if processed_count % 10 == 0:
                    gc.collect()

        finally:
            cap.release()
            out.release()
            gc.collect()

        return all_results


def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decode base64 image string to OpenCV BGR frame."""
    # Remove data URL prefix if present
    if ',' in base64_str:
        base64_str = base64_str.split(',')[1]

    img_data = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_data, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    return frame


def encode_frame_to_base64(frame: np.ndarray, quality: int = 80) -> str:
    """Encode OpenCV BGR frame to base64 JPEG string."""
    _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    return base64.b64encode(buffer).decode('utf-8')