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

**Timeline suffix on open items:** each open item ends with
`· **effort · week**`.
- **Effort** is the focused time to build *and* verify it live, with Claude
  doing the work in this repo. It doesn't include review rounds, or waiting
  on you or on usage limits.
- **Units:** `m` minutes, `h` hours, `d` a ~6h working day, `w` 5 working
  days.
- **Week** is the target week from the Timeline below. `you` means only you
  can do it (dashboard access, real content, a decision). `blocked:` names
  what's missing. When an item's status changes, update its suffix and the
  Timeline table together.

---

## Timeline (as of 2026-09-28)

**Priority order, set 2026-09-28:** the editor first, including the Linked
Views stage work (S1, F8, then S2 Site analysis). Then crisp output and
media (photos, plans, GIFs, videos), then the Home screen. Everything else
keeps its order after those. The crisp PDF and PPTX exports share weeks
4–5 with the stage work.

The weeks assume one work stream at about 30 focused hours a week, roughly
29–30 weeks for everything, including the Windows app, offline sync,
multi-user editing, crisp output, media and Site analysis. Items tagged (B) can run in parallel worktrees to
shorten this. Adjust the weeks for holidays and review time.

| Week | Dates | Theme | Items | Effort |
|---|---|---|---|---|
| W1 | Sep 28–Oct 2 | Stop losing work + quick fixes | B1–B7, B9–B20, B22, V1, V2, U6, U17, U19, L1, L2, sectionIcon | ~26h |
| W1 (you) | Sep 28–Oct 2 | Only you can do these | Run migrations 0003–0005, send the image for B8, clean the Ecom stray seating link, decide U1/B12/B22, Presenter reload check in a real browser | ~1h |
| W2 | Oct 5–9 | Presenter ready for meetings + safe saves | B21, U1–U5, F4, X6, ~~two Linked Views checks~~ (done 09-28), export-time check, CHANGELOG catch-up | ~29h |
| W3 | Oct 12–16 | Editor UX pass | U8–U10, U12–U16, U18, U20, U21 | ~29h |
| W4–5 | Oct 19–30 | Crisp PDF + PPTX exports, optional stages | X3, X4, ~~S1~~, ~~F8~~ (done 09-28) | 4–7d |
| W6–7 | Nov 2–13 | Site analysis stage | S2 | 1.5–2.5w |
| W8–9 | Nov 16–27 | Images to Supabase Storage | F6 (needs dashboard access) | 1–2w |
| W10–11 | Nov 30–Dec 11 | Full-resolution photos, sharp floor plans, lighter editor previews | X1, X2, X7 | 4–7d |
| W12–13 | Dec 14–25 | Animated GIFs + uploaded videos | X8, X9 | 6–9d |
| W14 | Dec 28–Jan 1 | Home + accessibility + conflicts | Home card grid, U23–U26, F5, V3–V5, F3 | ~31h |
| W15 | Jan 4–8 | Presenter features + Windows app | ~~F1~~ (done 09-28), U7, U22, E1 | ~33h |
| W16 | Jan 11–15 | Power tools & pickers | ⌘K palette, layout picker + U11, concept-library rework, audience defaults | ~31h |
| W17 | Jan 18–22 | Safety & plans | F2, F9 | ~24h |
| W18 | Jan 25–29 | Freeform & export | Freeform selection/resize/z-order, copy/paste, per-view export, vertex truncation, duplicate-key warning | ~32h |
| W19–23 | Feb 1–Mar 5 | Offline + multi-user sync, like Google Slides (provisional) | E2 | 4–5w |
| W24 | Mar 8–12 | Login (staff only) | Company Google login for officebanao.com/.in and skvindia.com/.in, plus RLS (needs dashboard access) | ~1w |
| W25 | Mar 15–19 | Figma-style multi-user | M1 | 4–6d |
| W26 | Mar 22–26 | Share link | X5 | 2–3d |
| W27+ | from Mar 29 | Collaboration | Figma-style comments (after login), BOQ table | ~1.5–2w |
| Later | unscheduled | Big or optional | F7, F10, E3 (Mac app), bowtie morph, kind-change crossfade; typology + brand profiles (blocked on you) | ~3.5–4.5w + blocked |

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
      restructure isn't built · **1d · W14**
- [ ] ⌘K command palette over `editorStore`'s ~50 named actions (B) —
      Phase 4 of the 2026-09-21 UI rework, unbuilt · **1–2d · W16**
- [ ] Searchable layout/concept-picker dialog with real slide previews (B) —
      same Phase 4, unbuilt · **1d · W16**
