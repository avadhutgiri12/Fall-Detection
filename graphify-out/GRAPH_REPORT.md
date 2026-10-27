# Graph Report - falldetection  (2026-10-27)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 456 nodes · 876 edges · 25 communities (14 shown, 11 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.98)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1693be46`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ui/index.ts
- Package & Dependencies
- package.json
- SessionManager
- TypeScript Config
- ConnectionManager
- Backend
- Animations & GSAP
- Project & Documentation
- Images Data
- Graph Report
- detector.py
- vercel.json
- detect_frame
- animations.ts
- upload_video
- fall_detection.py
- post
- Overlay.tsx
- README.md
- AGENTS.md
- websocket_detect
- images.ts

## God Nodes (most connected - your core abstractions)
1. `react` - 25 edges
2. `VideoUploadDetector()` - 16 edges
3. `Contact()` - 16 edges
4. `Footer()` - 16 edges
5. `Card` - 16 edges
6. `CardContent` - 16 edges
7. `compilerOptions` - 16 edges
8. `SessionManager` - 14 edges
9. `ErrorChecker()` - 14 edges
10. `WebcamDetector()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `CanvasPage()` --calls--> `Canvas()`  [EXTRACTED]
  app/canvas/page.tsx → components/Canvas.tsx
- `RootLayout()` --calls--> `Navbar()`  [EXTRACTED]
  app/layout.tsx → components/ui/Navbar.tsx
- `lifespan()` --uses--> `FallDetector`  [INFERRED]
  backend/main.py → backend/detector.py
- `Home()` --calls--> `About()`  [EXTRACTED]
  app/page.tsx → components/About.tsx
- `Home()` --calls--> `Contact()`  [EXTRACTED]
  app/page.tsx → components/Contact.tsx

## Import Cycles
- None detected.

## Communities (25 total, 11 thin omitted)

### Community 0 - "ui/index.ts"
Cohesion: 0.06
Nodes (72): Canvas(), DemoIcon(), DemoIconProps, useCamera(), UseCameraOptions, UseCameraReturn, ErrorEntry, ErrorSeverity (+64 more)

### Community 1 - "Package & Dependencies"
Cohesion: 0.08
Nodes (46): AboutPage(), metadata, CanvasPage(), metadata, ContactPage(), metadata, HowItWorksPage(), metadata (+38 more)

### Community 2 - "package.json"
Cohesion: 0.06
Nodes (34): eslintConfig, dependencies, gsap, lucide-react, next, react, react-dom, @types/gsap (+26 more)

### Community 7 - "Animations & GSAP"
Cohesion: 0.14
Nodes (15): geistMono, geistSans, metadata, RootLayout(), viewport, Toast, ToastProps, ToastType (+7 more)

### Community 8 - "Project & Documentation"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 9 - "Images Data"
Cohesion: 0.12
Nodes (7): download_processed_video(), get_config(), get_video_status(), health_check(), session_stats(), VideoStatusResponse, ws_stats()

### Community 10 - "Graph Report"
Cohesion: 0.12
Nodes (14): Build Output, Common Tasks, Data-Driven Content, Development Commands, File Naming & Imports, GSAP Animation System, Important Conventions, Key Architecture Patterns (+6 more)

### Community 12 - "vercel.json"
Cohesion: 0.14
Nodes (13): maxDuration, buildCommand, devCommand, env, NEXT_PUBLIC_API_URL, NEXT_PUBLIC_WS_URL, framework, functions (+5 more)

### Community 13 - "detect_frame"
Cohesion: 0.18
Nodes (6): ChunkFrameRequest, ChunkFrameResponse, detect_chunk(), detect_frame(), DetectFrameRequest, DetectFrameResponse

### Community 14 - "animations.ts"
Cohesion: 0.18
Nodes (8): animationPresets, durations, easings, initScrollAnimations(), prefersReducedMotion(), scrollAnimations, scrollTriggerDefaults, staggers

### Community 15 - "upload_video"
Cohesion: 0.20
Nodes (4): VideoDetectionResult, process_video_job(), upload_video(), VideoUploadResponse

### Community 17 - "post"
Cohesion: 0.22
Nodes (4): cleanup_session(), ConfigUpdateRequest, register_session(), update_config()

### Community 19 - "Overlay.tsx"
Cohesion: 0.32
Nodes (7): Drawer, DrawerProps, Modal, ModalProps, Overlay, OverlayProps, react-dom

### Community 20 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **7 isolated node(s):** `tailwindcss`, `@tailwindcss/turbopack`, `@types/gsap`, `@types/node`, `@types/react` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 210 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **11 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `Package & Dependencies` to `ui/index.ts`, `package.json`, `Overlay.tsx`, `Animations & GSAP`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `tailwindcss`, `@tailwindcss/turbopack`, `@types/gsap` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ui/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06255012028869286 - nodes in this community are weakly interconnected._
- **Why does `SessionManager` connect `SessionManager` to `Backend`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `Package & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.08499743983614952 - nodes in this community are weakly interconnected._
- **Why does `gsap` connect `Package & Dependencies` to `ui/index.ts`, `package.json`, `animations.ts`?**
  _High betweenness centrality (0.032) - this node is a cross-community bridge._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05714285714285714 - nodes in this community are weakly interconnected._