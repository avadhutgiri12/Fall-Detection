"""
FastAPI Backend for Fall Detection
Provides WebSocket for real-time detection and REST for video upload.
"""

import os
import uuid
import asyncio
import json
from pathlib import Path
from typing import Dict, Optional, List
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
from pydantic import BaseModel
from typing import List, Optional


# Global detector instance
detector: Optional[FallDetector] = None

# Job storage for video processing
video_jobs: Dict[str, VideoDetectionResult] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global detector
    model_path = os.getenv("MODEL_PATH", str(Path(__file__).parent / "yolov8n-pose.pt"))
    detector = FallDetector(model_path=model_path)
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


class DetectFrameResponse(BaseModel):
    """Response for single frame detection."""
    boxes: List[List[int]]
    scores: List[float]
    falls: List[bool]
    timestamp: float
    annotated_image: Optional[str] = None  # base64 JPEG with boxes drawn


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
        "active_jobs": len(video_jobs),
        "ws_connections": connection_manager.get_stats()
    }


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
async def cleanup_session(session_id: str):
    """Clean up all connections for a session."""
    closed = session_manager.cleanup_session(session_id)
    return {"session_id": session_id, "connections_closed": closed, "status": "cleaned"}


@app.get("/api/session/stats")
async def session_stats():
    """Get session statistics."""
    return session_manager.get_stats()


