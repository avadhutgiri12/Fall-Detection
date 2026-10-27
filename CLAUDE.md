# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fall Detection Web Application - A multi-page Next.js 16 application with a modern, data-driven architecture for a fall detection system marketing website, plus a FastAPI backend for real-time AI inference.

**Tech Stack:**
- **Frontend**: Next.js 16.4.3 (App Router, React 19.3.0), Tailwind CSS v4, TypeScript (strict mode), GSAP 3.15.0 + ScrollTrigger
- **Backend**: FastAPI, YOLOv8n-pose (ultralytics), WebSocket + REST endpoints
- **Storage**: IndexedDB for client-side video chunk caching
- **Fonts**: Geist Sans/Mono

## Development Commands

```bash
# Frontend
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build (static export)
npm run start        # Start production server
npm run lint         # Run ESLint

# Backend (run from backend/ directory)
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

## Project Structure

```
falldetection/
├── app/                    # Next.js App Router pages
│   ├── layout.tsx         # Root layout with Navbar + Footer wrapper
│   ├── page.tsx           # Home page (all sections: Hero, About, HowItWorks, Contact)
│   ├── about/page.tsx     # About page
│   ├── how-it-works/page.tsx
│   ├── contact/page.tsx
│   ├── canvas/page.tsx    # Interactive canvas/demo page
│   └── globals.css        # Global styles, CSS variables, theme, animations
├── components/
│   ├── Hero.tsx           # Hero section with entrance animations
│   ├── About.tsx          # About section with feature cards
│   ├── HowItWorks.tsx     # 3-step process with connector lines
│   ├── Contact.tsx        # Contact form with validation
│   ├── Canvas.tsx         # Interactive demo/visualization page
│   ├── Footer.tsx         # Site footer with navigation/social
│   ├── index.ts           # Barrel exports
│   └── ui/                # Reusable UI primitives
│       ├── Button.tsx     # Variants: primary, secondary, outline, ghost, fancy
│       ├── Card.tsx       # Card + CardHeader/Title/Description/Content/Footer
│       ├── Input.tsx      # Input, Textarea, Label with validation states
│       ├── Overlay.tsx    # Overlay, Modal, Drawer with focus trap
│       ├── Container.tsx  # Container, Section, Grid, Flex, Stack
│       ├── Section.tsx    # SectionWrapper, SectionHeader
│       ├── Navbar.tsx     # Top-fixed nav with GSAP active-state transitions
│       ├── CanvasButton.tsx  # Animated button with canvas effects
│       ├── ToastProvider.tsx # Toast notification system
│       ├── ErrorChecker.tsx  # Debug panel for error tracking
│       ├── WebcamDetector.tsx  # Real-time webcam fall detection
│       └── VideoUploadDetector.tsx  # Chunked video upload & analysis
├── components/hooks/      # Custom React hooks
│   ├── useFallDetection.ts    # WebSocket-based real-time detection
│   ├── useVideoChunking.ts    # Client-side video chunking & processing
│   ├── useVideoCache.ts       # IndexedDB cache for video chunks/sessions
│   ├── useErrorTracker.ts     # Error tracking with sessionStorage persistence
│   └── useCamera.ts           # Camera stream management
├── data/
│   ├── content.ts         # All text content (hero, about, how-it-works, contact, canvas, footer, ui)
│   ├── images.ts          # Image paths and alt texts
│   └── animations.ts      # GSAP configs, presets, scroll triggers
├── public/                # Static assets
└── backend/               # FastAPI Backend
    ├── main.py            # FastAPI app, endpoints, lifespan
    ├── detector.py        # FallDetector class (YOLOv8n-pose, stateless detection)
    ├── connection_manager.py  # WebSocket connection pooling (max 10)
    ├── session_manager.py # Session tracking, per-session email config
    ├── fall_detection.py  # Legacy Streamlit app (reference)
    └── requirements.txt   # Python dependencies
```

## Backend Architecture

### Core Components

**`main.py`** - FastAPI application with:
- **Lifespan**: Loads YOLO model on startup
- **Connection Manager**: Global `ConnectionManager` (max 10 WS connections)
- **Session Manager**: Global `SessionManager` for per-session state
- **Video Jobs**: In-memory job storage for full-video processing

**Endpoints:**
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/ws/stats` | GET | WebSocket connection stats |
| `/api/session/register` | POST | Register new session |
| `/api/session/cleanup` | POST | Clean up session (called via sendBeacon on unload) |
| `/api/session/stats` | GET | Session statistics |
| `/ws/detect` | WS | Real-time frame detection (`?session_id=xxx&connection_id=xxx`) |
| `/api/detect/frame` | POST | Single frame detection (REST) |
| `/api/detect/video` | POST | Upload full video for processing |
| `/api/detect/video/{job_id}` | GET | Poll video job status |
| `/api/detect/video/{job_id}/download` | GET | Download annotated video |
| `/api/detect/chunk` | POST | Process chunk of frames (10 frames) |
| `/api/config` | GET/POST | Get/set detector config (per-session via `?session_id=`) |

