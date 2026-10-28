"""
FastAPI Backend for Fall Detection
Provides WebSocket for real-time detection and REST for video upload.
"""

import os
import uuid
import asyncio
import json
import time
from pathlib import Path
from typing import Any, Dict, Optional, List
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

from detector import FallDetector, VideoDetectionResult, decode_base64_image, encode_frame_to_base64
from connection_manager import connection_manager
from session_manager import session_manager
from email_alert_service import EmailAlertService, EmailConfig
from pydantic import BaseModel
from typing import List, Optional


# Global detector instance
detector: Optional[FallDetector] = None

# Global email alert service
email_alert_service: Optional[EmailAlertService] = None

# Job storage for video processing
video_jobs: Dict[str, VideoDetectionResult] = {}
video_job_created: Dict[str, float] = {}

# Finished jobs (and their annotated videos) are dropped after this many seconds,
# so results and files don't pile up for the life of the process.
VIDEO_JOB_TTL_SECONDS = int(os.getenv("VIDEO_JOB_TTL_SECONDS", "1800"))
# Uploads are streamed to disk instead of read into RAM, and capped in size.
MAX_UPLOAD_MB = int(os.getenv("MAX_UPLOAD_MB", "50"))
UPLOAD_CHUNK_BYTES = 1024 * 1024


def _purge_expired_video_jobs() -> None:
    """Remove finished video jobs older than the TTL and delete their files."""
    now = time.time()
    for job_id in list(video_jobs.keys()):
        job = video_jobs.get(job_id)
        created = video_job_created.get(job_id, now)
        if job is None or job.status == "processing":
            continue
        if now - created < VIDEO_JOB_TTL_SECONDS:
            continue
        if job.output_video_path:
            try:
                Path(job.output_video_path).unlink(missing_ok=True)
            except Exception:
                pass
        video_jobs.pop(job_id, None)
        video_job_created.pop(job_id, None)

# Shared capacity across all detection routes in this Python process.
# Configure with MAX_ACTIVE_SESSIONS=5 in your deployment environment.
MAX_ACTIVE_SESSIONS = max(1, int(os.getenv("MAX_ACTIVE_SESSIONS", "5")))


class ActiveWorkloadLimiter:
    """Atomically reserve up to N active detection workloads in this process."""

    def __init__(self, limit: int):
        self.limit = max(1, limit)
        self._active: Dict[str, Dict[str, str]] = {}
        self._lock = asyncio.Lock()

    async def acquire(self, kind: str, owner: Optional[str] = None) -> Optional[str]:
        async with self._lock:
            if len(self._active) >= self.limit:
                return None
            token = str(uuid.uuid4())
            self._active[token] = {
                "kind": kind,
                "owner": owner or "",
                "started_at": str(asyncio.get_running_loop().time()),
            }
            return token

    async def release(self, token: Optional[str]) -> None:
        if not token:
            return
        async with self._lock:
            self._active.pop(token, None)

    async def stats(self) -> Dict[str, Any]:
        async with self._lock:
            active = len(self._active)
            return {
                "active_workloads": active,
                "max_active_workloads": self.limit,
                "available_slots": max(0, self.limit - active),
                "workloads": [
                    {"kind": item["kind"], "owner": item["owner"]}
                    for item in self._active.values()
                ],
            }


workload_limiter = ActiveWorkloadLimiter(MAX_ACTIVE_SESSIONS)
video_job_slots: Dict[str, str] = {}


async def _disconnect_connection(connection_id: str) -> None:
    """Support synchronous or asynchronous ConnectionManager.disconnect methods."""
    result = connection_manager.disconnect(connection_id)
    if asyncio.iscoroutine(result):
        await result


