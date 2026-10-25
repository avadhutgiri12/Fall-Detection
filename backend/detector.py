"""
Fall Detection Core Logic
Extracted from Streamlit app for reuse in FastAPI backend.
"""

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
from pathlib import Path


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
        model_path: str = "yolov8n-pose.pt",
        conf_threshold: float = 0.6,
        sender_email: str = "avadhutgiri143@gmail.com",
        sender_pass: str = "svvp omtr jzhl jdzc",
    ):
        self.model_path = model_path
        self.conf_threshold = conf_threshold
        self.sender_email = sender_email
        self.sender_pass = sender_pass
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

    def detect_frame(self, frame: np.ndarray) -> DetectionResult:
        """
        Run detection on a single frame.

        Args:
            frame: BGR image as numpy array

        Returns:
            DetectionResult with boxes, scores, fall flags
        """
        results = self.model(frame, verbose=False)

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
                    is_fall = score > self.conf_threshold and w > h

                    boxes.append([x1, y1, x2, y2])
                    scores.append(score)
                    falls.append(is_fall)

                    # Send alert if fall detected (rate limited)
                    if is_fall:
                        self._maybe_send_alert(score)

        return DetectionResult(
            boxes=boxes,
            scores=scores,
            falls=falls,
            timestamp=time.time()
        )

    def _maybe_send_alert(self, score: float):
        """Send email alert with rate limiting (1 per minute)."""
        with self._alert_lock:
            now = time.time()
            if now - self._last_alert_time > 60:
                if self._send_alert(score):
                    self._last_alert_time = now

    def _send_alert(self, score: float, target_email: str = "your-email@example.com") -> bool:
        """Send fall alert email."""
        try:
            msg = EmailMessage()
            msg['Subject'] = "🚨 FALL ALERT: Room 101"
            msg['From'] = self.sender_email
            msg['To'] = target_email
            msg.set_content(f"System detected a fall with {score:.2%} confidence. Immediate check required.")

            with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
                smtp.login(self.sender_email, self.sender_pass)
                smtp.send_message(msg)
            return True
        except Exception:
            return False

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
        progress_callback=None
    ) -> List[DetectionResult]:
        """
        Process entire video file and save annotated output.

        Args:
            input_path: Path to input video
            output_path: Path to save annotated video
            progress_callback: Optional function(progress: float) called during processing

        Returns:
            List of DetectionResult per frame
        """
        cap = cv2.VideoCapture(input_path)
        if not cap.isOpened():
            raise ValueError(f"Could not open video: {input_path}")

        fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

        fourcc = cv2.VideoWriter_fourcc(*'mp4v')
        out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

        all_results = []
        frame_idx = 0

        try:
            while True:
                ret, frame = cap.read()
                if not ret:
                    break

                result = self.detect_frame(frame)
                all_results.append(result)

                annotated = self.draw_detections(frame, result)
                out.write(annotated)

                frame_idx += 1
                if progress_callback and total_frames > 0:
                    progress_callback(frame_idx / total_frames)

        finally:
            cap.release()
            out.release()

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