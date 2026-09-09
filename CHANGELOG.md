# Presenta App – Changelog

> **Last updated:** 2026-09-08
> **Latest commit:** `482c4e5` — Survive a missing migration instead of dying on a dead page

---

## Project Overview

**Presenta** is a presentation builder app built with Next.js 16, React 19, TypeScript, Tailwind CSS v4, Zustand (state management), and Supabase Postgres (persistence). It supports structured slides, an editor, presenter mode, PDF/PPTX export, Linked Views interlinking, drawable regions, client branding, and accent color customization.

### Key Dependencies
| Package | Version | Purpose |
|---|---|---|
| `next` | 16.3.4 | Framework |
| `react` / `react-dom` | 19.2.8 | UI library |
| `zustand` | ^5.0.15 | State management |
| `@supabase/supabase-js` | ^2.115.0 | Database client |
| `jspdf` | ^4.2.1 | PDF export |
| `pptxgenjs` | ^4.0.1 | PPTX export |
| `html-to-image` | ^1.11.13 | DOM snapshot for exports |
| `tailwindcss` | ^4 | Styling |

---

## v0.1.0 — Development History (2026-09-07 to 2026-09-08)

### 2026-09-08

#### `482c4e5` — Survive a missing migration instead of dying on a dead page
- **Fix:** App no longer crashes when a Supabase migration hasn't been applied yet. Graceful handling added for missing schema columns/tables.

#### `67989de` — Offer up to 5 accent colours, and flag unreadable ones
- **Feature:** Added `AccentPicker.tsx` component with up to 5 selectable accent colors.
- **Feature:** New color utility module (`src/lib/color.ts`) — 171 lines of color analysis logic.
- **Fix:** Unreadable accent combinations are flagged (contrast checks).
- **Files changed:** `AccentPicker.tsx`, `PropertiesPanel.tsx`, `SlideRenderer.tsx`, `color.ts`, `data.ts`, `editorStore.ts`, `slide.ts`

#### `e4629f6` — Untrack the paused AI-import files — they broke the build
- **Fix:** Removed untracked/paused AI import files from git that were causing build failures.

#### `c586678` — Show the client logo on every slide, and derive an accent from it
- **Feature:** Client logo now renders on every slide via `SlideRenderer.tsx`.
- **Feature:** Accent color can be auto-derived from the uploaded client logo image (`src/lib/imageFile.ts`).
- **Database:** New migration `0003_add_client_logo.sql` adds client logo column to presentations table.
- **Files changed:** 12 files, +610 / -37 lines

#### `bec58c7` — Fix invalid nested buttons in the slide rail
- **Fix:** Resolved HTML accessibility issue of nested `<button>` elements inside `SlideRail.tsx`.

#### `f0591d1` — Add SKV / OB / joint branding with per-slide override
- **Feature:** Presentations support three branding modes: SKV, OB, or Joint.
- **Feature:** Per-slide override allows individual slides to differ from the presentation-level branding.

#### `c5e9d88` — Require an explicit "Draw region" toggle before drawing starts
- **Fix/UX:** Drawing mode now requires an explicit toggle activation instead of starting immediately, preventing accidental draws.

#### `38ec772` — Add fill/stroke customization to Linked Views regions
- **Feature:** Drawable polygon regions in Linked Views now support customizable fill color and stroke properties.

#### `6cdc4b9` — Replace point pins with drawable polygon regions
- **Refactor:** Replaced simple point-based pins with fully drawable polygon regions for more precise area highlighting in Linked Views.

#### `e39f78c` — Add true hotspot interlinking to Linked Views
- **Feature:** Hotspots within Linked Views can now link to other slides, enabling interactive navigation between views.

### 2026-09-07

#### `f672c71` — Add Linked Views slide: interlink Layout/Render/Walkthrough/Axo
- **Feature:** New "Linked Views" slide type that allows cross-linking between four view types: Layout, Render, Walkthrough, and Axonometric.

#### `a433c11` — Fix invisible presenter nav controls on light slides
- **Fix:** Presenter mode navigation controls now have proper contrast visibility on light-themed slides.

#### `cc99b9e` — Add delete for saved presentations on the home page
- **Feature:** Users can now delete saved presentations from the home page (`src/app/page.tsx`).

#### `942f409` — Fix blank PDF export
- **Fix:** Resolved issue where PDF exports were rendering as blank pages.

#### `99ba816` — Add PDF and PPTX export
- **Feature:** Full export support added for both PDF (via `jspdf` + `html-to-image`) and PowerPoint (via `pptxgenjs`).

#### `e13e815` — Wire persistence to Supabase Postgres, replacing localStorage
- **Refactor:** All data persistence moved from browser `localStorage` to Supabase Postgres. Zustand store updated accordingly.

#### `0f8cadd` — Initial Presenta app: structured slide model, editor, presenter
- **Feature:** Core application built with:
  - Structured slide type system (`src/types/slide.ts`)
  - Slide editor UI
  - Presenter mode with navigation controls
  - Zustand-based state management (`src/lib/editorStore.ts`)

#### `3721dab` — Initial commit from Create Next App
- **Setup:** Project scaffolded via `create-next-app` with TypeScript, Tailwind CSS v4, ESLint.

---

## Current Architecture

```
src/
├── app/
│   ├── page.tsx              — Home page (list saved presentations, delete)
│   └── p/[id]/edit/page.tsx  — Presentation editor route
├── components/
│   ├── AccentPicker.tsx      — Up to 5 accent color picker with contrast flags
│   ├── PropertiesPanel.tsx   — Slide properties sidebar
│   ├── SlideRail.tsx         — Thumbnail slide navigation rail
│   └── SlideRenderer.tsx     — Renders slides (client logo, branding, regions)
├── lib/
│   ├── color.ts              — Color utilities (contrast checks, accent derivation)
│   ├── data.ts               — Supabase CRUD operations for presentations/slides
│   ├── editorStore.ts        — Zustand store for editor state
│   └── imageFile.ts          — Image file processing (logo accent extraction)
├── types/
│   └── slide.ts              — Slide type definitions
supabase/
└── migrations/
    └── 0003_add_client_logo.sql
```

---

## Known Context for Continuation

- **Branding system:** Supports SKV / OB / Joint modes with per-slide override. Client logo displayed on all slides.
- **Accent colors:** Up to 5 options, auto-derived from client logo or manually picked via `AccentPicker`. Unreadable combos are flagged.
- **Linked Views slide type:** Interlinks Layout/Render/Walkthrough/Axo views with drawable polygon regions (fill/stroke customizable) and hotspot navigation between slides.
- **Drawing mode:** Requires explicit toggle to activate.
- **Export:** PDF and PPTX export both functional.
- **Persistence:** Fully on Supabase Postgres. App gracefully handles missing migrations.
- **State management:** Zustand (`editorStore.ts`)

---

## How to Use This File

When switching AI assistants, share this file so the new assistant can:
1. Understand what has been built and in what order
2. Know the current architecture and dependencies
3. Pick up development from the latest commit without re-reading git history
4. Understand design decisions (e.g., why polygons over pins, why Supabase over localStorage)