async def _cleanup_session_connections(session_id: str) -> int:
    """Close and remove all WebSocket connections associated with a session."""
    connection_ids = session_manager.get_session_connections(session_id)
    closed_count = 0

    for connection_id in connection_ids:
        websocket = connection_manager.get_connection(connection_id)
        if websocket is not None:
            try:
                await websocket.close(code=1000, reason="Session ended")
            except Exception:
                pass
            await _disconnect_connection(connection_id)
            closed_count += 1
        session_manager.unregister_connection(session_id, connection_id)

    session_manager.session_connections.pop(session_id, None)
    session_manager.sessions.pop(session_id, None)
    return closed_count


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global detector, email_alert_service
    model_path = os.getenv("MODEL_PATH", str(Path(__file__).parent / "yolov8n-pose.pt"))

    # Initialize email alert service
    email_config = EmailConfig()
    email_alert_service = EmailAlertService(email_config)
    print(f"✓ EmailAlertService initialized (enabled: {email_config.enabled})")

    # Initialize detector with email alert service
    detector = FallDetector(model_path=model_path, email_alert_service=email_alert_service)
    detector.warmup()
    print(f"✓ FallDetector initialized with model: {model_path}")
    yield
    print("✓ Application shutdown")


app = FastAPI(
    title="Fall Detection API",
    description="Real-time fall detection using YOLOv8 Pose Estimation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS configuration from environment
cors_origins = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",")

# For development, add common local origins
dev_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:8000",
    "http://127.0.0.1:8000",
]

# Allow all origins in development if explicitly enabled
if os.getenv("ALLOW_ALL_ORIGINS", "false").lower() == "true":
    cors_origins = ["*"]
    allow_credentials = False
else:
    # Combine and deduplicate
    cors_origins = list(dict.fromkeys([*cors_origins, *dev_origins]))
    allow_credentials = True

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in cors_origins],
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================================
# Request/Response Models
# ============================================================================

class DetectFrameRequest(BaseModel):
    """Request for single frame detection via REST (alternative to WS)."""
    image: str  # base64 encoded JPEG
    conf_threshold: Optional[float] = None


class EmailAlertResult(BaseModel):
    """Email alert result."""
    sent: bool
    reason: str
    timestamp: float
    target_email: str


class DetectFrameResponse(BaseModel):
    """Response for single frame detection."""
    boxes: List[List[int]]
    scores: List[float]
    falls: List[bool]
    timestamp: float
    annotated_image: Optional[str] = None  # base64 JPEG with boxes drawn
    email_alert_result: Optional[EmailAlertResult] = None


class VideoUploadResponse(BaseModel):
    """Response for video upload initiation."""
    job_id: str
    status: str
    message: str


class VideoStatusResponse(BaseModel):
    """Response for video processing status."""
    job_id: str
    status: str
    progress: float
    results: Optional[List[dict]] = None
    error: Optional[str] = None
    download_url: Optional[str] = None


class ConfigUpdateRequest(BaseModel):
    """Request to update detector configuration."""
    conf_threshold: Optional[float] = None
    target_email: Optional[str] = None


class SessionCleanupRequest(BaseModel):
    """Request to clean up a session."""
    session_id: str


# ============================================================================
# Request/Response Models for Chunk Detection
# ============================================================================

class ChunkFrameRequest(BaseModel):
    """Request for chunk detection via REST."""
    images: List[str]  # List of base64 encoded JPEGs
    conf_threshold: Optional[float] = None
    chunk_index: int
    frame_indices: List[int]
    timestamps: List[float]


class ChunkFrameResponse(BaseModel):
    """Response for chunk detection."""
    chunk_index: int
    results: List[dict]  # Each result: {boxes, scores, falls, timestamp}
    processing_time: float


# ============================================================================
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": detector is not None,
        "active_jobs": sum(1 for job in video_jobs.values() if job.status == "processing"),
        "ws_connections": connection_manager.get_stats(),
        "workload_capacity": await workload_limiter.stats(),
    }


@app.get("/api/workload/stats")
async def workload_stats():
    """Show current shared detection capacity usage."""
    return await workload_limiter.stats()


@app.get("/api/ws/stats")
async def ws_stats():
    """Get WebSocket connection statistics."""
    return connection_manager.get_stats()


@app.post("/api/session/register")
async def register_session(session_id: str = None):
    """Register a new session or get existing session."""
    sid = session_manager.create_session(session_id)
    return {"session_id": sid, "status": "registered"}


@app.post("/api/session/cleanup")
async def cleanup_session(request: SessionCleanupRequest):
    """Clean up all connections and the session record."""
    closed = await _cleanup_session_connections(request.session_id)
    return {"session_id": request.session_id, "connections_closed": closed, "status": "cleaned"}


