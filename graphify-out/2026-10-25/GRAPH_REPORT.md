# Graph Report - falldetection  (2026-10-25)

## Corpus Check
- Corpus is ~12,357 words - fits in a single context window. You may not need a graph.

## Summary
- 201 nodes · 401 edges · 11 communities (7 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Pages & Sections
- Package & Dependencies
- UI Components
- Contact & Forms
- TypeScript Config
- App Layout & Core
- Backend
- Animations & GSAP
- Images Data

## God Nodes (most connected - your core abstractions)
1. `Contact()` - 16 edges
2. `Footer()` - 16 edges
3. `compilerOptions` - 16 edges
4. `Button` - 14 edges
5. `react` - 14 edges
6. `About()` - 12 edges
7. `HowItWorks()` - 12 edges
8. `SectionWrapper` - 12 edges
9. `Card` - 10 edges
10. `CardContent` - 10 edges

## Surprising Connections (you probably didn't know these)
- `ContactPage()` --calls--> `Footer()`  [EXTRACTED]
  app/contact/page.tsx → components/Footer.tsx
- `RootLayout()` --calls--> `Navbar()`  [EXTRACTED]
  app/layout.tsx → components/ui/Navbar.tsx
- `Home()` --calls--> `About()`  [EXTRACTED]
  app/page.tsx → components/About.tsx
- `Home()` --calls--> `Contact()`  [EXTRACTED]
  app/page.tsx → components/Contact.tsx
- `Home()` --calls--> `Footer()`  [EXTRACTED]
  app/page.tsx → components/Footer.tsx

## Import Cycles
- None detected.

## Communities (11 total, 4 thin omitted)

### Community 0 - "Pages & Sections"
Cohesion: 0.14
Nodes (29): AboutPage(), metadata, CanvasPage(), metadata, HowItWorksPage(), metadata, About(), FeatureIcon() (+21 more)

### Community 1 - "Package & Dependencies"
Cohesion: 0.06
Nodes (33): eslintConfig, dependencies, gsap, next, react, react-dom, @types/gsap, devDependencies (+25 more)

### Community 2 - "UI Components"
Cohesion: 0.11
Nodes (29): ButtonProps, CardContentProps, CardDescriptionProps, CardFooter, CardFooterProps, CardHeaderProps, CardProps, CardTitleProps (+21 more)

### Community 3 - "Contact & Forms"
Cohesion: 0.15
Nodes (17): ContactPage(), metadata, Contact(), FormData, FormErrors, CardDescription, CardHeader, CardTitle (+9 more)

### Community 4 - "TypeScript Config"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 5 - "App Layout & Core"
Cohesion: 0.17
Nodes (11): geistMono, geistSans, metadata, RootLayout(), viewport, Home(), Navbar(), NavItem (+3 more)

### Community 7 - "Animations & GSAP"
Cohesion: 0.18
Nodes (8): animationPresets, durations, easings, initScrollAnimations(), prefersReducedMotion(), scrollAnimations, scrollTriggerDefaults, staggers

## Knowledge Gaps
- **7 isolated node(s):** `@types/gsap`, `@tailwindcss/turbopack`, `@types/node`, `@types/react`, `@types/react-dom` (+2 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 91 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `gsap` connect `Pages & Sections` to `Package & Dependencies`, `Contact & Forms`, `App Layout & Core`, `Animations & GSAP`?**
  _High betweenness centrality (0.130) - this node is a cross-community bridge._
- **What connects `@types/gsap`, `@tailwindcss/turbopack`, `@types/node` to the rest of the system?**
  _7 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Pages & Sections` be split into smaller, more focused modules?**
  _Cohesion score 0.14487179487179488 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Pages & Sections` to `Package & Dependencies`, `UI Components`, `Contact & Forms`, `App Layout & Core`?**
  _High betweenness centrality (0.114) - this node is a cross-community bridge._
- **Should `Package & Dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.058823529411764705 - nodes in this community are weakly interconnected._
- **Why does `next` connect `App Layout & Core` to `Pages & Sections`, `Package & Dependencies`, `Contact & Forms`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Should `UI Components` be split into smaller, more focused modules?**
  _Cohesion score 0.11229946524064172 - nodes in this community are weakly interconnected._