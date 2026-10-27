"""
Fall Detection Core Logic
Extracted from Streamlit app for reuse in FastAPI backend.
"""

import os
import cv2
import time
import base64
import numpy as np
from ultralytics import YOLO
from dataclasses import dataclass
from typing import List, Optional
import threading
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import email alert service
from email_alert_service import EmailAlertService, EmailConfig, EmailAlertResult


@dataclass
class DetectionResult:
    """Single frame detection result."""
    boxes: List[List[int]]  # [x1, y1, x2, y2]
    scores: List[float]
    falls: List[bool]
    timestamp: float
    email_sent: bool = False  # Whether fall alert email was successfully sent
    email_alert_result: Optional[EmailAlertResult] = None  # Detailed email alert result


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
        email_alert_service: Optional[EmailAlertService] = None,
    ):
        # Use environment variables as defaults, with fallbacks for local development
        self.model_path = model_path or os.getenv("MODEL_PATH", "yolov8n-pose.pt")
        self.conf_threshold = conf_threshold if conf_threshold is not None else float(os.getenv("CONF_THRESHOLD", "0.6"))
        self._model: Optional[YOLO] = None
        self.email_alert_service = email_alert_service

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
        target_email: Optional[str] = None,
        session_id: Optional[str] = None,
        detection_type: str = "unknown",
        metadata: Optional[dict] = None,
    ) -> DetectionResult:
        """
        Run detection on a single frame.

        Args:
            frame: BGR image as numpy array
            half: Use FP16 half-precision inference (reduces memory usage)
            conf_threshold: Override confidence threshold for this frame (uses instance default if None)
            target_email: Email to send fall alerts to (used by email_alert_service if provided)
            session_id: Session ID for per-session rate limiting
            detection_type: Type of detection for email template (webcam, video_upload, video_chunk)
            metadata: Additional context for email (frame_index, timestamp, etc.)

        Returns:
            DetectionResult with boxes, scores, fall flags, and email alert result
        """
        # Use provided threshold or fall back to instance default
        threshold = conf_threshold if conf_threshold is not None else self.conf_threshold

        results = self.model(frame, verbose=False, half=half)

        boxes = []
        scores = []
        falls = []
        email_sent = False
        email_alert_result = None

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

                    # Send alert if fall detected and email service is available
                    if is_fall and self.email_alert_service and session_id:
                        if not target_email or not target_email.strip():
                            print(
                                f"[FallDetector] Alert skipped: no target email for "
                                f"session {session_id}"
                            )
                            continue

                        email_alert_result = self.email_alert_service.send_fall_alert(
                            session_id=session_id,
                            fall_score=score,
                            detection_type=detection_type,
                            target_email=target_email.strip(),
                            metadata=metadata,
                        )

                        email_sent = email_alert_result.sent

                        if not email_sent:
                            print(
                                f"[FallDetector] Email alert failed for session {session_id}: "
                                f"{email_alert_result.reason}"
                            )

        return DetectionResult(
            boxes=boxes,
            scores=scores,
            falls=falls,
            timestamp=time.time(),
            email_sent=email_sent,
            email_alert_result=email_alert_result,
        )

    def process_video(
        self,
        input_path: str,
        output_path: str,
        progress_callback=None,
        frame_skip: int = 1,
        max_resolution: int = 640,
        half: bool = True,
        target_email: Optional[str] = None,
        conf_threshold: Optional[float] = None,
        session_id: Optional[str] = None,
        detection_type: str = "video_upload",
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
            target_email: Email to send fall alerts to (uses email_alert_service if provided)
            conf_threshold: Override confidence threshold (uses instance default if None)
            session_id: Session ID for per-session rate limiting
            detection_type: Type of detection for email template

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
                metadata = {
                    "frame_index": frame_idx,
                    "total_frames": total_frames,
                    "video_path": input_path,
                }
                result = self.detect_frame(
                    inference_frame,
                    half=half,
                    conf_threshold=conf_threshold,
                    target_email=target_email,
                    session_id=session_id,
                    detection_type=detection_type,
                    metadata=metadata,
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