@app.get("/api/session/stats")
async def session_stats():
    """Get session statistics."""
    return session_manager.get_stats()


# ============================================================================
# WebSocket: Real-time Frame Detection
# ============================================================================

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """Real-time fall detection using a shared workload slot."""
    await websocket.accept()

    session_id = websocket.query_params.get("session_id")
    requested_connection_id = websocket.query_params.get("connection_id")

    workload_token = await workload_limiter.acquire("websocket", session_id or "")
    if workload_token is None:
        await websocket.send_json({
            "error": f"Maximum of {MAX_ACTIVE_SESSIONS} active detection workloads reached. Try again later.",
            "code": "CAPACITY_LIMIT_REACHED",
            "max_active_sessions": MAX_ACTIVE_SESSIONS,
        })
        await websocket.close(code=1013, reason="Detection capacity reached")
        return

    assigned_connection_id = ""
    registered_session = False

    try:
        success, assigned_connection_id = await connection_manager.connect(
            websocket, requested_connection_id
        )
        if not success:
            await websocket.send_json({
                "error": "WebSocket connection capacity reached. Try again later.",
                "code": "WEBSOCKET_CAPACITY_REACHED",
            })
            await websocket.close(code=1013, reason="WebSocket capacity reached")
            return

        if session_id:
            # Ensure session exists (create if not registered via REST yet)
            # Use returned session_id in case create_session generates a new one
            actual_session_id = session_manager.create_session(session_id)
            registered_session = session_manager.register_connection(
                actual_session_id, assigned_connection_id
            )
            # Use actual_session_id for subsequent operations
            session_id = actual_session_id

        print(f"WebSocket connected: {assigned_connection_id}")

        while True:
            data = await websocket.receive_text()
            try:
                message = json.loads(data)
            except json.JSONDecodeError:
                await websocket.send_json({"error": "Invalid JSON message"})
                continue

            image_b64 = message.get("image")
            conf_threshold = message.get("conf_threshold")
            if not image_b64:
                await websocket.send_json({"error": "Missing 'image' field"})
                continue

            session_email = session_manager.get_session_email(session_id) if session_id else None

            try:
                frame = decode_base64_image(image_b64)
                if frame is None or frame.size == 0:
                    await websocket.send_json({"error": "Invalid image data"})
                    continue

                metadata = connection_manager.get_metadata(assigned_connection_id) or {}
                connection_manager.update_metadata(
                    assigned_connection_id,
                    frames_sent=metadata.get("frames_sent", 0) + 1,
                )

                if detector is None:
                    await websocket.send_json({"error": "Detector not initialized"})
                    continue

                # Prepare metadata for email alert
                frame_index = metadata.get("frames_sent", 0)
                email_metadata = {
                    "frame_index": frame_index,
                    "connection_id": assigned_connection_id,
                    "timestamp": time.time(),
                }

                result = await asyncio.to_thread(
                    detector.detect_frame,
                    frame,
                    conf_threshold=conf_threshold,
                    target_email=session_email,
                    session_id=session_id,
                    detection_type="webcam",
                    metadata=email_metadata,
                )

                metadata = connection_manager.get_metadata(assigned_connection_id) or {}
                connection_manager.update_metadata(
                    assigned_connection_id,
                    frames_received=metadata.get("frames_received", 0) + 1,
                )

                # Include email alert result in response
                email_alert_data = None
                if result.email_alert_result:
                    email_alert_data = {
                        "sent": result.email_alert_result.sent,
                        "reason": result.email_alert_result.reason,
                        "timestamp": result.email_alert_result.timestamp,
                        "target_email": result.email_alert_result.target_email,
                    }

                await websocket.send_json({
                    "boxes": result.boxes,
                    "scores": result.scores,
                    "falls": result.falls,
                    "timestamp": result.timestamp,
                    "connection_id": assigned_connection_id,
                    "email_sent": result.email_sent,
                    "email_alert_result": email_alert_data,
                })
            except Exception as exc:
                try:
                    await websocket.send_json({"error": f"Processing error: {str(exc)}"})
                except Exception:
                    break

    except WebSocketDisconnect:
        print(f"WebSocket disconnected: {assigned_connection_id or 'unassigned'}")
    except Exception as exc:
        print(f"WebSocket error: {exc}")
        try:
            await websocket.close()
        except Exception:
            pass
    finally:
        if assigned_connection_id:
            if registered_session and session_id:
                session_manager.unregister_connection(session_id, assigned_connection_id)
            await _disconnect_connection(assigned_connection_id)
        await workload_limiter.release(workload_token)