# ============================================================================
# WebSocket: Real-time Frame Detection
# ============================================================================

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time fall detection.

    Client sends: {"image": "base64_jpeg", "conf_threshold": 0.6}
    Server responds: {"boxes": [...], "scores": [...], "falls": [...], "timestamp": 1234567890}

    Query Parameters:
    - connection_id: Optional client-provided connection ID
    - session_id: Optional session ID for tracking
    """
    # Accept connection with connection manager
    connection_id = websocket.query_params.get("connection_id")
    session_id = websocket.query_params.get("session_id")
    success, assigned_connection_id = await connection_manager.connect(websocket, connection_id)

    if not success:
        await websocket.close(code=1013, reason="Maximum connections reached (10)")
        return

    await websocket.accept()

    # Register with session if provided
    if session_id:
        session_manager.register_connection(session_id, assigned_connection_id)

    print(f"✓ WebSocket client connected: {assigned_connection_id} (Total: {len(connection_manager.active_connections)}/{connection_manager.max_connections})")

    try:
        while True:
            # Receive frame from client
            data = await websocket.receive_text()
            message = json.loads(data)

            # Extract image and optional config
            image_b64 = message.get("image")
            conf_threshold = message.get("conf_threshold")

            if not image_b64:
                await websocket.send_json({"error": "Missing 'image' field"})
                continue

<<<<<<< HEAD
            # Update confidence threshold if provided (per-connection)
            if conf_threshold is not None and detector:
                detector.set_conf_threshold(conf_threshold)
                connection_manager.update_metadata(assigned_connection_id, conf_threshold=conf_threshold)
=======
            # Get per-session email (if session_id provided)
            session_email = None
            if session_id:
                session_email = session_manager.get_session_email(session_id)
>>>>>>> fixing-frame-issue

            # Decode and process frame
            try:
                frame = decode_base64_image(image_b64)
                if frame is None or frame.size == 0:
                    await websocket.send_json({"error": "Invalid image data"})
                    continue

                # Update frames sent counter
                connection_manager.update_metadata(assigned_connection_id, frames_sent=connection_manager.connection_metadata[assigned_connection_id]["frames_sent"] + 1)

<<<<<<< HEAD
                # Run detection
=======
                # Run detection with per-session config (stateless per-call)
>>>>>>> fixing-frame-issue
                if detector:
                    result = detector.detect_frame(
                        frame,
                        conf_threshold=conf_threshold,
                        target_email=session_email
                    )

                    # Update frames received counter
                    connection_manager.update_metadata(assigned_connection_id, frames_received=connection_manager.connection_metadata[assigned_connection_id]["frames_received"] + 1)

                    # Update frames received counter
                    connection_manager.update_metadata(assigned_connection_id, frames_received=connection_manager.connection_metadata[assigned_connection_id]["frames_received"] + 1)

                    # Send results back
                    await websocket.send_json({
                        "boxes": result.boxes,
                        "scores": result.scores,
                        "falls": result.falls,
                        "timestamp": result.timestamp,
                        "connection_id": assigned_connection_id
                    })
                else:
                    await websocket.send_json({"error": "Detector not initialized"})

            except Exception as e:
                await websocket.send_json({"error": f"Processing error: {str(e)}"})

    except WebSocketDisconnect:
        print(f"✓ WebSocket client disconnected: {assigned_connection_id}")
    except Exception as e:
        print(f"WebSocket error for {assigned_connection_id}: {e}")
        try:
            await websocket.close()
        except:
            pass
    finally:
        # Clean up connection
        if session_id:
            session_manager.unregister_connection(session_id, assigned_connection_id)
        connection_manager.disconnect(assigned_connection_id)
        print(f"✓ WebSocket cleaned up: {assigned_connection_id} (Remaining: {len(connection_manager.active_connections)})")


# ============================================================================
# REST: Single Frame Detection (alternative to WebSocket)
# ============================================================================

@app.post("/api/detect/frame", response_model=DetectFrameResponse)
async def detect_frame(request: DetectFrameRequest, session_id: str = Query(None)):
    """
    Detect falls in a single frame via REST.
    Use WebSocket (/ws/detect) for real-time streaming.
    """
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    # Get per-session email if session_id provided
    target_email = None
    if session_id:
        target_email = session_manager.get_session_email(session_id)
    else:
        target_email = detector.target_email

    try:
        frame = decode_base64_image(request.image)
        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid image data")

        result = detector.detect_frame(
            frame,
            conf_threshold=request.conf_threshold,
            target_email=target_email
        )

        # Optionally return annotated image
        annotated = detector.draw_detections(frame, result)
        annotated_b64 = encode_frame_to_base64(annotated)

        return DetectFrameResponse(
            boxes=result.boxes,
            scores=result.scores,
            falls=result.falls,
            timestamp=result.timestamp,
            annotated_image=annotated_b64
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Detection failed: {str(e)}")


# ============================================================================
# REST: Video Upload & Processing
# ============================================================================

@app.post("/api/detect/video", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    conf_threshold: float = Query(0.6, ge=0.0, le=1.0),
    frame_skip: int = Query(3, ge=1, le=10, description="Process every Nth frame (higher = faster, less memory)"),
    max_resolution: int = Query(640, ge=320, le=1280, description="Max width/height for inference"),
    session_id: str = Query(None, description="Session ID for per-session email config")
):
    """
    Upload video for fall detection processing.
    Returns job_id for polling status.
    """
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    # Validate file type
    allowed_types = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Unsupported video format. Use MP4, MOV, AVI, or MKV.")

    # Get per-session email if session_id provided
    target_email = None
    if session_id:
        target_email = session_manager.get_session_email(session_id)
    else:
        target_email = detector.target_email

    # Generate job ID
    job_id = str(uuid.uuid4())[:8]

    # Save uploaded file
    upload_dir = Path(__file__).parent / "uploads"
    upload_dir.mkdir(exist_ok=True)

    input_path = upload_dir / f"{job_id}_{file.filename}"
    output_path = upload_dir / f"{job_id}_annotated.mp4"

    try:
        content = await file.read()
        with open(input_path, "wb") as f:
            f.write(content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save upload: {str(e)}")

    # Create job record
    job = VideoDetectionResult(
        job_id=job_id,
        status="processing",
        progress=0.0
    )
    video_jobs[job_id] = job

    # Start background processing with memory optimization params
    asyncio.create_task(process_video_job(job_id, str(input_path), str(output_path), conf_threshold, frame_skip, max_resolution, target_email))

    return VideoUploadResponse(
        job_id=job_id,
        status="processing",
        message="Video uploaded. Processing started."
    )


async def process_video_job(job_id: str, input_path: str, output_path: str, conf_threshold: float, frame_skip: int = 3, max_resolution: int = 640, target_email: Optional[str] = None):
    """Background task to process video."""
    job = video_jobs.get(job_id)
    if not job or not detector:
        return

    def update_progress(progress: float):
        job.progress = progress

    try:
        # Run in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            detector.process_video,
            input_path,
            output_path,
            update_progress,
            frame_skip,
            max_resolution,
            True,  # half=True for FP16 inference
            target_email,
            conf_threshold
        )

        # Convert results to serializable format
        job.results = [
            {
                "boxes": r.boxes,
                "scores": r.scores,
                "falls": r.falls,
                "timestamp": r.timestamp
            }
            for r in results
        ]
        job.status = "completed"
        job.progress = 1.0
        job.output_video_path = output_path

        print(f"✓ Video job {job_id} completed: {len(results)} frames processed")

    except Exception as e:
        job.status = "failed"
        job.error = str(e)
        print(f"✗ Video job {job_id} failed: {e}")


@app.get("/api/detect/video/{job_id}", response_model=VideoStatusResponse)
async def get_video_status(job_id: str):
    """Get video processing status and results."""
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

@app.get("/api/config")
async def get_config():
    """Get current detector configuration."""
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    return {
        "conf_threshold": detector.conf_threshold,
        "target_email": detector.target_email,
        "model_path": detector.model_path
    }


# ============================================================================
# REST: Chunk Detection (for chunked video processing)
# ============================================================================

@app.post("/api/detect/chunk", response_model=ChunkFrameResponse)
<<<<<<< HEAD
async def detect_chunk(request: ChunkFrameRequest):
=======
async def detect_chunk(request: ChunkFrameRequest, session_id: str = Query(None)):
>>>>>>> fixing-frame-issue
    """
    Detect falls in multiple frames (chunk) via REST.
    Used for chunked video processing - client sends 10 frames at a time.
    """
<<<<<<< HEAD
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    if request.conf_threshold is not None:
        detector.set_conf_threshold(request.conf_threshold)

    import time
    start_time = time.time()

    try:
        results = []
        for i, image_b64 in enumerate(request.images):
            frame = decode_base64_image(image_b64)
            if frame is None or frame.size == 0:
                results.append({
                    "boxes": [],
                    "scores": [],
                    "falls": [],
                    "timestamp": request.timestamps[i] if i < len(request.timestamps) else time.time()
                })
                continue

            result = detector.detect_frame(frame)

            results.append({
                "boxes": result.boxes,
                "scores": result.scores,
                "falls": result.falls,
                "timestamp": result.timestamp
            })

        processing_time = time.time() - start_time

        return ChunkFrameResponse(
            chunk_index=request.chunk_index,
            results=results,
            processing_time=processing_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunk detection failed: {str(e)}")


@app.post("/api/config")
async def update_config(request: ConfigUpdateRequest):
    """Update detector configuration."""
=======
>>>>>>> fixing-frame-issue
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    # Get per-session email if session_id provided
    target_email = None
    if session_id:
        target_email = session_manager.get_session_email(session_id)
    else:
        target_email = detector.target_email

    import time
    start_time = time.time()

    try:
        results = []
        for i, image_b64 in enumerate(request.images):
            frame = decode_base64_image(image_b64)
            if frame is None or frame.size == 0:
                results.append({
                    "boxes": [],
                    "scores": [],
                    "falls": [],
                    "timestamp": request.timestamps[i] if i < len(request.timestamps) else time.time()
                })
                continue

            result = detector.detect_frame(
                frame,
                conf_threshold=request.conf_threshold,
                target_email=target_email
            )

            results.append({
                "boxes": result.boxes,
                "scores": result.scores,
                "falls": result.falls,
                "timestamp": result.timestamp
            })

        processing_time = time.time() - start_time

        return ChunkFrameResponse(
            chunk_index=request.chunk_index,
            results=results,
            processing_time=processing_time
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chunk detection failed: {str(e)}")


@app.post("/api/config")
async def update_config(request: ConfigUpdateRequest, session_id: str = Query(None)):
    """Update detector configuration (global or per-session)."""
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    # Update global threshold if provided
    if request.conf_threshold is not None:
        detector.set_conf_threshold(request.conf_threshold)

    # Update email - if session_id provided, store per-session; otherwise global
    if request.target_email is not None:
        if session_id:
            session_manager.update_session_email(session_id, request.target_email)
        else:
            detector.set_target_email(request.target_email)

    # Return current config (session-specific if session_id provided)
    target_email = detector.target_email
    if session_id:
        session_email = session_manager.get_session_email(session_id)
        if session_email:
            target_email = session_email

    return {
        "conf_threshold": detector.conf_threshold,
        "target_email": target_email,
        "message": "Configuration updated"
    }


@app.get("/api/config")
async def get_config(session_id: str = Query(None)):
    """Get current detector configuration (global or per-session)."""
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    target_email = detector.target_email
    if session_id:
        session_email = session_manager.get_session_email(session_id)
        if session_email:
            target_email = session_email

    return {
        "conf_threshold": detector.conf_threshold,
        "target_email": target_email,
        "model_path": detector.model_path
    }


# ============================================================================
# Main entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host=host, port=port, reload=True)