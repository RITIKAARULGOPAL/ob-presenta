# Presenta — Feature & Bug Checklist

Full inventory of what the app can do and what's still open, grouped by
surface (the opposite axis from `PROGRESS.md`, which is chronological) —
this is the structural index, `PROGRESS.md` is the narrative session log,
they complement each other the same way `PROGRESS.md` already complements
`CHANGELOG.md`. Update **this file** whenever an item's status changes;
don't just narrate the change in `PROGRESS.md` and leave this stale.

**Convention:** `- [ ]` open, `- [x] ~~done~~` complete (checkbox *and*
strikethrough, so it reads correctly both in a checkbox-rendering viewer and
in a plain diff). A one-line date/pointer links back to the relevant
`PROGRESS.md` entry for detail — don't re-describe, link.

**Task-classification tags on open items**, for splitting work across
worktrees/parallel chats (see `PROGRESS.md`'s 2026-09-25 "Multi-session
workflow" entry for the full reasoning):
- **(A)** — research/planning/investigation only; safe in any number of
  parallel chats, no worktree needed.
- **(B)** — build work touching files no other in-flight task touches;
  give it its own worktree + branch + dev-server port.
- **(C)** — touches a shared-spine file (`editorStore.ts`, `src/types/slide.ts`,
  a Supabase migration, or `SlideRenderer.tsx` — the de facto shared spine
  for the whole Linked Views surface) or needs something only the user can
  supply (dashboard access, real content); must be serialized or is blocked,
  not safely parallelizable.

---

## Home

- [x] ~~New-presentation creation flow (name/date/client logo/accent picker)~~ (2026-09-15)
- [x] ~~Default accent black instead of blue~~ (2026-09-15)
- [x] ~~Fix logo/accent vanishing on first open (editor re-fetch clobber)~~ (2026-09-15)
- [x] ~~Search + brand filter + 3-way sort for "Recent"~~ (2026-09-24)
- [x] ~~Close (×) icon instead of "← Back to Presenta" text link~~ (2026-09-24)
- [x] ~~Light/System/Dark theme toggle~~ (2026-09-21)
- [x] ~~Cool/crisp palette + Inter Tight/Helvetica chrome type retint~~ (2026-09-24/25)
- [ ] Real hero → search/filter → card-grid layout hierarchy (B) — mockup
      approved, only colors/fonts landed via the token retint; the actual
      restructure isn't built
- [ ] ⌘K command palette over `editorStore`'s ~50 named actions (B) —
      Phase 4 of the 2026-09-21 UI rework, unbuilt
- [ ] Searchable layout/concept-picker dialog with real slide previews (B) —
      same Phase 4, unbuilt
- [ ] Concept-library dialog rework (B) — Phase 6 of the 2026-09-21 rework,
      unbuilt

## Editor chrome

- [x] ~~Slide canvas scales to fit window (`ScaledStage`)~~ (2026-09-15)
- [x] ~~Google-Slides-style image editing (crop/resize/rotate/opacity overlay)~~ (2026-09-15)
- [x] ~~Dark/light/system theme with a token layer~~ (2026-09-21)
- [x] ~~Dark-mode comfort pass (canvas surround, theme-color meta, focus ring, forced-colors)~~ (2026-09-21)
- [x] ~~Horizontal-overflow fix at narrow widths~~ (2026-09-21)
- [x] ~~Editor shell rebuilt: 2-row header/toolbar, Menu/Button/SegmentedControl primitives~~ (2026-09-21)
- [x] ~~Save-status indicator~~ (2026-09-21)
- [x] ~~Real slide duplicate (deep clone with full id-remap)~~ (2026-09-21)
- [x] ~~Undo/redo (`commitProject` choke point, 50-entry history)~~ (2026-09-21)
- [x] ~~Multi-select in the slide rail (ctrl/shift-click, bulk duplicate/skip/delete)~~ (2026-09-21)
- [x] ~~Drag-to-reorder slides~~ (2026-09-21)
- [x] ~~Drag-to-reposition freeform elements + alignment-guide snapping~~ (2026-09-21)
- [x] ~~Keyboard shortcuts (Ctrl+D/A/Z/Y, arrows, Delete, Escape)~~ (2026-09-21)
- [x] ~~Design Option tagging across slide types (multiple design options per project)~~ (2026-09-22)
- [x] ~~Properties panel: collapsible `Disclosure` sections~~ (2026-09-24)
- [x] ~~Linked Views canvas toolbar moved into the Properties panel~~ (2026-09-25)
- [x] ~~Per-slide Background (color/image/darken)~~ (2026-09-17)
- [ ] `Slide.sectionIcon` picker — decide keep-or-remove now that the
      Presenter sidebar dropped its own icon rendering (A)
- [ ] Element-level selection + resize + z-order for freeform elements (B) —
      never built; prerequisite for element-level keyboard nudge and
      on-canvas multi-select
- [ ] Copy/paste (Ctrl+C/V) for slides/elements (B) — deliberately deferred,
      Ctrl+D covers "copy in place" for now
- [ ] Comments/annotations (B) — last item of Phase G, never started
- [ ] Real Google-account login + viewer/editor sharing (C, needs schema/RLS
      work) — parked, fully architected (Supabase Auth + Google OAuth,
      `owner_id`/`project_collaborators`, real RLS) but not started; the DB
      is currently fully open — any anon-key holder can read/write any
      project

## Linked Views — data model & hotspots

- [x] ~~Side list + two-way hover~~ (2026-09-16)
- [x] ~~Gallery/lightbox per hotspot~~ (2026-09-16)
- [x] ~~Named stages, per-stage image/hotspot visibility~~ (2026-09-16)
- [x] ~~Viewer zoom/pan (transient, wheel + drag)~~ (2026-09-16)
- [x] ~~`clickAction` (gallery vs. jump-to-target priority)~~ (2026-09-22)
- [x] ~~Hotspot-level `keyPlanImage`~~ (2026-09-22)
- [x] ~~Seating-table row → hotspot click-through~~ (2026-09-22)
- [x] ~~Excel import preview/confirm step~~ (2026-09-22)
- [x] ~~`targetTime` video-seek race fixed~~ (2026-09-22)
- [x] ~~Export-menu notice for Linked Views' first-view-only export limit~~ (2026-09-22)
- [x] ~~`cloneSlide` fixed to remap `adjacentHotspotIds`~~ (2026-09-22)
- [x] ~~`removeHotspot` cleans seating-table references~~ (2026-09-22)
- [x] ~~`parentHotspotId` (zone→rooms one-to-many reference)~~ (2026-09-23)
- [x] ~~Zone-to-rooms split/merge "burst" transition style (vs. fade)~~ (2026-09-23)
- [x] ~~Spline + Freehand drawing tools~~ (2026-09-24)
- [x] ~~Hotspot popup anchors beside the shape, draggable, no overflow~~ (2026-09-24)
- [ ] Two zone hotspots sharing the same `zoneCategory`/label with their own
      separate children (A) — believed correct by construction (id-based
      join sidesteps the name collision), never independently proven live
- [ ] A hotspot on only one side of a transition, ghost fade-in/out path (A) —
      a direct symmetric extension of the proven shared-identity morph,
      never watched frame-by-frame itself

## Linked Views — stages, overlays, calibration

- [x] ~~Zoning/Adjacency/Dimensions overlay modes + calibration (Phase H)~~ (2026-09-21)
- [x] ~~PDF plans with snap-to-line measurement~~ (2026-09-22)
- [x] ~~CAD-style snap discoverability (status indicator, upload copy, snapped-line highlight)~~ (2026-09-23)
- [x] ~~Plan-evolution timeline (Zoning→Walls→Circulation→Furniture), auto-applied overlays~~ (2026-09-23)
- [x] ~~Locked North/Calibrate (auto-lock on real commit, not a stray click)~~ (2026-09-23)
- [x] ~~North point always-on, drag-to-rotate compass~~ (2026-09-22)
- [x] ~~North/Reset-Zoom/music controls unified into one flex row~~ (2026-09-22)
- [ ] Kind-change overlay-fade (Zoning→Circulation with no Walls in between)
      does an instant cut, not a dual crossfade (B) — deliberate scope trim,
      not tested live
- [ ] Very divergent hotspot shapes can self-intersect into a momentary
      "bowtie" mid-morph frame (B) — known, accepted limitation of
      per-vertex lerp, not fixed

## Linked Views — background, key-plan, seating

- [x] ~~Background music + key-plan card per stage~~ (2026-09-18)
- [x] ~~Seating Capacity table (Area/Required/Achieved, two-way hover, Excel import)~~ (2026-09-17)
- [x] ~~Seating Capacity collapsible, then closable with reflow into freed width~~ (2026-09-22/24)
- [x] ~~Space Detail overlay (concept/renders/walkthrough/occupancy/BOQ on hotspot click)~~ (2026-09-18)
- [ ] Real editable BOQ line-item table (B) — still a placeholder note,
      parked deliberately

## Presenter

- [x] ~~Presenter nav bar: step counter, dots, hover thumbnail preview, progress bar~~ (2026-09-16/17)
- [x] ~~Dot-row grouped by section-starter/design-option~~ (2026-09-16/22)
- [x] ~~Persistent section sidebar (icon + label, collapsible)~~ (2026-09-24)
- [x] ~~Fill-screen fit, no letterbox bars (`ScaledStage` `fit="cover"`)~~ (2026-09-24)
- [x] ~~Linked Views plan no longer overflows the slide (flex shrink-to-fit)~~ (2026-09-22)
- [ ] A real successfully-saved section-starter title/icon shown after a
      full reload into Presenter (A) — blocked by this sandbox's save
      flakiness, not a known code defect; never independently proven in a
      real browser

## Export

- [x] ~~Client-side PDF/PPTX export (`exportDeck.ts`)~~ (pre-existing)
- [x] ~~Python batch-export tool (Selenium-driven, prod-build server)~~ (2026-09-17)
- [ ] Confirm real export time for a 160+-slide deck (A) — never confirmed
      cleanly end-to-end; one attempt's log was lost
- [ ] Per-slide view/stage export control for Linked Views (B) — currently
      exports only the first view/stage; the limitation is disclosed via a
      menu notice, not fixed

## Concept library / imports

- [x] ~~Concept Library gallery + "already in deck" tracking~~ (pre-existing)
- [x] ~~"As is" full-bleed image slides from a real client PPTX~~ (2026-09-17)
- [x] ~~Per-element freeform reconstruction of PPTX slides (editable image/text/shape)~~ (2026-09-17)
- [x] ~~Qualcomm 163-slide PDF bid-deck import~~ (2026-09-16)
- [ ] Typology-driven template population — needs the real typology list and
      which concept-library pillars belong to each; blocked on the user
- [ ] Brand (OB/SKV/Both) → auto-populated company-profile slides — needs
      the real source decks for each brand's profile; blocked on the user
- [ ] Audience-based slide defaults (Leadership vs. Client) (A) — a
      two-option proposal is on the table, not yet confirmed as final

## Data / Supabase / migrations

- [x] ~~Client logo / accent / font / typography columns + migrations written~~ (2026-09-15)
- [ ] **Run migrations `0003_add_client_logo.sql`/`0004_add_font_family.sql`/
      `0005_add_typography.sql` in the Supabase dashboard SQL Editor** —
      blocked; this session only ever has the public anon key, which can't
      run DDL. The exact ready-to-paste SQL has been handed over multiple
      times (see PROGRESS.md 2026-09-15 and 2026-09-24). The missing-
      migration banner is a real, live warning until this runs — not
      cosmetic, and no code change is needed once it does.
- [ ] Real Google-account login + RLS (see Editor chrome, C) — parked

## Known bugs (open)

- [ ] `.font-display` silently falls back to Arial on real slide content
      instead of Archivo/the deck's own typography — flagged 3× across the
      2026-09-24 entries, never root-caused. Start by checking whether the
      compiled Tailwind output actually contains a `.font-display` rule for
      a real route.
- [ ] Vertex-truncation on a dense real PDF plan degrades an exact corner
      to a nearby edge-snap instead — root-caused, reproducible, not fixed.
      `decimate()` (`src/lib/pdfPlan.ts`) needs to prioritize vertices
      belonging to a segment that survived its own length-sort, the same
      way `segments` already prioritizes real walls over hatching.
- [ ] The real "Ecom Express" project's Seating Capacity table has one row
      with a stray extra `hotspotIds` entry from a live mis-click during the
      actual client meeting — a data cleanup, not a code fix.
- [ ] A pre-existing React "duplicate key" console warning shows up on at
      least one seed/test project — never tracked down, unrelated to any
      one feature.

## Dev tooling / process

- [x] ~~`PROGRESS.md` set up + `SessionEnd` hook~~ (2026-09-15)
- [x] ~~`impeccable` design-detector skill installed + hook enabled~~ (2026-09-25)
- [x] ~~`emilkowalski/skill` pack installed (animate, apple-design, prototype, etc.)~~ (2026-09-25)
- [x] ~~This checklist (`FEATURES.md`) + commit/gitignore cleanup~~ (2026-09-25)
- [ ] Cut the first git worktree(s) for a ready (B)-bucket item (B/C
      classification is defined above; no worktree exists yet)
- [ ] `CHANGELOG.md` is stale (last touched 2026-09-08) — not kept in sync
      with `PROGRESS.md`'s pace; not fixed as part of this checklist's setup