**`detector.py`** - `FallDetector` class:
- **Stateless detection**: `detect_frame(frame, conf_threshold?, target_email?)` - no instance state mutation
- **Email alerts**: Rate-limited (1/min), uses passed `target_email` or instance default
- **Video processing**: `process_video()` with FP16 half-precision, progress callback, frame skipping
- **Model**: YOLOv8n-pose, lazy-loaded

**`connection_manager.py`** - `ConnectionManager`:
- Max 10 concurrent WebSocket connections
- Per-connection metadata (conf_threshold, frame counters, timestamps)
- Thread-safe with `asyncio.Lock`

**`session_manager.py`** - `SessionManager`:
- Session lifecycle: create, register WS connections, cleanup
- Per-session `target_email` for fall alerts
- Stale session cleanup (1hr default)
- Session stats endpoint

### Key Backend Patterns

1. **Per-session email config**: Email stored in `SessionManager`, not global detector
2. **Stateless detector**: `detect_frame()` accepts config per-call, no shared mutable state
3. **Connection pooling**: `ConnectionManager` enforces 10-connection limit
4. **Session cleanup**: Frontend calls `/api/session/cleanup` via `sendBeacon` on page unload

## Frontend Architecture

### Detection Components

**`WebcamDetector.tsx`** - Real-time webcam fall detection:
- Uses `useCamera` + `useFallDetection` hooks
- Session ID generated/stored in `sessionStorage`
- WebSocket URL includes `?session_id=`
- Registers session on mount, cleans up via `sendBeacon` on unmount
- Email config via `/api/config?session_id=`

**`VideoUploadDetector.tsx`** - Chunked video analysis:
- Uses `useVideoChunking` + `useVideoCache` hooks
- Client-side frame extraction (canvas), sends 10-frame chunks
- Supports WebSocket or REST for chunk processing
- Results cached in IndexedDB, aggregated for final summary
- Fall detection toasts + email sent toasts (deduplicated)
- Session ID shared with WebcamDetector via `sessionStorage`

### Custom Hooks

**`useFallDetection.ts`** - WebSocket real-time detection:
- Manages WS lifecycle: connect, reconnect (with `intentionalCloseRef` guard), cleanup
- Frame capture loop: 10 FPS max, `requestAnimationFrame`, canvas→blob→base64
- `wsReadyRef` prevents sending before WS OPEN
- Returns: `isDetecting`, `isConnected`, `detections`, `error`, `frameCount`, `wsStatus`, `confThreshold`, `startDetection`, `stopDetection`, `setConfThreshold`

**`useVideoChunking.ts`** - Client-side video chunking:
- Extracts frames via `<video>` + `<canvas>` (seeked event)
- Sends chunks via WS or REST (`/api/detect/chunk`)
- Configurable: chunkSize (default 10), totalChunks (default 24), maxResolution (default 640)
- Progress callbacks, error handling per-chunk (continues on failure)
- Returns: `isProcessing`, `currentChunk`, `processedChunks`, `processVideo`, `cancelProcessing`, `reset`

**`useVideoCache.ts`** - IndexedDB persistence:
- Stores: sessions (metadata) + chunks (frames + results)
- Auto-initializes on mount, falls back to in-memory if IndexedDB unavailable
- Operations: save/get/update/delete sessions, save/get chunks, update chunk results
- Cleanup: `clearSessionCache(sessionId)`, `clearAllCache()`

**`useErrorTracker.ts`** - Centralized error tracking:
- Error types: `websocket`, `camera`, `video-upload`, `detection`, `network`, `backend`, `unknown`
- Severities: `info`, `warning`, `error`, `critical`
- Persists to `sessionStorage` (survives refresh)
- Features: filter by source/severity, search, resolve, export JSON, copy to clipboard

**`useCamera.ts`** - Camera stream management:
- `getUserMedia` with facingMode, resolution constraints
- Automatic stream cleanup on unmount/switch
- Returns: `videoRef`, `isCameraOn`, `facingMode`, `error`, `startCamera`, `stopCamera`, `toggleCamera`

### UI Components

**`ErrorChecker.tsx`** - Debug panel:
- Collapsible card with filterable, searchable error list
- Color-coded by severity (info/warning/error/critical) and source
- Relative timestamps, expandable details, copy/export/resolve actions
- Integrated in both `WebcamDetector` and `VideoUploadDetector`

**`ToastProvider.tsx`** - Toast notifications:
- Types: `success`, `error`, `warning`, `info`
- Used for fall detected, email sent, email configured, processing complete

## Key Architecture Patterns

### Data-Driven Content
All text content in `data/content.ts` as typed constants. Components import only what they need.

### UI Component Library
Reusable primitives in `components/ui/`:
- ForwardRef for all components
- Variant/size props with sensible defaults
- ClassName composition via template literals
- Accessibility built-in (ARIA, focus-visible)