# ============================================================================
# REST: Single Frame Detection (alternative to WebSocket)
# ============================================================================

@app.post("/api/detect/frame", response_model=DetectFrameResponse)
async def detect_frame(request: DetectFrameRequest, session_id: str = Query(None)):
    """Detect one frame via REST, respecting shared detection capacity."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    workload_token = await workload_limiter.acquire("frame", session_id or "")
    if workload_token is None:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum of {MAX_ACTIVE_SESSIONS} active detection workloads reached. Try again later.",
        )

    try:
        target_email = session_manager.get_session_email(session_id) if session_id else None
        frame = decode_base64_image(request.image)
        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid image data")

        # Prepare metadata for email alert
        email_metadata = {
            "timestamp": time.time(),
        }

        result = await asyncio.to_thread(
            detector.detect_frame,
            frame,
            conf_threshold=request.conf_threshold,
            target_email=target_email,
            session_id=session_id,
            detection_type="frame",
            metadata=email_metadata,
        )
        annotated = await asyncio.to_thread(detector.draw_detections, frame, result)

        # Include email alert result in response
        email_alert_data = None
        if result.email_alert_result:
            email_alert_data = EmailAlertResult(
                sent=result.email_alert_result.sent,
                reason=result.email_alert_result.reason,
                timestamp=result.email_alert_result.timestamp,
                target_email=result.email_alert_result.target_email,
            )

        return DetectFrameResponse(
            boxes=result.boxes,
            scores=result.scores,
            falls=result.falls,
            timestamp=result.timestamp,
            annotated_image=encode_frame_to_base64(annotated),
            email_alert_result=email_alert_data,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(exc)}")
    finally:
        await workload_limiter.release(workload_token)


# ============================================================================
# REST: Video Upload & Processing
# ============================================================================

@app.post("/api/detect/video", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    conf_threshold: float = Query(0.6, ge=0.0, le=1.0),
    frame_skip: int = Query(3, ge=1, le=10, description="Process every Nth frame"),
    max_resolution: int = Query(640, ge=320, le=1280, description="Max inference dimension"),
    session_id: str = Query(None, description="Session ID for per-session email config"),
):
    """Upload a video and reserve capacity until processing completes."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    allowed_types = {
        "video/mp4", "video/quicktime", "video/x-msvideo",
        "video/x-matroska", "application/octet-stream",
    }
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported video format. Use MP4, MOV, AVI, or MKV.")

    _purge_expired_video_jobs()

    workload_token = await workload_limiter.acquire("video", session_id or "")
    if workload_token is None:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum of {MAX_ACTIVE_SESSIONS} active detection workloads reached. Try again later.",
        )

    job_id = str(uuid.uuid4())[:8]
    upload_dir = Path(__file__).parent / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    safe_filename = Path(file.filename or "uploaded_video.mp4").name
    input_path = upload_dir / f"{job_id}_{safe_filename}"
    output_path = upload_dir / f"{job_id}_annotated.mp4"

    try:
        # Stream to disk in 1 MB chunks rather than loading the whole video into RAM.
        max_bytes = MAX_UPLOAD_MB * 1024 * 1024
        written = 0
        with open(input_path, "wb") as output_file:
            while True:
                chunk = await file.read(UPLOAD_CHUNK_BYTES)
                if not chunk:
                    break
                written += len(chunk)
                if written > max_bytes:
                    raise HTTPException(
                        status_code=413,
                        detail=f"Video is larger than {MAX_UPLOAD_MB} MB.",
                    )
                output_file.write(chunk)
        if written == 0:
            raise HTTPException(status_code=400, detail="Uploaded video is empty")

        target_email = session_manager.get_session_email(session_id) if session_id else None
        video_jobs[job_id] = VideoDetectionResult(job_id=job_id, status="processing", progress=0.0)
        video_job_created[job_id] = time.time()
        video_job_slots[job_id] = workload_token

        asyncio.create_task(process_video_job(
            job_id, str(input_path), str(output_path), conf_threshold,
            frame_skip, max_resolution, target_email, session_id,
        ))
        # The background job now owns this slot.
        workload_token = None

        return VideoUploadResponse(
            job_id=job_id,
            status="processing",
            message="Video uploaded. Processing started.",
        )
    except HTTPException:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise
    except Exception as exc:
        try:
            input_path.unlink(missing_ok=True)
        except Exception:
            pass
        raise HTTPException(status_code=500, detail=f"Failed to start video processing: {str(exc)}")
    finally:
        # Release only if the background task did not take ownership.
        await workload_limiter.release(workload_token)


