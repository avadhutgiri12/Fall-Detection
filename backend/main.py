"""
FastAPI Backend for Fall Detection
Provides WebSocket for real-time detection and REST for video upload.
"""

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

from detector import FallDetector, VideoDetectionResult, decode_base64_image, encode_frame_to_base64


# Global detector instance
detector: Optional[FallDetector] = None

# Job storage for video processing
video_jobs: Dict[str, VideoDetectionResult] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    global detector
    model_path = Path(__file__).parent / "yolov8n-pose.pt"
    detector = FallDetector(model_path=str(model_path))
    print(f"✓ FallDetector initialized with model: {model_path}")
    yield
    print("✓ Application shutdown")


app = FastAPI(
    title="Fall Detection API",
    description="Real-time fall detection using YOLOv8 Pose Estimation",
    version="1.0.0",
    lifespan=lifespan
)

# CORS for frontend (Next.js on port 3000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
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
# Health Check
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "model_loaded": detector is not None,
        "active_jobs": len(video_jobs)
    }


# ============================================================================
# WebSocket: Real-time Frame Detection
# ============================================================================

@app.websocket("/ws/detect")
async def websocket_detect(websocket: WebSocket):
    """
    WebSocket endpoint for real-time fall detection.

    Client sends: {"image": "base64_jpeg", "conf_threshold": 0.6}
    Server responds: {"boxes": [...], "scores": [...], "falls": [...], "timestamp": 1234567890}
    """
    await websocket.accept()
    print("✓ WebSocket client connected")

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

            # Update confidence threshold if provided
            if conf_threshold is not None and detector:
                detector.set_conf_threshold(conf_threshold)

            # Decode and process frame
            try:
                frame = decode_base64_image(image_b64)
                if frame is None or frame.size == 0:
                    await websocket.send_json({"error": "Invalid image data"})
                    continue

                # Run detection
                if detector:
                    result = detector.detect_frame(frame)

                    # Send results back
                    await websocket.send_json({
                        "boxes": result.boxes,
                        "scores": result.scores,
                        "falls": result.falls,
                        "timestamp": result.timestamp
                    })
                else:
                    await websocket.send_json({"error": "Detector not initialized"})

            except Exception as e:
                await websocket.send_json({"error": f"Processing error: {str(e)}"})

    except WebSocketDisconnect:
        print("✓ WebSocket client disconnected")
    except Exception as e:
        print(f"WebSocket error: {e}")
        try:
            await websocket.close()
        except:
            pass


# ============================================================================
# REST: Single Frame Detection (alternative to WebSocket)
# ============================================================================

@app.post("/api/detect/frame", response_model=DetectFrameResponse)
async def detect_frame(request: DetectFrameRequest):
    """
    Detect falls in a single frame via REST.
    Use WebSocket (/ws/detect) for real-time streaming.
    """
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    if request.conf_threshold is not None:
        detector.set_conf_threshold(request.conf_threshold)

    try:
        frame = decode_base64_image(request.image)
        if frame is None or frame.size == 0:
            raise HTTPException(status_code=400, detail="Invalid image data")

        result = detector.detect_frame(frame)

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
    conf_threshold: float = Query(0.6, ge=0.0, le=1.0)
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

    # Start background processing
    asyncio.create_task(process_video_job(job_id, str(input_path), str(output_path), conf_threshold))

    return VideoUploadResponse(
        job_id=job_id,
        status="processing",
        message="Video uploaded. Processing started."
    )


async def process_video_job(job_id: str, input_path: str, output_path: str, conf_threshold: float):
    """Background task to process video."""
    job = video_jobs.get(job_id)
    if not job or not detector:
        return

    def update_progress(progress: float):
        job.progress = progress

    try:
        detector.set_conf_threshold(conf_threshold)

        # Run in thread pool to avoid blocking event loop
        loop = asyncio.get_event_loop()
        results = await loop.run_in_executor(
            None,
            detector.process_video,
            input_path,
            output_path,
            update_progress
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
        "model_path": detector.model_path
    }


@app.post("/api/config")
async def update_config(request: ConfigUpdateRequest):
    """Update detector configuration."""
    if not detector:
        raise HTTPException(status_code=503, detail="Detector not initialized")

    if request.conf_threshold is not None:
        detector.set_conf_threshold(request.conf_threshold)

    # Note: target_email would need to be stored in detector for alerts
    # For now, we'll just acknowledge

    return {
        "conf_threshold": detector.conf_threshold,
        "message": "Configuration updated"
    }


# ============================================================================
# Main entry point
# ============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)