# Graph Report - falldetection  (2026-10-25)

## Corpus Check
- 36 files · ~19,205 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 5 file(s) not represented in the graph (top: .css 2, (none) 1, .ico 1)

## Summary
- 315 nodes · 601 edges · 20 communities (11 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.98)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `1189040b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- About.tsx
- Package & Dependencies
- ui/index.ts
- FallDetector
- TypeScript Config
- CLAUDE.md
- Backend
- Animations & GSAP
- Images Data
- detect_frame
- main.py
- detector.py
- get_video_status
- upload_video
- Overlay.tsx
- README.md
- AGENTS.md
- websocket_detect

## God Nodes (most connected - your core abstractions)
1. `Button` - 18 edges
2. `Contact()` - 16 edges
3. `Footer()` - 16 edges
4. `react` - 16 edges
5. `compilerOptions` - 16 edges
6. `Card` - 14 edges
7. `CardContent` - 14 edges
8. `FallDetector` - 12 edges
9. `About()` - 12 edges
10. `HowItWorks()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `CanvasPage()` --calls--> `Canvas()`  [EXTRACTED]
  app/canvas/page.tsx → components/Canvas.tsx
- `ContactPage()` --calls--> `Contact()`  [EXTRACTED]
  app/contact/page.tsx → components/Contact.tsx
- `RootLayout()` --calls--> `Navbar()`  [EXTRACTED]
  app/layout.tsx → components/ui/Navbar.tsx
- `Home()` --calls--> `Contact()`  [EXTRACTED]
  app/page.tsx → components/Contact.tsx
- `AboutPage()` --calls--> `About()`  [EXTRACTED]
  app/about/page.tsx → components/About.tsx

## Import Cycles
- None detected.

## Communities (20 total, 9 thin omitted)

### Community 0 - "About.tsx"
Cohesion: 0.08
Nodes (39): AboutPage(), metadata, CanvasPage(), metadata, ContactPage(), metadata, HowItWorksPage(), metadata (+31 more)

### Community 1 - "Package & Dependencies"
Cohesion: 0.06
Nodes (33): eslintConfig, dependencies, gsap, next, react, react-dom, @types/gsap, devDependencies (+25 more)

### Community 2 - "ui/index.ts"
Cohesion: 0.11
Nodes (46): Canvas(), DemoIcon(), DemoIconProps, Contact(), FormData, FormErrors, Button, ButtonProps (+38 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "CLAUDE.md"
Cohesion: 0.12
Nodes (14): Build Output, Common Tasks, Data-Driven Content, Development Commands, File Naming & Imports, GSAP Animation System, Important Conventions, Key Architecture Patterns (+6 more)

### Community 7 - "Animations & GSAP"
Cohesion: 0.18
Nodes (8): animationPresets, durations, easings, initScrollAnimations(), prefersReducedMotion(), scrollAnimations, scrollTriggerDefaults, staggers

### Community 11 - "detect_frame"
Cohesion: 0.16
Nodes (6): ConfigUpdateRequest, detect_frame(), DetectFrameRequest, DetectFrameResponse, update_config(), VideoUploadResponse

### Community 14 - "get_video_status"
Cohesion: 0.18
Nodes (5): download_processed_video(), get_config(), get_video_status(), health_check(), VideoStatusResponse

### Community 15 - "upload_video"
Cohesion: 0.25
Nodes (3): VideoDetectionResult, process_video_job(), upload_video()

### Community 16 - "Overlay.tsx"
Cohesion: 0.32
Nodes (7): Drawer, DrawerProps, Modal, ModalProps, Overlay, OverlayProps, react-dom

### Community 17 - "README.md"
Cohesion: 0.50
Nodes (3): Deploy on Vercel, Getting Started, Learn More

## Knowledge Gaps
- **7 isolated node(s):** `@types/gsap`, `@tailwindcss/turbopack`, `@types/node`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 153 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gsap` connect `About.tsx` to `Package & Dependencies`, `ui/index.ts`, `Animations & GSAP`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **What connects `@types/gsap`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `About.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.07547169811320754 - nodes in this community are weakly interconnected._
- **Why does `react` connect `ui/index.ts` to `About.tsx`, `Overlay.tsx`, `Package & Dependencies`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Should `Package & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Why does `next` connect `About.tsx` to `Package & Dependencies`?**
  _High betweenness centrality (0.028) - this node is a cross-community bridge._
- **Should `ui/index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10776942355889724 - nodes in this community are weakly interconnected._