async def process_video_job(
    job_id: str,
    input_path: str,
    output_path: str,
    conf_threshold: float,
    frame_skip: int = 3,
    max_resolution: int = 640,
    target_email: Optional[str] = None,
    session_id: Optional[str] = None,
):
    """Process a video job and release its reserved slot on every exit path."""
    job = video_jobs.get(job_id)
    slot_token = video_job_slots.get(job_id)

    try:
        if job is None:
            return
        if detector is None:
            job.status = "failed"
            job.error = "Detector not initialized"
            return

        def update_progress(progress: float):
            job.progress = progress

        loop = asyncio.get_running_loop()
        results = await loop.run_in_executor(
            None,
            detector.process_video,
            input_path,
            output_path,
            update_progress,
            frame_skip,
            max_resolution,
            True,
            target_email,
            conf_threshold,
            session_id,
            "video_upload",
        )

        job.results = [
            {"boxes": result.boxes, "scores": result.scores, "falls": result.falls, "timestamp": result.timestamp}
            for result in results
        ]
        job.status = "completed"
        job.progress = 1.0
        job.output_video_path = output_path
        print(f"Video job {job_id} completed: {len(results)} frames processed")

    except Exception as exc:
        if job is not None:
            job.status = "failed"
            job.error = str(exc)
        print(f"Video job {job_id} failed: {exc}")

    finally:
        await workload_limiter.release(slot_token)
        video_job_slots.pop(job_id, None)
        current_job = video_jobs.get(job_id)
        if current_job is None or current_job.status != "completed":
            try:
                Path(output_path).unlink(missing_ok=True)
            except Exception:
                pass
        try:
            Path(input_path).unlink(missing_ok=True)
        except Exception:
            pass


@app.get("/api/detect/video/{job_id}", response_model=VideoStatusResponse)
async def get_video_status(job_id: str):
    """Get video processing status and results."""
    _purge_expired_video_jobs()
    job = video_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    download_url = None
    if job.status == "completed" and job.output_video_path:
        download_url = f"/api/detect/video/{job_id}/download"

    return VideoStatusResponse(
        job_id=job.job_id,
        status=job.status,
        progress=job.progress,
        results=job.results,
        error=job.error,
        download_url=download_url
    )


@app.get("/api/detect/video/{job_id}/download")
async def download_processed_video(job_id: str):
    """Download annotated video file."""
    job = video_jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job.status != "completed" or not job.output_video_path:
        raise HTTPException(status_code=400, detail="Video not ready for download")

    output_path = Path(job.output_video_path)
    if not output_path.exists():
        raise HTTPException(status_code=404, detail="Output file not found")

    return FileResponse(
        path=str(output_path),
        filename=f"fall_detection_{job_id}_annotated.mp4",
        media_type="video/mp4"
    )


# ============================================================================
# Configuration
# ============================================================================

# ============================================================================
# REST: Chunk Detection (for chunked video processing)
# ============================================================================

