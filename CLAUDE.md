# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Fall Detection Web Application - A multi-page Next.js 16 application with a modern, data-driven architecture for a fall detection system marketing website.

**Tech Stack:**
- Next.js 16.4.3 (App Router, React 19.3.0)
- Tailwind CSS v4 (via @tailwindcss/turbopack)
- TypeScript (strict mode)
- GSAP 3.15.0 + ScrollTrigger for scroll animations
- Geist Sans/Mono fonts

## Development Commands

```bash
npm run dev          # Start development server (http://localhost:3000)
npm run build        # Production build (static export)
npm run start        # Start production server
npm run lint         # Run ESLint (next-vitals + next-typescript config)
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
│       └── Navbar.tsx     # Top-fixed nav with GSAP active-state transitions
├── data/
│   ├── content.ts         # All text content (hero, about, how-it-works, contact, canvas, footer, ui)
│   ├── images.ts          # Image paths and alt texts
│   └── animations.ts      # GSAP configs, presets, scroll triggers
├── public/                # Static assets
└── backend/               # Backend code (separate from frontend)
```

## Key Architecture Patterns

### Data-Driven Content
All text content lives in `data/content.ts` as typed constants (`heroContent`, `aboutContent`, `howItWorksContent`, `contactContent`, `canvasContent`, `footerContent`, `uiContent`). Components import only what they need.

### UI Component Library
Reusable primitives in `components/ui/` follow a consistent API:
- ForwardRef for all components
- Variant/size props with sensible defaults
- ClassName composition via template literals
- Accessibility built-in (ARIA, focus-visible, etc.)

### GSAP Animation System
- `data/animations.ts` exports: durations, easings, staggers, animation presets, scroll triggers
- Components use `gsap.context()` for cleanup in `useEffect`
- ScrollTrigger registered client-side only (`if (typeof window !== 'undefined')`)
- Reduced motion support via `prefers-reduced-motion` media query

### Multi-Page Navigation
- Home page (`/`) contains ALL sections as single-page layout
- Dedicated pages for each section: `/about`, `/how-it-works`, `/contact`, `/canvas`
- Navbar in root layout (`app/layout.tsx`) wraps all pages
- Active state tracked via `usePathname()` (not scroll position)

### Styling Approach
- CSS custom properties in `:root` for theme (beige `#fae3ac` background, no dark mode)
- Tailwind v4 `@theme inline` maps CSS vars to utilities
- Component-specific styles in globals.css (`.btn-*`, `.card`, `.input`, etc.)
- Utility classes for common patterns (`.container`, `.section`, `.flex-*`, `.grid-*`)

## Important Conventions

1. **Client Components**: All interactive components use `"use client"` directive
2. **Path Aliases**: `@/*` maps to project root (`tsconfig.json` paths)
3. **TypeScript**: Strict mode enabled, no `any` unless necessary
4. **No src/ directory**: Components at `components/`, app at `app/`
5. **Scroll Animations**: Use `gsap.context(ref)` for automatic cleanup
6. **Image Optimization**: Use Next.js Image component or inline SVG patterns

## File Naming & Imports

- Components: PascalCase (`Hero.tsx`, `Button.tsx`)
- Data: camelCase exports (`heroContent`, `aboutContent`)
- Barrel exports in `components/index.ts` and `components/ui/index.ts`
- Import from `@/components` or `@/components/ui` using path alias

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

## TypeScript Notes

- Strict mode: no implicit any, strict null checks
- Component props extend native HTML attributes where appropriate
- ForwardRef typing: `forwardRef<HTMLButtonElement, ButtonProps>`
- GSAP types from `@types/gsap`

## Build Output

- Static export (`output: 'export'` not needed - pages are static by default)
- All routes pre-rendered at build time
- Check `Route (app)` table in build output for generated pages