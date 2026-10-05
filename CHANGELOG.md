# Presenta App – Changelog

> **Last updated:** 2026-10-05
> **Latest commit:** `faa8782` on `claude/f1-presenting` (pushed; not yet merged to `main`)
>
> The "Current Architecture" and "Known Context" sections at the bottom date
> from 2026-09-08. For the current state, see `PROGRESS.md` and `FEATURES.md`.

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

## Uncommitted (2026-10-05)

- **Feature:** Hero video (title slide) and walkthrough video upload from a file picker or drag-drop to a Supabase Storage `media` bucket; the paste-URL boxes are gone (`src/lib/videoUpload.ts`).
- **Database:** Migration `0006_media_bucket.sql` creates the bucket (50 MB/file, mp4/webm/mov). Must be run in the Supabase SQL Editor before uploads work.
- **Fix:** The hero video now fills the whole slide instead of only the title text block.
- **Fix:** Presenting from the editor reuses the in-memory deck, so accent colour, logo and fonts show even when the database can't store them yet (partial B4).

---

## v0.2.0 — Development History (2026-09-09 to 2026-10-05)

### 2026-10-05
- `0e8604b` — **Merge** of the parallel worktree (`worktree-presenta-parallel`) into `claude/f1-presenting`.
- `fe4d5be` — **Feature:** Home redesign: hero band, search/filter toolbar, card grid with first-slide thumbnails (`captureThumbnail.ts`).
- `ec016af` — **Fix:** Export no longer hangs on an empty image slot.
- `77da3b2` — **UX:** "+ Stage" and Split style (Fade/Burst) moved off the slide into the Properties panel.
- `d7da69d` — **Fix:** W1 bug sweep, 15 bugs (B1, B3, B5, B6, B7, B9, B11, B14, B17, B18, B19, U17, U19, V1, V2); see `FEATURES.md`.
- `3d5b441` — **Feature:** S2 Site analysis stage: 96-item checklist, placed markers/lines/areas, Presenter checklist.
- `faa8782`, `82b8cbe` — Docs: `PROGRESS.md` updates.

### 2026-09-28
- `bdeaf55` — **Feature:** S1/F8 optional stages; rename, reorder and delete stages (with carry-or-delete for regions).
- `4411214` — **Feature:** F1 speaker notes, presenter view window, full screen, present from the current slide, new keys, swipe.
- `c3253c9` — **Fix:** Slide headlines and body text were falling back to Arial.
- `67aea39` — Docs: planning docs (09-25 review, 09-28 roadmap, S2 checklist).

### 2026-09-25
- `06a7ca3` — **UX:** Properties panel collapsible sections; Linked Views canvas toolbar moved into the panel.
- `dfda18c` — **Design:** Whole-app visual refresh: cool palette, Inter Tight/Helvetica chrome type, Presenter section sidebar.
- `2e38cf1` — Docs: `FEATURES.md` feature/bug checklist.
- `a6aec65` — Tooling: shared skills config; vendored skill trees gitignored.
- `78048d4` — Docs: `PROGRESS.md` update.

### 2026-09-24
- `2a0c0c3` — **Feature:** Home filter/sort, close-button UX, spline/freehand drawing tools, hotspot popup overlap fix + drag, seating table close + reflow.

### 2026-09-23
- `1b49267` — **Feature:** Linked Views plan-evolution timeline, locked North/Calibrate, zone-to-rooms split bursts, CAD-snap indicator.

### 2026-09-22
- `53701f5` — **Feature:** Linked Views overlay layers (Zoning/Adjacency/Dimensions + calibration), PDF plans with snap-to-line, audit pass, design options, north point.

### 2026-09-21
- `546c3a2` — **Refactor:** UI token layer; editor shell rebuilt on it.
- `98b4056` — **Fix:** Editor no longer overflows sideways at narrow widths.
- `afd75a9` — **UX:** Softer dark canvas, focus rings, `theme-color`.
- `dbdcacb` — **Feature:** Dark and light mode for the app chrome.
- `069f72d` — **Feature:** Save-status indicator, real slide duplication, undo/redo.

### 2026-09-16
- `33db2b9`, `8844f72`, `b88c2e9`, `45a0356` — **Feature:** "As is" E-Com Express reference slides in the concept library, rebuilt as per-element editable freeform slides.
- `03705df` — **Fix:** Occupancy-chart highlight on arrival was invisible.
- `8ca2baa` — **Tooling:** Python batch-export tool; `pdfjs-dist` added as a real dependency; wider MediaBox click target.
- `70b385c` — **Feature:** Occupancy chart with hotspot/Excel linking; visual polish pass (later replaced by the seating table).
- `65cf71b` — **Feature:** Transient zoom/pan on Linked Views images.
- `6b68c38` — **Feature:** Sidvin-deck patterns: orbit, site-locus and material-compare layouts, hero video, hotspot side list, gallery/lightbox, stages, Presenter nav bar.

### 2026-09-15
- `0d74974` — Tooling: cross-session `PROGRESS.md` notes with a SessionEnd safety net.
- `e77b72e` — **Feature:** Google-Slides-style image editing: zoom, pan, rotate, opacity.
- `fc4018a` — **Fix:** Editor canvas scales to fit the window; project-creation race fixed.
- `f07d169` — **Change:** Default accent colour is black instead of blue.
- `e21f82f` — Tooling: shared dev-server launch config tracked.

### 2026-09-11
- `905d043` — **Fix:** Exported PDF pages rendered portrait instead of landscape.
- `aaa7324` — **Fix:** Stale migration banner didn't mention 0005.
- `8b7f46f`, `4aa400a`, `53ec0ee` — **Feature:** Deck-wide font picker and per-slide typography (size, weight, body font, tracking, headline pairing).
- `928256f`, `e66f4bd` — Tooling: `.vercelignore`, `.gitignore` fixes, Vercel auto-deploy check.
- `31c7a8e`, `3ac1fc6`, `65fe920`, `061780e` — **UX:** Homepage mission line, icons, trimmed captions and UI copy.

### 2026-09-10
- `a088393` — **Fix:** Blank PDF and PPTX exports.
- `d992659` — **Change:** A new slide starts empty instead of with placeholder copy.

### 2026-09-09
- `ddeb385` — **Feature:** Skip a slide (kept in the deck, left out of presenting).
- `a90633a`, `5a4fdad` — **UX:** Concept library becomes a layout gallery that stays on screen in narrow windows.
- `43e4d02`, `3a4ac91`, `e335994` — **Feature:** Rectangle, ellipse, polygon and curve region tools; Shift to constrain.
- `9dec0dd` — **Feature:** Upload or drag-drop slide images instead of pasting URLs.
- `de6bd82`, `c2ee8ff`, `25c30b4`, `e20ef70` — **Feature:** Office-design concept library, drawn concept slides, concepts linking to plans, `slide.animation` working.
- `b058f97` — Tooling: ignore paused AI-import files and Supabase CLI scratch.

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