@app.post("/api/detect/chunk", response_model=ChunkFrameResponse)
async def detect_chunk(request: ChunkFrameRequest, session_id: str = Query(None)):
    """Detect a chunk of frames while respecting shared workload capacity."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    workload_token = await workload_limiter.acquire("chunk", session_id or "")
    if workload_token is None:
        raise HTTPException(
            status_code=429,
            detail=f"Maximum of {MAX_ACTIVE_SESSIONS} active detection workloads reached. Try again later.",
        )

    start_time = time.time()
    try:
        target_email = session_manager.get_session_email(session_id) if session_id else None
        results = []
        for index, image_b64 in enumerate(request.images):
            frame = decode_base64_image(image_b64)
            timestamp = request.timestamps[index] if index < len(request.timestamps) else time.time()
            if frame is None or frame.size == 0:
                results.append({"boxes": [], "scores": [], "falls": [], "timestamp": timestamp})
                continue

            frame_index = request.frame_indices[index] if index < len(request.frame_indices) else index
            email_metadata = {
                "frame_index": frame_index,
                "chunk_index": request.chunk_index,
                "timestamp": timestamp,
            }

            result = await asyncio.to_thread(
                detector.detect_frame,
                frame,
                conf_threshold=request.conf_threshold,
                target_email=target_email,
                session_id=session_id,
                detection_type="video_chunk",
                metadata=email_metadata,
            )

            frame_result = {
                "boxes": result.boxes,
                "scores": result.scores,
                "falls": result.falls,
                "timestamp": result.timestamp,
            }

            # Include email alert result if available
            if result.email_alert_result:
                frame_result["email_alert_result"] = {
                    "sent": result.email_alert_result.sent,
                    "reason": result.email_alert_result.reason,
                    "timestamp": result.email_alert_result.timestamp,
                    "target_email": result.email_alert_result.target_email,
                }

            results.append(frame_result)

        return ChunkFrameResponse(
            chunk_index=request.chunk_index,
            results=results,
            processing_time=time.time() - start_time,
        )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Chunk detection failed: {str(exc)}")
    finally:
        await workload_limiter.release(workload_token)


@app.post("/api/config")
async def update_config(request: ConfigUpdateRequest, session_id: str = Query(None)):
    """Update detector configuration globally or for one registered session.

    A session's email is stored and returned independently from the global default.
    This prevents a placeholder/default address from being reported as a session's
    configured recipient when that session has not saved an email.
    """
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    # Validate a provided session before attempting to store session-specific config.
    if session_id and session_id not in session_manager.sessions:
        raise HTTPException(
            status_code=404,
            detail="Session not found. Register the session before configuring its email.",
        )

    if request.conf_threshold is not None:
        if not 0.0 <= request.conf_threshold <= 1.0:
            raise HTTPException(status_code=422, detail="conf_threshold must be between 0 and 1")
        detector.set_conf_threshold(request.conf_threshold)

    if request.target_email is not None:
        normalized_email = request.target_email.strip().lower()
        if not normalized_email or "@" not in normalized_email or "." not in normalized_email.rsplit("@", 1)[-1]:
            raise HTTPException(status_code=422, detail="Please provide a valid target_email address")

        if session_id:
            # Do not silently ignore a failed per-session update.
            updated = session_manager.update_session_email(session_id, normalized_email)
            if updated is False:
                raise HTTPException(status_code=500, detail="Could not save email for this session")

            stored_email = session_manager.get_session_email(session_id)
            if not stored_email or stored_email.strip().lower() != normalized_email:
                raise HTTPException(status_code=500, detail="Email was not saved correctly for this session")
        else:
            if email_alert_service is None:
                raise HTTPException(status_code=503, detail="Email alert service not initialized")
            email_alert_service.config.default_target_email = normalized_email

    if session_id:
        # Never fall back to the global default for a session-specific response.
        target_email = session_manager.get_session_email(session_id)
    else:
        target_email = (
            email_alert_service.config.default_target_email
            if email_alert_service is not None
            else None
        )

    return {
        "success": True,
        "conf_threshold": detector.conf_threshold,
        "target_email": target_email,
        "session_id": session_id,
        "message": "Configuration updated",
    }


@app.get("/api/config")
async def get_config(session_id: str = Query(None)):
    """Get current configuration without mixing global and session email settings."""
    if detector is None:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    if session_id:
        if session_id not in session_manager.sessions:
            raise HTTPException(status_code=404, detail="Session not found. Register the session first.")
        # This can legitimately be None when the session has not configured an email.
        target_email = session_manager.get_session_email(session_id)
    else:
        target_email = (
            email_alert_service.config.default_target_email
            if email_alert_service is not None
            else None
        )

    return {
        "conf_threshold": detector.conf_threshold,
        "target_email": target_email,
        "model_path": detector.model_path,
        "session_id": session_id,
        "email_configured": bool(target_email),
    }


# ============================================================================
# Main entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=True)