- [ ] Concept-library dialog rework (B) — Phase 6 of the 2026-09-21 rework,
      unbuilt · **1d · W16**

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
      Presenter sidebar dropped its own icon rendering (A) · **30m · W1**
- [ ] Element-level selection + resize + z-order for freeform elements (B) —
      never built; prerequisite for element-level keyboard nudge and
      on-canvas multi-select · **2–3d · W18**
- [ ] Copy/paste (Ctrl+C/V) for slides/elements (B) — deliberately deferred,
      Ctrl+D covers "copy in place" for now · **1d · W18**
- [ ] Comments, like Figma (C) — last item of Phase G, never started.
      **Scoped 2026-09-28:** pin a comment to any spot on a slide, reply in
      a thread, @mention a colleague, and mark a thread resolved (or reopen
      it). A comments panel lists open and resolved threads. Mentioned people
      get an email as well as a notification inside Presenta. Comments never
      appear in Presenter, the share link or exports. They sync live and
      offline along with the deck (E2). Needs login for names and emails,
      and an email-sending service. For mail to come from an
      `@officebanao.com` address without landing in spam, someone with
      access to the domain's DNS settings needs to add a few records
      · **1–1.5w · W27+ (after login)**
- [ ] Real Google-account login + viewer/editor sharing (C, needs schema/RLS
      work) — parked, fully architected (Supabase Auth + Google OAuth,
      `owner_id`/`project_collaborators`, real RLS) but not started; the DB
      is currently fully open — any anon-key holder can read/write any
      project. **Scoped 2026-09-28:** staff only, up to 7 at once. People
      sign in with a company Google account on `officebanao.com`,
      `officebanao.in`, `skvindia.com` or `skvindia.in`, and any other
      account is refused. Everyone signed in can open and edit every deck,
      so no per-deck sharing screen is needed yet. Works in both the
      browser and the desktop app. **Confirm before building:** whether all
      four domains use Google Workspace (believed to be Gmail only). If any
      uses Microsoft 365, add Microsoft sign-in too, about 1 extra day
      · **~1w · W24 (needs dashboard access)**

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
- [x] ~~Two zone hotspots sharing the same `zoneCategory`/label with their own
      separate children~~ (2026-09-28): proven live in both directions of a
      Burst transition. Each pair of rooms starts as an exact copy of its own
      parent zone and merges back into it, never the other "Meeting" zone.
      See PROGRESS.md 2026-09-28 (cont'd).
- [x] ~~A hotspot on only one side of a transition, ghost fade-in/out path~~
      (2026-09-28): watched frame by frame in Burst and Fade. A region only
      on the old stage fades out in place and one only on the new stage fades
      in; in Fade no room's outline changes in any frame.

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
      not tested live · **½d · Later**
- [ ] Very divergent hotspot shapes can self-intersect into a momentary
      "bowtie" mid-morph frame (B) — known, accepted limitation of
      per-vertex lerp, not fixed · **1–2d · Later**
- [x] ~~**S1** Every stage is optional~~ (2026-09-28). "+ Stage" opens a
      picker with the six suggested stages to tick (Site analysis, Zoning,
      Walls, Circulation, Furniture, Design consideration) and a custom name,
      in one Add. Suggested stages slot into that order; custom ones go last.
      Render and Axo views get the name field only. The picker is on the
      slide and in the Properties panel's Stages list, by the user's choice.
      Site analysis and Design consideration are ordinary stages for now,
      with their own image and regions, until S2 decides more. See
      PROGRESS.md 2026-09-28 (cont'd).
- [ ] **S2** Site analysis stage (requested 2026-09-28): the site
      due-diligence plan, with about 90 checklist items in 6 categories
      (Access & Circulation; MEP; Fire & Life Safety; Natural &
      Environmental; Regulatory & Landlord). Each item appears as a marker
      (an icon placed on the plan), a line (a route, pipe or wall), an area
      (a shaded region), or a fact (a row in a checklist table beside the
      plan). Each entry carries a note, a value and a status (Verified, To
      verify, Not available). Categories work as layers that can be shown or
      hidden. The full list and proposed design are in
      `docs/site-analysis-checklist.md` (C) · **1.5–2.5w · W6–7**

## Linked Views — background, key-plan, seating

- [x] ~~Background music + key-plan card per stage~~ (2026-09-18)
- [x] ~~Seating Capacity table (Area/Required/Achieved, two-way hover, Excel import)~~ (2026-09-17)
- [x] ~~Seating Capacity collapsible, then closable with reflow into freed width~~ (2026-09-22/24)
- [x] ~~Space Detail overlay (concept/renders/walkthrough/occupancy/BOQ on hotspot click)~~ (2026-09-18)
- [ ] Real editable BOQ line-item table (B) — still a placeholder note,
      parked deliberately · **2–3d · W27+**

## Presenter

- [x] ~~Presenter nav bar: step counter, dots, hover thumbnail preview, progress bar~~ (2026-09-16/17)
- [x] ~~Dot-row grouped by section-starter/design-option~~ (2026-09-16/22)
- [x] ~~Persistent section sidebar (icon + label, collapsible)~~ (2026-09-24)
- [x] ~~Fill-screen fit, no letterbox bars (`ScaledStage` `fit="cover"`)~~ (2026-09-24)
- [x] ~~Linked Views plan no longer overflows the slide (flex shrink-to-fit)~~ (2026-09-22)
- [x] ~~Speaker notes + laptop presenter view, full screen, present from this
      slide, Home/End/number/black-screen keys, swipe (F1)~~ (2026-09-28,
      commit 4411214)
- [ ] A real successfully-saved section-starter title/icon shown after a
      full reload into Presenter (A) — blocked by this sandbox's save
      flakiness, not a known code defect; never independently proven in a
      real browser · **15m · you, W1**

## Export

- [x] ~~Client-side PDF/PPTX export (`exportDeck.ts`)~~ (pre-existing)
- [x] ~~Python batch-export tool (Selenium-driven, prod-build server)~~ (2026-09-17)
- [ ] Confirm real export time for a 160+-slide deck (A) — never confirmed
      cleanly end-to-end; one attempt's log was lost · **1h · W2**
- [ ] Per-slide view/stage export control for Linked Views (B) — currently
      exports only the first view/stage; the limitation is disclosed via a
      menu notice, not fixed · **1d · W18**

## Desktop app, offline & multi-user (requested 2026-09-28)

Why: an installed app is easier for the team to use than a browser tab.
Windows comes first; Mac follows in a later phase. **Both versions stay:**
people can use Presenta in the browser or install the desktop app, whichever
they prefer, and everything below works the same in both.

- [ ] **E1** Windows desktop app (Electron). Presenta installs like any
      Windows program, with its own window, taskbar icon, Start-menu entry,
      installer and automatic updates. The app carries its own copy of
      Presenta, so it opens without internet. The browser version stays
      available alongside it, so people choose which to use. Needs a decision on a code-signing certificate, which has a
      yearly cost: without one, Windows warns "unknown publisher" on
      install. `/api/import-slide` can't ship inside the app because it
      holds the Gemini key (see B22) (B) · **3–5d · W15**
- [ ] **E2** Offline and multi-user sync, like Google Slides, in both the
      browser and the desktop app. Decks you've opened stay on your
      computer. Edits made offline are kept locally and merged automatically
      when the connection returns, along with changes other people made in
      the meantime. When everyone is online, each person's edits appear on
      the others' screens live, and text merges letter by letter, so two
      people typing in the same box don't overwrite each other. Nobody's
      changes get silently overwritten any more (today, whoever saves last
      wins). In the browser, the app itself is also cached so it opens
      offline. Built on a
      live-sync document model (a CRDT such as Yjs). Needs F6 first, because
      images can't live inside the synced deck data. Replaces F3 and most of
      F4 (C) · **4–5w · W19–23 (provisional)**
- [ ] **M1** Figma-style multi-user for Officebanao staff, designed for up
      to 7 people at once. Several people can work on the same slide at once. Each
      person's cursor moves live on the canvas with their name. A coloured
      outline shows what each person has selected or is editing. Avatars
      show who's in the deck, and the slide rail shows who is on which
      slide. Clicking an avatar jumps to where that person is. Needs login,
      for names and faces (C) · **4–6d · W25 (after login)**
- [ ] **E3** Mac desktop app, in a later phase. Needs an Apple Developer
      account for signing, which has a yearly cost (B) · **2–3d · Later**

## Crisp output & media (requested 2026-09-28)

Why: text, floor-plan lines and photos all look slightly soft in all four
outputs (PDF, PPTX, share link, projector). The causes, biggest first:
photos are shrunk to 1400px wide and JPEG-compressed on upload
(`imageFile.ts:27`), and logos to 400px (`imageFile.ts:12`), because images
live inside the deck's database row. Floor-plan PDFs are flattened into a
2400px-wide picture on upload (`pdfPlan.ts:21`). PDF and PPTX exports are
2560×1440 screenshots of each slide (`exportDeck.ts:95-98`), so their text
and lines are pixels. On screen, the slide is centred with a half-pixel
offset and CSS scaling (`ScaledStage.tsx:76`), which can soften text on a
projector.

- [ ] **X1** Full-resolution photos and logos. The original is uploaded to
      Supabase Storage, and a version sized for the screen (up to 4K) is
      shown, instead of everything being shrunk to 1400px. Needs F6 (C)
      · **1–2d · W10–11 (after F6)**
- [ ] **X2** Sharp floor plans at any zoom. The original plan PDF is kept
      and redrawn at the size it's shown (and at export size), instead of
      being a fixed 2400px picture. Snapping stays the same. Needs F6 (C)
      · **2–3d · W10–11 (after F6)**
- [ ] **X3** Vector PDF export. Text and lines stay sharp at any zoom,
      photos go in at full resolution, and fonts are embedded. It uses the
      browser's own print engine: one click in the desktop app, and the
      print dialog's "Save as PDF" in the browser (B) · **3–5d · W4–5**
- [ ] **X4** Sharper PPTX. Slide pictures go in at 4K (3840×2160) and are
      added one at a time, so big decks don't run out of memory. Fully
      sharp, editable PowerPoint text is F7 (B) · **1–2d · W4–5**
- [ ] **X5** Share link. A view-only link to a deck opens in the browser
      and shows the live slides, so text, lines and photos are as sharp as
      the screen allows. To decide: whether only staff can open it, or
      clients too without logging in (C) · **2–3d · W26 (after login)**
- [ ] **X6** Sharper text on the projector and in the editor. The slide is
      placed on whole pixels and scaled so the browser draws text at its
      final size (B) · **½d · W2**
- [ ] **X7** Lighter previews in the editor, like InDesign, but automatic.
      In the editor and the slide rail, photos and floor plans load a
      version sized for how big they are on screen (about 1600px on the
      canvas, about 300px in the rail), and a sharper version loads as you
      zoom in. Presenter and the share link get screen-sized versions up to
      4K, and exports always use the original. Text and lines stay sharp
      everywhere. Snapping and measuring use the plan's exact line data, so
      accuracy is unaffected. This is what keeps the editor fast once photos
      are full resolution. The smaller versions are made on upload (C)
      · **1–2d · W10–11 (with X1, X2)**
- [ ] **X8** Keep GIFs animated. Today every uploaded picture is turned into
      a still JPEG (`imageFile.ts:26`), so a GIF loses its animation. The GIF
      file will be kept as it is: a still frame that animates on hover in the
      editor and rail, animated in Presenter and the share link, a still frame
      in PDF (which can't animate), and the animated GIF itself in PPTX, which
      PowerPoint plays in a slideshow. Needs F6 (C) · **2–3d · W12–13**
- [ ] **X9** Better video handling. Today videos can only be pasted as a
      link, every rail thumbnail loads its video, and exports can't capture
      video. The plan: the editor and rail show a still poster frame, and the
      video only loads when you press play. Presenter and the share link play
      full quality, with the next slide's video loaded in advance so it
      starts at once. In the desktop app, videos in decks you've opened can
      be kept for offline playback (with E2). PDF gets the poster frame plus a
      link to the video, and PPTX embeds the video so it plays in PowerPoint.
      **Decided 2026-09-28:** actual video files are uploaded, not links.
      Uploads show progress and resume if the connection drops, and a
      poster frame is taken from the video on upload. Needs F6 (Storage),
      and big walkthroughs need a paid Supabase plan, because the free
      plan's file-size limit is too small (C) · **4–6d · W12–13**

## Concept library / imports

- [x] ~~Concept Library gallery + "already in deck" tracking~~ (pre-existing)
- [x] ~~"As is" full-bleed image slides from a real client PPTX~~ (2026-09-17)
- [x] ~~Per-element freeform reconstruction of PPTX slides (editable image/text/shape)~~ (2026-09-17)
- [x] ~~Qualcomm 163-slide PDF bid-deck import~~ (2026-09-16)
- [ ] Typology-driven template population — needs the real typology list and
      which concept-library pillars belong to each; blocked on the user
      · **1–2d · blocked: needs the typology list**
- [ ] Brand (OB/SKV/Both) → auto-populated company-profile slides — needs
      the real source decks for each brand's profile; blocked on the user
      · **1–2d · blocked: needs the source decks**
- [ ] Audience-based slide defaults (Leadership vs. Client) (A) — a
      two-option proposal is on the table, not yet confirmed as final
      · **½d · W16 (after your decision)**

## Data / Supabase / migrations

- [x] ~~Client logo / accent / font / typography columns + migrations written~~ (2026-09-15)
- [ ] **Run migrations `0003_add_client_logo.sql`/`0004_add_font_family.sql`/
      `0005_add_typography.sql` in the Supabase dashboard SQL Editor** —
      blocked; this session only ever has the public anon key, which can't
      run DDL. The exact ready-to-paste SQL has been handed over multiple
      times (see PROGRESS.md 2026-09-15 and 2026-09-24). The missing-
      migration banner is a real, live warning until this runs — not
      cosmetic, and no code change is needed once it does. · **10m · you, W1**
- [ ] Real Google-account login + RLS (see Editor chrome, C) — parked
      · **see Editor chrome**

## Known bugs (open)

- [x] ~~`.font-display` silently falls back to Arial on real slide content~~
      (2026-09-25, fixed; commit c3253c9): the Default pairing made `--font-archivo`
      refer to itself; slides now use `--slide-display-font`/`--slide-body-font`
      and the slide root has `font-sans`, so body text also gets the deck's
      font for the first time. See PROGRESS.md 2026-09-25 (cont'd).
- [ ] Vertex-truncation on a dense real PDF plan degrades an exact corner
      to a nearby edge-snap instead — root-caused, reproducible, not fixed.
      `decimate()` (`src/lib/pdfPlan.ts`) needs to prioritize vertices
      belonging to a segment that survived its own length-sort, the same
      way `segments` already prioritizes real walls over hatching. · **½d · W18**
- [ ] The real "Ecom Express" project's Seating Capacity table has one row
      with a stray extra `hotspotIds` entry from a live mis-click during the
      actual client meeting — a data cleanup, not a code fix. · **10m · you, W1**
- [ ] A pre-existing React "duplicate key" console warning shows up on at
      least one seed/test project — never tracked down, unrelated to any
      one feature. · **1h · W18**
- [ ] Rail thumbnails and Concept Library previews render slides without
      `silent`, so a Linked Views slide whose *first* view has background
      music would play it from the thumbnail too. Not reachable through the
      UI (the first view is Layout, which can't take a track), only through
      imported or hand-edited data. Fix: pass `silent` in `SlideRail.tsx` and
      `ConceptLibraryDropdown.tsx` (B) · **15m · Later**

## Whole-app review (2026-09-25)

Found in a read-only review (design review, `impeccable` detector, and a code
trace). The full report is in
`.impeccable/critique/2026-09-25T12-44-58Z__src-app.md`. The IDs match the list
given in chat. Severity runs from P0 (blocking) to P3 (polish).

### Bugs (confirmed)
- [ ] **B1 P0** Rail thumbnails squash to 4–9px on decks longer than about 7 slides.
      Each tile is a flex item with `overflow-hidden` and no `shrink-0`
      (`SlideRail.tsx:141`) (B) · **15m · W1**
- [ ] **B2 P1** Delete/Backspace deletes the whole slide whenever focus isn't
      in a text field. That includes mid-drawing (where Backspace is meant to
      remove the last point) and right after clicking an image. Backspace in the
      new-region popup's inputs removes a shape point instead of a letter
      (`edit/page.tsx:126-131`, `SlideRenderer.tsx:1282-1305`) (C) · **2h · W1**
- [ ] **B3 P1** Changing Layout or Style replaces the fields with defaults,
      even when re-picking the current one. Style also forces the layout
      (`editorStore.ts:496-518`) (C) · **½d · W1**
- [ ] **B4 P1** Presenter always re-fetches the deck and calls `loadProject`.
      That wipes undo, can show a copy from before the last save, and after Esc
      the editor keeps that copy, so the next edit overwrites the save that was
      in flight. `mode` also stays `presenter` (`present/page.tsx:52-65`,
      `edit/page.tsx:73-76`, `editorStore.ts:242-250`) (C) · **½d · W1**
- [ ] **B5 P1** Image and logo adjust drags stop after the first pointermove.
      The inline `onChange` changes `onPointerMove`'s identity, and the cleanup
      effect then removes the window listeners. This is the same bug that was
      fixed in `FreeformElementWrapper` on 09-21 (`ImageAdjustOverlay.tsx:43-96`,
      `LogoAdjustOverlay.tsx:45-78`, `onChange` at `SlideRenderer.tsx:378`) (B)
      · **1h · W1**
- [ ] **B6 P1** The hero video and background image are `-z-10` inside a
      wrapper that isn't isolated, so the wrapper's own background paints over
      them and the hero title becomes white on white. A background image is also
      hidden whenever a colour is set (`SlideRenderer.tsx:537-545, 4029-4035`;
      fix: `isolate`) (C) · **30m · W1**
- [ ] **B7 P1** At 100% the editor canvas is off-centre and clipped (at
      1440×900: 192px empty on the left, the right 21% cut off). The cause is a
      1280px layout box with `margin:auto` and a scale from the centre. When
      zoomed in, the top-left can't be scrolled to (`ScaledStage.tsx:98-110`) (B)
      · **1h · W1**
- [ ] **B8 P1** The Ecom Express deck uses `/demo-assets/layout.jpg`, which
      doesn't exist (404). Needs the right image from the user (C)
      · **15m · W1 (after you send the image)**
- [ ] **B9 P2** Line breaks are dropped on save because `EditableText` saves
      `textContent` (`EditableText.tsx:66`) (B) · **1h · W1**
- [ ] **B10 P2** Linked Views viewer state (zoom, measure mode, a half-drawn
      shape, an open popup) carries over to the next Linked Views slide. There's
      no `key={slide.id}` (`present/page.tsx:143`, `edit/page.tsx:423`) (B)
      · **30m · W1**
- [ ] **B11 P2** Deleting a slide deletes every hotspot elsewhere that
      targets it, with its gallery, space detail and seating links, instead of
      just unlinking it (`editorStore.ts:144-164`) (C) · **1h · W1**
- [ ] **B12 P2** The Add slide menu offers the E-Com Express client's
      reference slides in every deck (`edit/page.tsx:303-313`). Needs a
      decision (B) · **30m · W1 (after your decision)**
- [ ] **B13 P2** The client logo's size, rotation and opacity are never
      saved: there's no field in the save/load row and no column
      (`data.ts:180-194`) (C) · **1h · W1 + a migration you run**
- [ ] **B14 P3** The Design Option input trims on every keystroke, so
      "Option 1" becomes "Option1" (`PropertiesPanel.tsx:297`) (B) · **15m · W1**
- [ ] **B15 P3** In Presenter, Space and the arrow keys always change slide.
      A walkthrough video can't be paused, and the arrows act behind the
      space-detail popup (`present/page.tsx:67-81`, `SpaceDetailOverlay.tsx:30-42`) (B)
      · **1h · W1**
- [x] ~~**B16 P3** A North drag or Unlock can revert a stage rename made just
      before~~ (2026-09-28, with S1/F8): stage writes now go through the
      store's `updateLinkedView`, which patches the view as it is in the deck,
      and the panel's snapshot re-registers when the stages change. Verified:
      rename, then North drag and Unlock from the panel, and the name stays.
- [ ] **B17 P3** Undo and redo leave stale multi-selection ids, showing a
      phantom "N selected" toolbar (`editorStore.ts:307-335`) (C) · **30m · W1**
- [ ] **B18 P3** Excel import matches headers by substring, so "Zone Name"
      hits the area column; with no zone column, every row becomes its own zone
      (`importExcel.ts:21-58`) (B) · **1h · W1**
- [ ] **B19 P3** Deleting a project on Home removes the row even when the
      delete fails, because errors are swallowed (`page.tsx:114-116`,
      `data.ts:204-207`) (B) · **30m · W1**
- [ ] **B20 P3** At phone width, Presenter's controls pill can overlap the
      dot row. Swipe landed with F1, and on a touch screen the pill now drops
      its key hints (two buttons, 68px), which clears a short deck; a long
      deck's dot row (up to 70vw) can still reach it (B) · **30m · W1**

### Bugs (likely, not proven)
- [ ] **B21** Save pipeline: concurrent full-row saves can land out of order.
      "Saved" can show while a newer save is still running, or after an update
      that matched 0 rows. While 0004/0005 are pending, every save uploads
      twice. Controls that save per keystroke each push an undo entry and
      upload the whole row (`editorStore.ts:176-215`, `data.ts:196-200`).
      Investigate first (A), then fix (C) · **1–2d · W2**
- [ ] **B22** `/api/import-slide` spends `GEMINI_API_KEY` with no auth, and
      nothing calls it (`importSlidesFromPdf` has no caller). Remove or protect
      it before any public deploy (B) · **30m · W1 (after your decision)**

### Presenter UX
- [ ] **U1** Crop-to-fill (chosen 2026-09-24) crops 12.5% per side at 4:3 and
      about 5% at 16:10; at 1024×768 the kicker and a link are cut. Decide:
      keep it, fill near 16:9 and fit otherwise, or always fit (A)
      · **1h · W2 (after your decision)**
- [ ] **U2** The controls around the slide are always on. They cover about
      20% of the screen at 1440×900 (27% at 1024×768) and read at 1.4–2.5:1 over
      white slides. Hide them after a few idle seconds and make the pills
      opaque (B) · **½d · W2**
- [ ] **U3** The client sees presenter-only UI: "← → navigate · Esc exit", a
      disabled "Dimensions — Calibrate this plan first" button
      (`SlideRenderer.tsx:2892-2911`), and the 🙈/👁 overlay toggle. Since F1 the
      same bottom-right pill also carries Presenter view and Full screen
      buttons and "? shortcuts" (C) · **2h · W2**
- [ ] **U4** No end-of-deck screen (→ on the last slide does nothing). Esc
      drops into the editor with the migration banner showing. (Full screen on
      start landed with F1: Present and Present from the beginning ask for it;
      With presenter view deliberately doesn't.) (B) · **3h · W2**
- [ ] **U5** 163 nav dots on the Qualcomm deck (B) · **2h · W2**
- [ ] **U6** Presenter still uses the warm `#171310`/`#241d16` while dark
      mode is the cool `#0d1017`. The comment at `globals.css:135-138` says
      they match (B) · **30m · W1**
- [ ] **U7** Plan hotspots can't be reached by keyboard: they're clickable
      SVG paths with no tab stop or role (C) · **1d · W15**

### Editor UX
- [ ] **U8** The Linked Views tools are split between the canvas (split
      style, Dimensions, remove image) and the panel (drawing, Calibrate,
      North). Stage editing now lives in both on purpose (S1/F8, the user's
      choice on 2026-09-28) (C) · **1d · W3**
- [ ] **U9** Controls drawn inside the slide render at about 8px at 1440×900
      (about 6.5px at 1280) (C) · **1d · W3**
- [ ] **U10** The hotspot popup packs about 18 fields into a 240px card inside
      the scaled slide, and uses placeholders as labels (C) · **1d · W3**
- [ ] **U11** Decision points with more than 4 options: Layout menu 14, Add
      slide 8, Linked View Tools 8, Section Icon 10, Typography 20 buttons (B)
      · **1d · W16**
- [ ] **U12** Collapsed Properties sections don't show their current value (B)
      · **2h · W3**
- [ ] **U13** Jargon: "Freeform (Imported)", "Stat Hero", "Axo", "Merge
      Diagram". "Default" sits next to "Studio", "Standard" and "Normal". The
      split-style tooltip talks about a "same-id match" (B) · **1h · W3**
- [ ] **U14** The rail's actions are bare symbols (⧉ ⃠ ✕ ⌫, where ⌫ means
      clear selection), while the toolbar uses icons for the same actions (B)
      · **1h · W3**
- [ ] **U15** Shortcut hints show ⌘ on Windows (B) · **30m · W3**
- [ ] **U16** The migration banner can't be dismissed and tells users to run
      SQL, and the controls it warns about stay enabled. Error messages show raw
      database errors and "see console" (B) · **2h · W3**
- [ ] **U17** The Layout menu only shows its ✓ when the style is Standard
      (`edit/page.tsx:357`) (B) · **15m · W1**
- [ ] **U18** Rail thumbnails lay slides out at 652px wide, not 1280, so text
      wraps differently from the real slide (B) · **2h · W3**
- [ ] **U19** The copy "BOQ note (placeholder — real table coming later)" is
      visible to users (C) · **15m · W1**
- [ ] **U20** The only way back to Home is the "P" badge (B) · **30m · W3**
- [ ] **U21** Menus use `role=menu` but have no arrow-key navigation, and
      their triggers lack `aria-haspopup` (B) · **2h · W3**
- [ ] **U22** Exporting 163 slides has no cancel and no time estimate (B)
      · **½d · W15**

### Home UX
- [ ] **U23** Duplicate names (5× "Ecom Express", 4× "xx") can't be told
      apart, and there are no thumbnails or client logos (B) · **2h · W14**
- [ ] **U24** At 1024×700 the first project row starts at y=510 (B) · **1h · W14**
- [ ] **U25** "Presentation date" is read-only. Search says "name or client"
      but there's no client field. The heading says "New presentation" and the
      button "+ Create New File" (B) · **1h · W14**
- [ ] **U26** Esc doesn't close the create form. The delete icon is 16×16 and
      sits 16px from "Open →" (B) · **30m · W14**

### Visual system & accessibility
- [ ] **V1** `--app-ink-3` (`#8a93a3`) measures 2.7–3.1:1 on panel headers,
      "Slide 1 of 7", the footer hints and "Powered by Officebanao" (2.8:1). It
      was 4.8:1 after the 09-21 pass. Use about `#636b7a`
      (`globals.css:59, 102`) (B) · **30m · W1**
- [ ] **V2** Most chrome text renders in the `body` Arial default
      (`globals.css:307`); the Helvetica stack only reaches a few elements (B)
      · **30m · W1**
- [ ] **V3** 10–11px chrome text: the hint strip, the "VIEWS" badges and the
      rail's slide-number badges (B) · **1h · W14**
- [ ] **V4** Rail tiles have no accessible name. The "Select slide" buttons
      are at opacity 0 when focused (`SlideRail.tsx:192-196`). 12 tab stops sit
      inside the thumbnails (B) · **2h · W14**
- [ ] **V5** Save and export status is never announced (no `aria-live`), and
      editable slide fields have no labels (B) · **2h · W14**

### Missing features
- [x] ~~**F1** Presenter: fullscreen, present from the current slide,
      Home/End/jump to a number/black screen, speaker notes with a laptop
      presenter view, and swipe~~ (2026-09-28, commit 4411214). See
      PROGRESS.md 2026-09-28.
- [ ] **F2** Version history. The `project_versions` table in
      `0001_init.sql` is unused (C) · **2–3d · W17**
- [ ] **F3** Conflict detection across tabs and people: saves are whole-row
      with no `updated_at` check. A stopgap until E2 replaces it (C)
      · **1d · W14**
- [ ] **F4** Save retry, offline detection, and an unsaved-changes warning
      on close. A stopgap until E2 covers most of it (C) · **1d · W2**
- [ ] **F5** Home: rename and duplicate a project, an editable date, a
      client field, thumbnails (B) · **1–2d · W14**
- [ ] **F6** Store images in Supabase Storage instead of as base64 in the
      row (decks run up to about 5.2 MB) (C)
      · **1–2w · W8–9 (needs dashboard access)**
- [ ] **F7** Editable PPTX export (currently one PNG per slide). Export
      also holds every slide as a 2× PNG in memory. This is the full fix
      for sharp PowerPoint text, and X4 is the interim one. PowerPoint needs
      the deck's fonts installed on the viewing PC, or it swaps in others
      (B) · **2–3w · Later**
- [x] ~~**F8** Delete and reorder stages~~ (2026-09-28). Rename, move earlier
      or later, and delete, from the selected stage on the slide or from any
      row of the panel's Stages list. Deleting asks what happens to regions
      only on that stage: carry them to other stages (the neighbour is
      ticked) or delete them. With no stages left they can stay on the plan,
      and a last stage's own image becomes the plan's. See PROGRESS.md
      2026-09-28 (cont'd).
- [ ] **F9** A deck-import UI. `importSlidesFromPdf` has no caller (ties to
      B22) (B) · **1–2d · W17**
- [ ] **F10** Search within a deck; templates and "save as template" (B)
      · **2–3d · Later**

### Code health
- [ ] **L1** 2 `rules-of-hooks` violations after an early return
      (`SlideRenderer.tsx:1676, 1690`). They can't fire today, but they're
      fragile (C) · **1h · W1**
- [ ] **L2** Lint: 16 errors and 6 warnings in total. The rest is noise:
      the refs pattern, immutability, set-state-in-effect, 1 a11y
      (`aria-selected` on `role=button`) and 5 unused disable comments (B)
      · **1h · W1**

## Dev tooling / process

- [x] ~~`PROGRESS.md` set up + `SessionEnd` hook~~ (2026-09-15)
- [x] ~~`impeccable` design-detector skill installed + hook enabled~~ (2026-09-25)
- [x] ~~`emilkowalski/skill` pack installed (animate, apple-design, prototype, etc.)~~ (2026-09-25)
- [x] ~~This checklist (`FEATURES.md`) + commit/gitignore cleanup~~ (2026-09-25)
- [ ] Cut the first git worktree(s) for a ready (B)-bucket item (B/C
      classification is defined above; no worktree exists yet)
      · **30m · when a parallel chat starts**
- [ ] `CHANGELOG.md` is stale (last touched 2026-09-08) — not kept in sync
      with `PROGRESS.md`'s pace; not fixed as part of this checklist's setup
      · **1h · W2**