### GSAP Animation System
- `data/animations.ts`: durations, easings, staggers, presets, scroll triggers
- Components use `gsap.context(ref)` for cleanup in `useEffect`
- ScrollTrigger registered client-side only
- Reduced motion support via `prefers-reduced-motion`

### Multi-Page Navigation
- Home page (`/`) = single-page layout with all sections
- Dedicated pages: `/about`, `/how-it-works`, `/contact`, `/canvas`
- Navbar in `app/layout.tsx` wraps all pages
- Active state via `usePathname()`

### Styling Approach
- CSS custom properties in `:root` (beige `#fae3ac` background, no dark mode)
- Tailwind v4 `@theme inline` maps CSS vars to utilities
- Component styles in `globals.css` (`.btn-*`, `.card`, `.input`, etc.)

## Session & Multi-User Flow

1. **Page load**: Generate `sessionId` (or restore from `sessionStorage`)
2. **Mount**: `POST /api/session/register` with `session_id`
3. **Detection**: WS connects with `?session_id=`, backend routes to session email
4. **Email config**: `POST /api/config?session_id=` stores per-session in `SessionManager`
5. **Page unload**: `sendBeacon` to `/api/session/cleanup` closes WS, removes session
6. **IndexedDB**: Video chunks cached per-session, cleared on cleanup/reset

## Important Conventions

1. **Client Components**: All interactive components use `"use client"`
2. **Path Aliases**: `@/*` maps to project root (`tsconfig.json`)
3. **TypeScript**: Strict mode, no `any` unless necessary
4. **No src/ directory**: Components at `components/`, app at `app/`
5. **Scroll Animations**: `gsap.context(ref)` for automatic cleanup
6. **Image Optimization**: Next.js Image or inline SVG

## File Naming & Imports

- Components: PascalCase (`Hero.tsx`, `Button.tsx`)
- Data: camelCase exports (`heroContent`, `aboutContent`)
- Hooks: camelCase (`useFallDetection`, `useVideoChunking`)
- Barrel exports in `components/index.ts`, `components/ui/index.ts`, `components/hooks/index.ts`
- Import from `@/components`, `@/components/ui`, `@/components/hooks`

## Common Tasks

**Add a new page:**
1. Create `app/new-page/page.tsx`
2. Import section component + Footer
3. Add nav item to `Navbar.tsx` navItems array
4. Add content to `data/content.ts` if needed

**Add a new UI component:**
1. Create in `components/ui/ComponentName.tsx`
2. Export from `components/ui/index.ts`
3. Add base styles to `globals.css` if needed

**Modify animations:**
- Edit `data/animations.ts` for global presets
- Component-specific animations in component's `useEffect`

**Update theme colors:**
- Modify CSS custom properties in `globals.css:1-24`
- Rebuild to regenerate Tailwind utilities

**Backend changes:**
- Add endpoint in `main.py`
- Update detector logic in `detector.py` (keep stateless)
- Add session/connection logic in respective managers

## TypeScript Notes

- Strict mode: no implicit any, strict null checks
- Component props extend native HTML attributes where appropriate
- ForwardRef typing: `forwardRef<HTMLButtonElement, ButtonProps>`
- GSAP types from `@types/gsap`
- Hook return types explicitly exported

## Build Output

- Static export (pages static by default)
- All routes pre-rendered at build time
- Check `Route (app)` table in build output for generated pages

## Environment Variables

**Frontend (`.env.local`):**
```
NEXT_PUBLIC_API_URL=https://fall-detection-api-ra9o.onrender.com
NEXT_PUBLIC_WS_URL=wss://fall-detection-api-ra9o.onrender.com
```

**Backend (`.env`):**
```
MODEL_PATH=yolov8n-pose.pt
CONF_THRESHOLD=0.6
SMTP_SERVER=smtp.gmail.com
SMTP_PORT=465
SMTP_USE_SSL=true
SMTP_USERNAME=your-email@gmail.com
SMTP_PASSWORD=your-app-password
TARGET_EMAIL=default-alert@example.com
CORS_ORIGINS=https://your-frontend-domain.com
ALLOW_ALL_ORIGINS=false
```

## Testing Checklist

**WebSocket Lifecycle:**
- [ ] Start detection → WS opens → frames sent/received
- [ ] Stop detection → WS closes, no reconnection
- [ ] Page refresh → `sendBeacon` cleanup works, no zombie connections

**Multi-User:**
- [ ] 5+ tabs can connect simultaneously
- [ ] Each session has independent email config
- [ ] Fall alerts sent to correct session's email

**Video Upload:**
- [ ] Chunked processing works (10 frames/chunk)
- [ ] Results cached in IndexedDB
- [ ] Fall detection toasts appear (deduplicated)
- [ ] Email sent toasts appear when email configured

**Error Tracking:**
- [ ] Errors persist in sessionStorage after refresh
- [ ] ErrorChecker filters/search works
- [ ] Export JSON / Copy to clipboard works