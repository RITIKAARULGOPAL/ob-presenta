# Progress Log

This file exists so a Claude Code session — yours or a teammate's, on any
account, on any machine — can pick up exactly where the last one left off,
just by opening this repo. It travels with the repo via git, which is what
makes it work across accounts: **it only helps once it's committed and
pushed.** Uncommitted changes on your machine are invisible to anyone else
regardless of what this file says, so treat "commit + push" as part of
closing out a session, not an optional extra.

`CLAUDE.md` pulls this file in automatically (`@PROGRESS.md`), so it's loaded
into context at the start of every session without anyone needing to paste
or re-explain anything.

**Protocol:**
- Newest entry at the top.
- Keep entries short — link to files/commits instead of re-describing them.
- Write "Left off / next up" as if to a stranger: what's half-done, what's
  next, what to watch out for. That's the part a `git log` can't tell you.
- At the end of a session, just ask ("update the progress log") — the
  session summarizes itself, you review it, then commit it along with the
  code changes it describes.
- A `SessionEnd` hook (`.claude/settings.json`) also does this automatically
  if you close a session with uncommitted changes and forget to ask: it
  can't reliably invoke Claude itself non-interactively, so instead it drops
  the raw git facts into `PROGRESS.md.pending`. The next session (any
  account) folds that into a proper entry here and deletes the pending file
  — see the instruction in `CLAUDE.md`.
- This complements `CHANGELOG.md`, it doesn't replace it: `CHANGELOG.md` is
  the durable "what shipped" record; this file is disposable working state —
  prune old entries once they're no longer anyone's "next up."

---

## 2026-09-21 (cont'd 2) — Dark/light comfort pass

**Context:** follow-up to the dark/light entry below, after the user asked what
to look at to make a theme genuinely comfortable. Four things came out of that
review; all four are done.

**Done:**
- **Softened the canvas surround in dark** — new `--app-canvas` token in
  [globals.css](src/app/globals.css), applied to the editor stage
  ([edit/page.tsx](src/app/p/[id]/edit/page.tsx)) and the rail
  ([SlideRail.tsx](src/components/SlideRail.tsx)). It is the one surface that
  deliberately breaks the elevation ladder: in dark it is *lighter* than the
  panels (`#222b38` vs `#121a25`), because its job is to sit behind a bright
  white page. Near-black behind a white slide was ~19:1 across most of the
  screen, which is what made long editing sessions tiring. Light is unchanged
  in practice (the rail moves `#f8fafc` → `#f1f5f9`, imperceptible).
- **`<meta name="theme-color">`** now driven from `applyTheme()` and the inline
  script in [theme.ts](src/lib/theme.ts), *not* from Next's
  `viewport.themeColor`. That API only keys off `prefers-color-scheme`, so it
  would show the wrong colour for anyone who overrode their OS in the toggle.
- **A real `:focus-visible` ring.** `outline-none` appears ~52 times with
  nothing replacing it, so tabbing through the editor showed no focus at all.
  New `--app-focus` token (a dedicated colour, not the accent, so it still
  reads on `--app-surface` in dark) plus one scoped rule. `[contenteditable]`
  is excluded on purpose — a ring around every slide field would be noise on
  the artifact.
- **`forced-colors` block** for Windows High Contrast: keeps real borders on
  chrome controls whose edge is otherwise carried by a background colour, and
  hands the focus ring to `Highlight`. The slide surface is left out, same
  reasoning as dark mode.

**Left off / next up:**
- Verified: build passes; `npx eslint` is 17 errors/6 warnings, identical to
  the `dbdcacb` baseline. Checked in Chromium in both themes — canvas/rail
  colours, exactly one `theme-color` meta with the right value per theme,
  focus ring resolving to `#0b72c2`/`#8ac8fb`, and the slide surface still
  `rgb(255,255,255)` in dark (the export regression that matters).
- **The dark canvas value `#222b38` is a first pass and should be judged by
  eye at low screen brightness**, which is exactly when it matters. It is one
  variable if it wants to be lighter or darker.
- Not done, considered: `::selection` colours (browser default is muddy on
  dark panels); the `amber-400`/`emerald-500` save-status dots are still
  literals (they read fine on both surfaces — tidying, not a fix).

**Watch out for:**
- Measuring a focus ring immediately after a synthetic `Tab` gives a false
  reading: Tailwind's `transition` utility animates `outline-color`, so
  `getComputedStyle` in the same tick returns the pre-focus colour mid-
  interpolation. Wait ~300ms before asserting. Cost real time here — it looked
  exactly like a broken cascade.

---

## 2026-09-21 (cont'd) — Dark and light mode

**Context:** asked to "build dark and light mode for the app." Done on top of
the Phase G entry below, on a fresh branch off `main` at `069f72d`.

**Done:**
- **Chrome colours are now a token set** at the top of
  [globals.css](src/app/globals.css): `--app-*` defined once under `:root`
  and once under `[data-theme="dark"]`, registered in `@theme inline` as
  `ui-*`/`hero-*` Tailwind utilities (`bg-ui-surface`, `text-ui-ink-2`,
  `border-ui-line`…). Switching themes re-points variables instead of
  swapping class names. Upstream's `--radius-*`/`--shadow-*` deck scale is
  kept as-is alongside it — that belongs to slides, not to chrome.
- **Light/System/Dark control** ([ThemeToggle.tsx](src/components/ThemeToggle.tsx),
  store in [theme.ts](src/lib/theme.ts)) in the editor header and the
  home screen's top-right. The choice persists in `localStorage`, 'system'
  keeps following the OS live, and another tab switching is picked up. Read
  via `useSyncExternalStore` — the theme is external state (storage + a media
  query), not something a component should hold a copy of.
- **No flash on load:** [layout.tsx](src/app/layout.tsx) runs a blocking
  inline script in `<head>` resolving the choice to `data-theme` before first
  paint — the approach in
  `node_modules/next/dist/docs/01-app/02-guides/preventing-flash-before-hydration.md`,
  including its note that Strict Mode's dev remount wipes the attribute
  (hence the `useLayoutEffect` in ThemeToggle that re-applies it).
- Converted every chrome literal in [page.tsx](src/app/page.tsx),
  [edit/page.tsx](src/app/p/[id]/edit/page.tsx),
  [SlideRail.tsx](src/components/SlideRail.tsx),
  [PropertiesPanel.tsx](src/components/PropertiesPanel.tsx),
  [ConceptLibraryDropdown.tsx](src/components/ConceptLibraryDropdown.tsx) and
  [AccentPicker.tsx](src/components/AccentPicker.tsx) — including all the
  Phase G additions (undo/redo pills, save-status, zoom bar, multi-select
  toolbar, the new panel sections).

**Deliberately NOT themed — read this before "finishing the job":**
- **A slide is not chrome.** `SlideRenderer` paints its own white/ink ground
  from its own `--ink`/`--line`/`--accent` scope, and that is what
  `exportDeck` rasterizes. Theming it would make the canvas stop matching the
  exported PDF/PPTX. Same for anything drawn on a slide: the adjust overlays,
  the rail's thumbnail badges, the concept-library thumbnails.
- **[SpaceDetailOverlay.tsx](src/components/SpaceDetailOverlay.tsx)** looks
  like a modal but is styled entirely from the *slide's* token scope
  (`var(--ink)`, `var(--line)`, `var(--accent-soft)`). Converting only its
  `bg-white` would put dark-navy slide ink on a dark card. Re-basing it on
  chrome tokens is a design decision, not a colour swap — left alone.
- **[Lightbox.tsx](src/components/Lightbox.tsx) and Presenter** stay black in
  both themes: a photo viewer and a projection surface both want a dark
  surround regardless of app theme.
- `SeatingTable`/`HotspotSidePanel` render inside a slide, so they stay
  literal too.

**Left off / next up:**
- Verified: `npm run build` passes; `npx eslint` is 17 errors/6 warnings,
  byte-identical to the `069f72d` baseline (all pre-existing, none in the
  theme work). Driven in Chromium at 1860×940 — editor and home in both
  themes, each toggle option, an OS flip under 'system', and a reload.
- The editor page overflows horizontally at 1440px wide (body scrollWidth
  1824, so the properties panel sits off-screen). **Pre-existing on
  `069f72d`** — measured both with and without this branch — not caused by
  the theme work, but worth fixing.
- Light mode is the palette the app always had, with one deliberate change:
  muted chrome label text `slate-400` → `slate-500` (`--app-ink-3`), 2.6:1 →
  4.8:1 on white. One variable if you want the lighter grey back.

**Watch out for:**
- `@custom-variant dark` in globals.css re-points Tailwind's built-in `dark:`
  at `[data-theme="dark"]`. Without it, `dark:` would silently follow the OS
  and ignore the toggle. Prefer the tokens over `dark:` anyway.
- Add a new chrome colour by adding a variable in **both** `:root` and
  `[data-theme="dark"]` and registering it in `@theme inline` — not by
  reaching for a literal. New slide-surface code is the exception and should
  keep using the slide's own `--ink`/`--line`/`--accent`.

---

## 2026-09-21

**Context:** kicked off Phase G ("tighten the editing experience" — the
checklist from the post-demo action plan: undo/redo, multi-select, real
duplicate, drag-to-reorder, keyboard shortcuts, snapping, comments, canvas
zoom/pan, save-status feedback). Sequenced by dependency/risk: quick isolated
wins first, then undo/redo as the foundation before building anything else
that should be undo-aware from the start.

**Done:**
- **Save-status indicator** — `saveStatus: 'idle'|'saving'|'saved'|'error'` in
  [editorStore.ts](src/lib/editorStore.ts) (replaces the never-actually-set
  `saving: boolean`), flipped synchronously in `persist()` before the
  Supabase call so the UI reflects it immediately, not just on resolve. A
  small dot+label pill next to the project name in
  [edit/page.tsx](src/app/p/[id]/edit/page.tsx) shows it live. Idle (no edit
  yet this session) shows nothing, matching "no news is no news."
- **Real duplicate** — `cloneSlide()` in
  [slideDefaults.ts](src/lib/slideDefaults.ts) deep-copies a slide's actual
  content (previously "add slide" always started from an empty template,
  never copied anything). Regenerates every nested id (stats/items/points/
  orbitNodes/views/hotspots/stages/seating rows/gallery images/elements)
  through a two-pass remap so same-slide cross-references (`stageIds`,
  `hotspotIds`, `targetViewId`) still resolve correctly in the copy, while
  `targetSlideId` (pointing at a *different* slide) is left alone. New
  `duplicateSlide` store action; "⧉ Duplicate slide" button in
  [SlideRail.tsx](src/components/SlideRail.tsx) next to Skip/Delete.
- **Undo/redo** — every mutating action in `editorStore.ts` now funnels
  through one `commitProject()` choke point (pushes the *previous* project
  onto `undoStack`, clears `redoStack`) instead of calling `set`/`persist`
  directly, so undo/redo needed no per-action inverse logic. Capped at 50
  entries; `loadProject` resets both stacks (this is one global store
  instance reused across whichever project is open — without the reset,
  undo could restore a *different* project's history after navigating away
  and back). Ctrl+Z/Ctrl+Y (and Ctrl+Shift+Z) wired in `edit/page.tsx`,
  skipped while focus is inside a text field so the browser's own native
  per-field undo still works while typing. Undo/Redo toolbar buttons next to
  "+ Add slide", disabled via new `canUndo()`/`canRedo()` getters.
- **Found and fixed a real bug during verification**: `EditableText`'s
  `onBlur` fires `onChange` unconditionally, even when the field's text
  didn't actually change (e.g. finishing an edit and immediately clicking a
  toolbar button blurs the field with its own *unchanged* value). Before
  undo/redo existed this was harmless — just a redundant identical save.
  Once undo/redo track history, that no-op blur pushed a spurious duplicate
  entry, so the *first* Undo click after finishing any edit silently undid
  nothing visible (it was consuming the no-op entry, not the real change) —
  a real, if subtle, "undo feels broken" bug that would have hit constantly
  in normal use. Root-caused via temporary instrumentation (traced exact
  call sites, confirmed the second commit was `updateField('subtitle', '')`
  firing from the *next* field's blur when clicking Undo). Fixed at the
  source in `updateField`: skip the commit entirely if the field's value is
  unchanged — correct for every string field (title, body, kicker, etc., all
  `EditableText`-driven) and doesn't affect array-valued fields (those are
  never blur-driven, always represent a real intended change). Verified live
  end-to-end afterward: edit → Undo (first click now correctly reverts) →
  Redo (correctly reapplies), confirmed via `undoDisabled`/`redoDisabled`
  button state at each step, not just the visible text.
- Verified all three features live: created/duplicated slides (including a
  Linked Views slide with 4 nested views, to exercise the id-remap path with
  no crash), round-tripped undo/redo on a fresh project. `tsc --noEmit`
  clean throughout. Cleaned up all scratch test projects created during
  verification.
- **Multi-select (slide rail)** — plain click selects one slide (and clears
  any multi-selection); Ctrl/Cmd-click toggles a slide in/out of the
  selection; Shift-click selects the range from the last click to this one —
  matches the Figma/Slides filmstrip convention. `selectSlide` grew an
  optional `modifier` param (default `'none'`) rather than adding a parallel
  action, so all 8 existing call sites (nav dots, linked-slide chips, hotspot
  jumps) keep working unchanged. New `selectedSlideIds`/`selectionAnchor`
  transient store state — deliberately *not* run through `commitProject`,
  since a UI selection isn't deck content and shouldn't be undoable or
  persisted. `loadProject`/`goNext`/`goPrev` all reset it, so it can't go
  stale pointing at a different project or linger while navigating.
  A small toolbar appears above the rail once 2+ slides are selected
  ("N selected" + skip-all/duplicate-all/delete-all/clear), and each
  thumbnail gets a corner checkbox (hover-visible, always visible once
  anything's selected). New batched actions —
  `duplicateSlides`/`removeSlides`/`toggleSkipMany` — each produce exactly
  **one** `commitProject` call for the whole group, not one per slide; this
  matters now that undo/redo exists, since a loop of single-slide actions
  would otherwise take N undo clicks to reverse what felt like one action.
  Escape clears the multi-selection (only — never deletes); Delete/Backspace
  bulk-removes the selection, scoped tightly to "2+ slides already
  selected" so it can't fire from an incidental single `currentSlideId`
  (that still only has its own explicit ✕ button — no keyboard shortcut yet,
  that's the rest of the keyboard-shortcuts phase item).
- Verified live end-to-end via dispatched DOM events with modifier flags
  (plain coordinate-based clicks drifted between an initial rect capture and
  the actual click in this session's automation, same class of issue noted
  in earlier entries — dispatching directly on the queried element sidesteps
  it entirely): click → ctrl-click → shift-click produced the right
  selection set at each step; bulk duplicate landed both clones and selected
  them, and one Undo click reverted the *entire* bulk duplicate; Delete key
  removed both selected slides in one action; Escape cleared the selection
  without touching the slides. No new console errors beyond the pre-existing
  migration 400s.
- **Drag-to-reorder — slides.** Native HTML5 drag-and-drop on each
  [SlideRail.tsx](src/components/SlideRail.tsx) thumbnail: drag one slide
  over another, drop in its top or bottom half to insert before/after it (a
  thin blue insertion line shows which). New `moveSlide(id, toIndex)` store
  action — `toIndex` is an insertion point counted against the *current*
  order (0..length), which the rail derives from which half of the drop
  target the pointer is over. One `commitProject` call per drop, so one
  Undo click reverts a whole reorder regardless of how far the slide moved.
- **Drag-to-reorder — in-slide elements.** Scoped down from "reorder" to
  "move": for the `'freeform'` layout (the only layout with independently
  positioned objects), every image/text/shape element can now be
  drag-repositioned on the canvas — a real, user-visible gap versus
  Figma/Slides that didn't exist before today. New `FreeformElementWrapper`
  in [SlideRenderer.tsx](src/components/SlideRenderer.tsx) owns the pointer
  gesture and absolute positioning; children (an image via `MediaBox`, a
  text box, or a plain shape div) just fill it at 100%/100% and keep their
  own existing click/edit behavior for a plain click that never crossed a
  4px drag threshold — confirmed safe to layer on top of `MediaBox`'s own
  adjust-mode dragging (pan/zoom/rotate handles) because
  `ImageAdjustOverlay` already stops propagation on every pointerdown
  inside itself, so the two gestures never compete. Live position during
  the drag is local component state (for the visual preview); the actual
  move commits **once**, on release.
  Z-order and resize are explicitly not part of this — this was "move," not
  "reorder + resize"; see below.
- **Found and fixed a real bug while verifying the element-move**: the
  first version called the store's move-commit (`onMoveEnd`) *inside* the
  functional updater passed to `setLive` — `setLive((pos) => { onMoveEnd(pos); return null })`.
  That's exactly the "side effect inside a setState updater" anti-pattern
  React's StrictMode deliberately double-invokes updater functions in
  development to catch, so every single-drag move was silently committing
  **twice** — invisible from the position itself (both commits land on the
  same final coordinates), but very visible in undo/redo: one Undo click
  only undid the *phantom* second commit, leaving the actual move in place
  and making undo look broken. Root-caused by logging each commit's call
  stack (same technique as the 2026-09-21 EditableText fix) and catching a
  second `onMoveEnd` frame with an identical stack. Fixed by mirroring
  `live` into a plain ref and calling `onMoveEnd` as an ordinary statement
  inside `onPointerUp` instead of from within any state updater — confirmed
  fixed: one Undo click now reverts the whole move, and the stray "Cannot
  update a component while rendering" console error the double-invoke had
  also been causing stopped appearing on fresh drags too (same root cause,
  two symptoms).
- Verified live on a real imported freeform slide ("Workplace Aspirations",
  28 elements): dragging past the threshold moves the element and previews
  live; releasing commits once; a plain click with no movement still opens
  the image's adjust overlay (zoom handles + slider appeared) or focuses a
  text box for editing, unaffected by the new wrapper. `tsc --noEmit` clean
  throughout.
- **Keyboard shortcuts.** Consolidated the growing pile of one-off key
  checks in [edit/page.tsx](src/app/p/[id]/edit/page.tsx) into one handler
  and rounded out the set: Delete/Backspace now also removes the *single*
  current slide when nothing's multi-selected (previously only wired for
  2+ selected); Ctrl/Cmd+D duplicates (the selection if 2+, else the current
  slide); Ctrl/Cmd+A selects every slide (new `selectAllSlides` action);
  Arrow Up/Down steps to the previous/next slide. All of it — including
  Ctrl+Z/Y and Escape from earlier this session — shares one "not while
  editing text" guard computed once per keypress instead of the
  copy-pasted per-shortcut version each earlier addition carried. Tooltips
  on the rail's duplicate/delete/clear buttons and a new hint in the
  editor's footer bar surface the shortcuts, since the whole point of a
  shortcut is someone eventually discovering it exists.
- Verified live: Ctrl+D duplicated the current slide; Ctrl+A selected all
  and the toolbar showed the right count; Escape cleared it; Arrow Up
  moved to the previous slide, and the *same* Arrow Down was confirmed
  correctly suppressed while a title field had focus (no navigation, field
  keeps the keystroke); Delete with nothing multi-selected removed just the
  current slide. `tsc --noEmit` clean, no new console errors.
- **Alignment guides / snapping**, for freeform elements' drag-to-move from
  earlier today. Scoped to drag-time snapping only (matching the literal
  "alignment guides/snapping" ask) — no persistent element-selection system,
  see below for why. New `snapAxis()` helper in
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx): checks a dragged
  element's left/center/right (and top/center/bottom) against every
  candidate on that axis — the slide's own edges/center plus every *other*
  element's edges/center — and snaps to whichever is closest, within a 6px
  threshold (pixel-based via the container's real size, so the snap
  distance feels the same regardless of slide/element size, not a fixed
  fraction). `FreeformElementWrapper` calls it inside the existing
  `onPointerMove`, reports the active guide line(s) up to `FreeformSlide`
  via a new `onGuideChange` prop (shared across every wrapper, since only
  one drags at a time), which renders them as thin overlay lines spanning
  the slide — a guide has to span the whole slide, not just the dragged
  element's own box, which is why it's drawn at the parent level rather
  than per-wrapper.
- **Found and fixed a second real bug in the freeform drag machinery**,
  worse than the StrictMode double-commit from earlier today: reporting the
  live guide line on every `pointermove` (`onGuideChange` → the parent's
  `setGuides`) triggers a re-render of `FreeformSlide`, which hands every
  wrapper a **new** `onMoveEnd` closure (`onMoveEnd={(pos) => setElement(...)}`
  is defined inline, fresh every render). Since `onPointerUp`'s own
  `useCallback` had `onMoveEnd` in its dependency array, that made
  `onPointerUp`'s *identity* change mid-drag too — and the cleanup
  `useEffect` right below it, which depends on `[onPointerMove, onPointerUp]`,
  fires its cleanup (`removeEventListener` for both) the instant it sees
  that changed identity. Net effect: the window-level pointermove/pointerup
  listeners were being torn down *during* the drag, before the real
  pointerup ever arrived — silently. The drag stopped committing anything
  further and the guide line could never clear, with no error anywhere to
  point at, because by the time you released the mouse there was, quite
  literally, nothing listening anymore. Fixed the same way `elRef`/
  `siblingsRef` already handle their own per-render-fresh values: mirrored
  `onMoveEnd` into a ref (`onMoveEndRef`) and dropped it from `onPointerUp`'s
  dependency array entirely, so `onPointerUp`'s identity — and therefore the
  listener registration — now survives any number of mid-drag re-renders,
  not just zero of them.
- **This one was hard to isolate because of a second, unrelated problem
  that looked identical from the outside**: debugging this in the browser
  pane, dispatched test events sometimes silently landed on the wrong tab
  because several tool calls omitted an explicit `tabId` and fell back to
  "whichever tab is currently fronted" — which had quietly drifted away
  from the tab actually under test (to a leftover PDF tab from earlier in
  the session) at some point in a long multi-tab session. That produced the
  *exact same symptom* (dispatched pointer events appearing to do nothing)
  for a completely different, mundane reason, and cost real time to rule
  out before the real bug above was even visible. **Lesson for next time**:
  once a session has more than one open tab, pass `tabId` explicitly on
  every single browser-tool call, including `find`/`computer`, not just the
  `javascript_tool`/`read_console_messages` ones — don't rely on "the
  fronted tab" once there's more than one tab in play, and if a dispatched
  test event seems to do nothing, verify which tab it actually reached
  before suspecting the application code.
- Verified live (in a fresh tab, tabId explicit throughout, after the fix):
  three consecutive `pointermove` dispatches during one drag all correctly
  updated the live position (proving multiple mid-drag re-renders no longer
  break anything); the guide line correctly disappeared after release
  (previously stuck); the final position matched the last live value
  exactly; one Undo click reverted the *entire* multi-move drag back to
  its exact starting position. `tsc --noEmit` clean, no new console errors
  beyond the pre-existing migration 400s.

**Left off / next up:**
- Rest of Phase G, in the planned order: editor-canvas zoom/pan next, then
  comments/annotations last.
- No persistent "selected element" concept exists for freeform elements —
  today's snapping only runs *during* an active drag (which already tracks
  everything it needs locally). A real selection system (click to select,
  stays selected, Escape/click-elsewhere to deselect) is still worth
  building for its own sake — it's the prerequisite for element-level
  keyboard nudge (flagged as skipped in the keyboard-shortcuts entry above)
  and would also open the door to on-canvas multi-select. Whoever picks
  that up should know the drag machinery already has the right shape for
  it (`elRef`/`siblingsRef`/ref-mirroring pattern) — it's a reasonably
  contained addition on top of what's here now, not a rewrite.
- Copy/paste (Ctrl+C/V) was considered and deliberately left out — Ctrl+D
  already covers "make a copy in place," and real copy/paste (especially
  cross-project) needs a clipboard representation that's a bigger, separate
  feature, not a rounding-out of this one.
- Element-level nudge (arrow keys moving a *selected freeform element*, as
  opposed to changing which slide is current) was also left out here —
  it needs an actual "selected element" concept that doesn't exist yet
  (today's freeform drag has no persistent selection, just an active drag),
  and alignment/snapping will need that same concept, so it makes more
  sense to add it once, there, rather than twice.
- Freeform element **resize** and **z-order** are not built — today's step
  was deliberately scoped to just repositioning (matching the literal
  "drag-to-reorder" ask), since resize needs its own handle UI and z-order
  needs a decision on how to expose "bring forward/send back" — worth
  picking up if freeform slides turn out to need either.
- On-canvas multi-select (selecting several *elements* within one slide, as
  opposed to several slides in the rail) is still not built — see the
  2026-09-21 multi-select entry above for why it was scoped to the rail
  only; now that freeform elements are independently draggable, it might be
  worth reconsidering.
- **Worth remembering for anyone touching `EditableText` next**: its
  `onBlur` is *always* attached regardless of `editable`, and always calls
  `onChange` regardless of whether the text actually changed. That's fine on
  its own, but any new feature that treats a `commitProject`/`updateField`
  call as meaningful (undo history, "unsaved changes" flags, analytics,
  etc.) needs to either guard on the caller side (as `updateField` now does)
  or expect no-op calls to show up.
- Nothing from today is committed yet — still stacked on top of the
  already-uncommitted Space Detail / Music+KeyPlan / Seating Table work from
  2026-09-18. Strongly consider committing before this grows further.

---

## 2026-09-18 (cont'd)

**Done:**
- **Background music + key plan for a linked view's stage** — modeled on the
  sidvin reference deck's own render/gallery viewer (looping ambient track
  with a mute toggle, plus a floating "you are here" key-plan crop with an
  expand toggle). Added `LinkedView.musicUrl` and `LinkedView.keyPlanImage`
  ([slide.ts](src/types/slide.ts) — the latter reuses a newly-extracted
  `KeyPlanImage` shared type, since a hotspot's own `keyPlanImage` was
  already the identical shape). Works on any view kind, per the user's ask
  to have it on both Render and Axo — not hard-restricted to just those two,
  same reasoning as `zoomPanEnabled` already being generic across kinds.
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx): a real `<audio
  loop>` element mounts only while its view is active, fades in on arrival
  (handles the autoplay-blocked case with a "Tap for sound" fallback button
  rather than silently doing nothing), and unmounts (stops) on leaving —
  confirmed live that switching from Render to Walkthrough actually removes
  the audio element rather than leaving it playing underneath. The key-plan
  card defaults visible, click-to-expand, a small ✕ to hide it, and always
  resets to its default (visible, collapsed) on every view switch — matches
  the reference's own "fresh render, fresh key plan" behavior. Both fields
  are edited via a new row of paste-URL inputs above the stage (editable
  mode only), next to the existing stage-switcher row.
- **Found and fixed a real, previously-latent bug** while verifying this:
  the same one documented in yesterday's Space Detail entry (Escape/arrow
  keys firing both an in-slide overlay's own handler AND Presenter's
  page-level one) — turned out to still need watching for any *new*
  window-level key listener added from here on. No new instance this time
  (the music/key-plan controls are plain buttons, no new keydown
  listeners), but worth remembering as a standing rule for this codebase:
  any future `window.addEventListener('keydown', ...)` inside a
  Presenter-mode-visible component must use the capture-phase +
  `stopImmediatePropagation()` pattern from `Lightbox.tsx`/
  `SpaceDetailOverlay.tsx`, not a plain bubble listener, or it'll double-fire
  against Presenter's own Escape/arrow handling.
- Verified live on the real "Ecom Express — Workplace Design Presentation"
  project: set a test tone + the layout image as a stand-in key plan on the
  Render view, confirmed in Presenter mode that the audio element mounts,
  plays (volume fading in), the mute toggle actually flips `audio.muted`,
  the key-plan expand toggle actually resizes the card, and switching to
  the Walkthrough tab tears the audio element down. Cleaned up the
  placeholder test values from the real project afterward — this was
  verification, not real content, and the user will want to set their own
  actual music/key-plan assets. `tsc --noEmit` clean throughout; console
  showed only the pre-existing migration-column 400s and unrelated dev-HMR
  websocket noise.
- **Watch out for** (same class of issue as the seating-table one flagged
  yesterday): while setting these fields via this session's browser
  automation, a view-tab click twice landed on the *wrong* `LinkedView`
  (the rail thumbnail's own tab-switch button instead of the main canvas's,
  or vice versa) before the value got set — caught immediately both times
  by re-checking the persisted data, and re-done correctly. Not an app bug;
  a reminder for any future direct-DOM-scripted verification in this repo
  to always re-verify which `LinkedView` an edit actually landed on before
  trusting a screenshot alone, since multiple identically-labeled tab
  buttons exist in the DOM at once (rail preview + main canvas).

**Left off / next up:**
- No real background-music or key-plan assets have been set on any real
  project yet — today's work only proved the mechanism works, using a
  synthesized test tone and the layout image as a stand-in key plan (both
  removed afterward). Whoever adds real content should just paste the
  actual URLs into the new fields.
- Still blocked on the user for the rest of this round's asks from
  yesterday (typology list, OB/SKV profile decks, audience-option
  confirmation) — unchanged, see yesterday's entry.
- Nothing from today is committed yet.

---

## 2026-09-18

**Context:** the meeting from the last few entries went well. Follow-up ask:
tighten existing features and add what came up in the meeting. First item
tackled — a "space detail" overlay: click a space on a plan, see the concept/
render/walkthrough/BOQ/occupancy that justified it, surfaced on top of the
plan instead of navigating away (the pitch's own logic: by the time you've
walked from concept slides to the layout, the client remembers there *was*
a concept, not which one — a click brings the exact idea back mid-conversation).
Three more asks (typology-driven template population, brand→company-profile
auto-population, audience-based defaults) and a real-login share-permissions
phase are scoped but blocked/parked — see Left off below.

**Done:**
- **New `SpaceDetailOverlay`** ([SpaceDetailOverlay.tsx](src/components/SpaceDetailOverlay.tsx)):
  a card that surfaces on top of the plan on hotspot click, showing only
  whichever sections have content — Concept (a short standalone summary
  card, written for this popup, not a live preview of the actual concept
  slide — deliberately, per this round's scope decision), Renders (reuses
  the hotspot's existing `gallery`, no duplicate field — clicking a
  thumbnail opens the existing `Lightbox` on top), Walkthrough (a new
  per-hotspot video URL, distinct from a view's own shared walkthrough
  tab), Occupancy (reuses a linked Seating Capacity row via its
  `hotspotIds` — no duplicate number to keep in sync), and BOQ (placeholder
  note only; the real editable line-item table is intentionally parked for
  a later phase, per this round's scope decision). New `ViewHotspot.spaceDetail`
  + `SpaceConceptSummary`/`SpaceBoq`/`SpaceDetail` types
  ([slide.ts](src/types/slide.ts)). `jumpTo()` in
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx) now checks for any
  space-detail content (or a linked seating row) before falling through to
  plain gallery/navigate, and the hotspot popup gained a collapsible "Space
  Detail" editing section.
- **Found and fixed a real, previously-latent bug** while verifying this in
  Presenter mode: pressing Escape to close the new overlay (or the
  pre-existing `Lightbox`) also exited Presenter mode entirely in the same
  keypress — both the overlay's own Escape handler and Presenter's
  page-level one listen on `window`, and neither stops the other. Same bug
  existed for `Lightbox`'s arrow-key image stepping vs. Presenter's own
  arrow-key slide navigation. Fixed both by moving to a capture-phase
  listener + `stopImmediatePropagation()` — the standard fix for "an
  in-page modal needs to swallow a key before a page-level handler also
  reacts to it."
- Verified live on the real "Ecom Express — Workplace Design Presentation"
  project (the one actually used in the meeting): seeded real `spaceDetail`
  content on the Conference Room hotspot directly via a Supabase REST PATCH
  (the browser-automation pane's own hotspot-drawing UI is still fiddly at
  this viewport — see repeated notes on this in earlier entries), confirmed
  in Presenter mode that only populated sections render, the walkthrough
  video plays, and Escape now correctly closes just the overlay. `tsc`
  clean, no new console errors (only the pre-existing migration-column 400
  and unrelated HMR-websocket noise).
- **Along the way, corrected a self-inflicted data problem, not an app
  bug**: an early verification script piped JSON through `python -c`'s
  default stdout encoding on Windows (not UTF-8), mangling em-dashes
  in hotspot labels when it wrote back to Supabase. Re-fetched, repaired
  every mangled sequence, and rewrote using explicit UTF-8 throughout —
  confirmed clean afterward. Not an editor bug; a lesson for any future
  direct-REST verification script in this repo: always force UTF-8 on both
  ends, don't rely on `python -c ... > file`'s default encoding on Windows.

**Left off / next up:**
- **Noticed, not fixed**: the real Ecom Express project's Seating Capacity
  table currently has one row's `hotspotIds` accidentally including *two*
  hotspots (an old orphaned one plus the real Conference Room one), so that
  row's occupancy is what surfaces on the Conference Room's space-detail
  overlay instead of the correct row — a leftover mis-click from live
  editing during the actual meeting, not a code bug (confirmed by reading
  the raw persisted data). Worth a quick manual fix in the Seating Capacity
  table next time this project's open: unlink the stray hotspot from that
  row. Also that table's zone/row names have reverted to "New zone"/"New
  area" again at least once during real use — same contentEditable+blur
  batching hazard documented in the "occupancy chart" rebuild entry above;
  worth being deliberate about pausing between edits when scripting this
  table, and probably worth hardening the component itself at some point
  (debounce or a functional-update form for `setZones` so rapid edits can't
  silently overwrite each other) rather than continuing to work around it
  by hand each time.
- **Blocked on the user for the rest of this round's asks**:
  1. Typology-driven template population — needs the exact typology list
     and which concept-library pillars/slides belong to each.
  2. Brand (OB/SKV/Both) → auto-populated company-profile slides — needs
     the real source deck(s) for each brand's profile (same pattern as the
     Ecom Express PPTX import earlier).
  3. Audience (Leadership vs. Client, defaulting which slides show) — a
     two-option proposal is on the table, not yet confirmed as final.
  4. Editor add/remove-slides tightening — mostly exists already
     (`+ Add slide`, delete, skip); the actual ask is exposing the same
     typology/brand template picker inside the editor too, not just at
     creation — blocked on #1/#2 same as they are.
- **Real Google-account login + viewer/editor sharing** is confirmed
  explicitly parked for a later phase by the user, not forgotten — see the
  detailed architecture write-up already given in this session (Supabase
  Auth + Google OAuth provider, `owner_id`/`project_collaborators` schema,
  real RLS policies replacing the current fully-open one, a login page, a
  Share dialog). Today's DB access is still completely open — anyone with
  the project id can read/write it via the public anon key — worth keeping
  in mind before treating any project in this database as actually private
  in the meantime.
- Nothing from today is committed yet.

---

## 2026-09-17 (cont'd 8)

**Context:** asked to "work on the occupancy chart"; after clarifying scope
(add features: Excel import was reported broken, plus a bar→hotspot reverse
jump), investigating the Excel-import report led to re-reading the design
reference this whole linked-views feature was generalized from
(`D:\Claude\sidvin-design-deck\index4.html`) — its own "occupancy" concept
turned out to be a completely different shape than what got built: not a
bar chart on a separate slide with click-jump, but an Area/Required/Achieved
table embedded *beside the plan itself*, grouped by zone, two-way
hover-linked to the plan's hotspots (`renderSeatingTable()`/`hotspotsByRoom`
in the reference). Confirmed with the user to rebuild against that reference
rather than patch the old design.

**Done — investigation first:**
- The reported-broken Excel import turned out to work correctly — root
  cause was a real UX bug, not silent failure: when the deck had any
  `linked-views` slides, import didn't touch the chart at all until you
  *also* picked a linked slide or clicked "Skip linking" in a follow-up
  banner, so nothing visibly happened on upload alone. (This is now moot —
  see below — but worth recording that it wasn't the reported "does
  nothing" bug once actually traced through `runImport`.)

**Done — the rebuild (supersedes the whole occupancy-chart design from the
2026-09-17 Part C entry above, both the original bars and this session's own
Excel-import-order fix + reverse-jump additions on top of it):**
- **Removed entirely**: the `'occupancy-chart'` `SlideLayout`,
  `OccupancyChart.tsx`, `OccupancyZone`, `ViewHotspot.targetZoneId`,
  `SlideFields.occupancyZones/occupancyUnit/linkedViewSlideId`, the
  editorStore's `focusZoneId`/`focusHotspotId` transient state and
  `addOccupancyZone`/`removeOccupancyZone`/`importOccupancyData` actions, and
  the hotspot popup's "Highlight: Zone" picker.
- **Added**: `SeatingRow`/`SeatingZone` types and `LinkedView.seatingTitle`/
  `seatingZones` ([slide.ts](src/types/slide.ts)) — a row is
  `{ label, required?, achieved, note?, kind?: 'row'|'group'|'sub',
  hotspotIds?: string[] }`, so a row can link to zero, one, or several
  hotspots on the *same* view (matching the reference's own "Total
  Workstations" group row plus two sub-rows all pointing at one "workhall"
  hotspot, and inert rows like "Waiting Lounge" with no plan link at all).
  New [SeatingTable.tsx](src/components/SeatingTable.tsx) renders this beside
  the plan (replacing `HotspotSidePanel` only when a view actually has
  `seatingZones`, or for a brand-new view in edit mode — the plain simple
  side list still works untouched for decks that only use `listEntry`):
  zone-grouped Area/Required/Achieved rows, group/sub visual treatment,
  two-way hover (`hoveredHotspotId` in from the plan, `onHoverHotspots` out
  to it — generalized to a list since one row can map to several hotspot
  ids, unlike the single-id simple side list), a contextual note area shown
  only while the relevant row/hotspot is hovered, and full editing UI (+
  Zone/+ Row, inline label/required/achieved editing, a kind selector, and
  per-row hotspot-link toggle chips).
- **New Excel import** ([importExcel.ts](src/lib/importExcel.ts)):
  `parseSeatingWorkbook` header-detects Zone/Area/Required/Achieved columns
  (falls back to column order), and `SeatingTable`'s own import button
  upserts rows into `seatingZones` grouped by zone, auto-linking to a
  same-view hotspot by case-insensitive label match — same matching
  philosophy as the old `importOccupancyData`, just producing the new shape
  and needing no second "which slide" step since everything is already on
  one view.
- Verified live on "Linking Test": added a zone + two rows via the editor UI
  end-to-end (contentEditable zone/row labels, required/achieved inputs all
  persist correctly to the store, confirmed via React fiber inspection since
  the browser-automation pane's canvas is very small at this viewport).
  `tsc --noEmit` clean, no new console errors, and confirmed the app doesn't
  crash on a slide whose persisted `layout` is still the now-removed
  `"occupancy-chart"` string (falls back to the generic kicker/title
  render branch rather than erroring).

**Left off / next up:**
- **Not independently re-verified live**: the two-way hover between a
  SeatingTable row and an actual hotspot on the plan. Repeated attempts to
  draw a fresh test hotspot via this session's browser automation (both
  real mouse drag and synthetic PointerEvents) didn't complete the
  rectangle-tool's drag-to-popup flow in this pane — looked like an
  automation/viewport-scale friction, not an app bug (a real mouse drag did
  visibly grow the selection box each time). The hover code itself is a
  direct generalization of the already-shipped, already-verified simple
  `HotspotSidePanel` hover (same `hoveredHotspotId` plumbing, just widened to
  a list), so it's believed correct by construction — but worth an actual
  click-a-row/hover-a-hotspot check next session, ideally from a real
  browser rather than this automation path.
- The old "Linking Test" occupancy-chart slide (with the Reception/Workhall/
  Conference Room data from earlier testing) was deleted since its layout no
  longer exists — that data is gone, not migrated. No real project data used
  the old feature (it only ever existed in this session's scratch project),
  so nothing to migrate in practice.
- Nothing from this rebuild is committed yet.

---

## 2026-09-17 (cont'd 7)

**Done:**
- **Added a Google-Slides-style per-slide Background feature**: a new
  "Background" section in the Properties panel
  ([PropertiesPanel.tsx](src/components/PropertiesPanel.tsx)) lets you set a
  flat color and/or a full-bleed image behind the current slide, with an
  "Image darken" slider (0–80%) for text legibility over busy photos, and a
  "Reset" to go back to the style's own default. New `Slide.background`
  (`SlideBackground` — [slide.ts](src/types/slide.ts)) and
  `setSlideBackground`/`resetSlideBackground` store actions
  ([editorStore.ts](src/lib/editorStore.ts)). `SlideRenderer.tsx`'s shared
  root wrapper (every layout renders through it) paints the custom
  color/image behind everything when set, replacing rather than layering
  under the style's usual white/dark-veil look. Text color is not
  auto-adjusted for contrast — same as Google Slides, the panel's own
  helper text calls this out. Verified live: color and image both apply
  and persist, darken slider dims the image, Reset clears correctly, `tsc`
  clean, no new console errors.
- **Reworked Presenter mode's bottom nav bar**
  ([present/page.tsx](src/app/p/[id]/present/page.tsx)) with 4 requested
  additions: a thumbnail preview (a real scaled-down `SlideRenderer`, not a
  static image) on hovering a nav dot; a thin progress-fill bar under the
  step counter; dots grouped by section (split at each section-starter
  slide, with a subtle divider between groups); and a kbd-styled keyboard
  legend ("← → navigate · Esc exit") replacing the old plain-text hint pill.
  Verified live on "Linking Test": added a Section Starter slide to confirm
  grouping actually splits the dots (single group before, two groups with a
  divider after — confirmed via the DOM, not just visually), hovered a dot
  and confirmed the live thumbnail preview renders that slide's real content
  (a freeform slide's photos/text, not a placeholder), confirmed the
  progress bar's width tracks the current slide. `tsc` clean, no new
  console errors. Cleaned up the test Section Starter slide afterward.

**Left off / next up:**
- Nothing outstanding on either feature. Neither is committed yet.
- Reminder from earlier this session, still true: the "Linking Test"
  project has accumulated scratch clutter (old flat-image vs. freeform
  duplicate slides, a few stray test edits) worth tidying before actually
  presenting live.

---

## 2026-09-17 (cont'd 6)

**Context:** user corrected the "as is" concept-library slides twice more —
first wanting them editable, then rejecting the whole-slide-as-one-image
approach outright ("No not as a whole , image by image, text, line ,shape"):
each photo/text/shape from the original PPTX needed to be its own
independently editable object, positioned pixel-accurately.

**Done:**
- **Built genuine per-element reconstruction of all 3 E-Com Express slides**
  ("Workplace Aspirations", "Brand Landscape", "Design Cues"), replacing the
  flat full-bleed image versions:
  - Extracted real shape geometry/text/images from the source `.pptx` via
    `python-pptx`, recursing into `GROUP` shapes (a first pass without this
    silently dropped every icon/label nested in a group). One-off generator
    kept for reproducibility: [scripts/gen_ecom_elements.py](scripts/gen_ecom_elements.py)
    reads `public/concept-library/ecom-express/elements/extracted.json` and
    writes [src/lib/ecomExpressSlides.generated.ts](src/lib/ecomExpressSlides.generated.ts)
    (do not hand-edit the generated file).
  - New `SlideLayout: 'freeform'` + `FreeformElement` union (image/text/shape,
    normalized 0–1 x/y/w/h, multi-run rich text) — [slide.ts](src/types/slide.ts).
  - New `FreeformSlide`/`FreeformTextBox` renderers in
    [SlideRenderer.tsx](src/components/SlideRenderer.tsx). Text is
    `contentEditable`, showing full rich multi-run formatting until an actual
    edit collapses it to one run (pragmatic tradeoff, not a full rich-text
    editor). Images reuse `MediaBox` (replace/adjust already works, proven
    elsewhere in the app).
  - `conceptSlide()` ([conceptSlides.ts](src/lib/conceptSlides.ts)) now
    branches on `concept.elements` before `imageUrl`, producing a `'freeform'`
    slide with fresh per-insertion element ids.
- **Found and fixed two real, previously-latent bugs**, both only exposed
  because this is the first feature needing true fixed-canvas absolute
  positioning:
  - **Presenter mode had no `ScaledStage`** ([present/page.tsx](src/app/p/[id]/present/page.tsx))
    — unlike the editor, it rendered `SlideRenderer` in an unconstrained
    `h-screen w-screen` box, so anything positioned by exact percentage
    distorted to the window's actual aspect ratio. Fixed by wrapping in the
    same `ScaledStage` the editor already uses.
  - **`MediaBox`'s `className="absolute"` lost a Tailwind specificity tie**
    against its own hardcoded `relative` class (equal-specificity utilities
    don't resolve by source order) — images rendered in normal document flow
    and stacked vertically instead of at their intended x/y%. Fixed by adding
    a `style` prop to `MediaBox` and passing `position: 'absolute'` there
    instead of via `className` (inline style always wins).
- **Verified live in Presenter mode**, all 3 slides: images correctly
  positioned per their original PPTX layout (icon rows, image grids), text
  correctly sized/colored/positioned (including a pink word-highlight inside
  an otherwise-black headline), footer/logo chrome correct — closely matching
  the original PowerPoint renders. Also verified end-to-end: a text element's
  edit-and-blur correctly collapses and persists; an image element's DOM
  structure confirms it's wired through the same `MediaBox` replace/adjust
  path already proven elsewhere. Console shows only the pre-existing
  migration-column 400s.

**Left off / next up:**
- The "Linking Test" scratch project now has several leftover duplicate
  copies of these slides from repeated testing (both old flat-image and new
  freeform versions) — clean up before presenting live, not before.
- The now-superseded flat-image assets
  (`public/concept-library/ecom-express/slide-{1,2,3}.png`) are no longer
  referenced by the pillar's concepts (which use `elements` now) — likely
  safe to delete, not yet done.
- Editability was verified structurally + via a scripted DOM edit, not by a
  real click-and-type in this session (the browser-automation pane's canvas
  rendered too small at this viewport to reliably click precise element
  positions) — worth one real manual click-to-edit check before presenting.
- Nothing from this batch is committed yet.

---

## 2026-09-17 (cont'd 5)

**Done:**
- **Added "as is" image slides to the concept library**, per the user's
  request ahead of tomorrow's meeting: 3 slides from a real client deck
  (`Copy of Copy of 19.02.25 _ E-COM EXPRESS_Design Deck_Officebanao.pptx`)
  now show up as a new pillar ("13 · E-Com Express — Reference Deck") in the
  existing Concept Library gallery (`+ Add slide` → `Concept library…`),
  exactly like every other pillar — pick it, click a thumbnail, it's added.
  - Rendered each PPTX slide to a PNG via PowerPoint COM automation
    (`Presentation.Open` + `Slide.Export(..., 'PNG', 1920, 1080)` — no
    existing PPTX-rendering library in this codebase or its dependencies;
    `pptxgenjs` is export-only). Saved as static assets under
    `public/concept-library/ecom-express/slide-{1,2,3}.png`.
  - Extended `DesignConcept` ([conceptLibrary.ts](src/lib/conceptLibrary.ts))
    with an optional `imageUrl` — when set, `conceptSlide()`
    ([conceptSlides.ts](src/lib/conceptSlides.ts)) returns a plain `'blank'`-
    layout slide with just that image, instead of the usual lead/points
    composition. No changes needed to `ConceptLibraryDropdown.tsx` at all —
    the existing gallery UI, thumbnails, and "already in deck" tracking all
    just work, since they're driven generically by whatever `conceptSlide()`
    returns.
  - Added full-bleed image rendering to the `'blank'` layout branch in
    [SlideRenderer.tsx](src/components/SlideRenderer.tsx): an `<img>` with
    `className="absolute inset-0 h-full w-full object-cover"` — deliberately
    escapes the slide wrapper's own padding (an absolutely positioned
    element's containing block is the relative ancestor's *padding* edge,
    not inside it), so the imported slide shows edge-to-edge with zero added
    chrome, genuinely "as is."
  - Verified live: all 3 slides added from the library, render pixel-correct
    full-bleed (checked against the original PPTX renders), `tsc` clean, no
    new console errors (a batch of 404s were from before the images were
    actually in place — confirmed stale by checking fresh requests all
    return 200 after the fix).

**Left off / next up:**
- Nothing outstanding on this feature. If more "as is" reference decks are
  wanted later, the pattern is: render slides to images (PowerPoint COM if
  on a Windows box with Office installed — proved reliable here, no other
  PPTX-rendering tool was available), drop them under
  `public/concept-library/<name>/`, add one pillar entry with one
  `imageUrl`-bearing concept per slide.
- **Environment note for future sessions**: writes made via the Bash/Write
  tools were, at least twice this session, not immediately visible to
  PowerShell-invoked processes (a `.ps1` file wr itten via Bash/Write read as
  "does not exist" when PowerShell tried to run it; conversely, a PowerShell
  `Copy-Item` into `public/` wasn't visible to Bash/curl/the dev server
  until copied again via `cp` from Bash directly). Apparent eventual-
  consistency lag between whatever backs each tool, not a permissions
  issue. If a file written by one tool "doesn't exist" to another, don't
  assume something is wrong with the file — try writing/copying it again
  from the tool whose view actually matters for the next step.
- Nothing from this batch is committed yet.

---

## 2026-09-17 (cont'd 4)

**Context:** user has an internal stakeholder review tomorrow (2026-09-18) —
main USPs to demo: the linked-views hotspot system, the occupancy chart +
Excel linking, and overall visual polish. Did a cross-feature verification
pass rather than more new building, prioritizing "a few things work
flawlessly" per the user's own call.

**Done:**
- **Ran the cross-feature regression that was never done**: hover + gallery
  + stages + zoom/pan all enabled together on one linked-views slide in
  Presenter mode. Confirmed: two-way hover (verified via `fill-opacity`
  actually increasing on the hovered path), gallery/lightbox opens on click,
  wheel-zoom + drag-pan both work, all simultaneously, zero new console
  errors (only the pre-existing migration-column 400s).
- **Found and fixed a real, previously-unverified bug**: clicking a hotspot
  linked to an occupancy-chart zone did navigate correctly, but the
  "highlight this bar for a moment" effect **never actually appeared** — the
  transient `focusZoneId` was being cleared via `queueMicrotask` from inside
  the component's render body, and microtasks flush *before* the browser
  paints, so the highlighted frame was cleared before anyone could ever see
  it. This would have been a visibly broken moment in tomorrow's demo (click
  hotspot → nothing visibly happens on the chart). Fixed in
  [OccupancyChart.tsx](src/components/OccupancyChart.tsx): replaced the
  microtask clear with a real `useEffect` + `setTimeout(2200ms)`, so the
  highlight is now guaranteed to actually render before it clears. Also
  added a `ring-2` outline on the highlighted bar's track (previously the
  only highlight signal was a color change, which was invisible on an
  over-capacity bar since red already overrides the accent color) — now the
  ring shows regardless of the bar's color state.
  - Verified live: dispatched the click and checked the DOM ~100ms later —
    ring + "25 / 20 occupants" tooltip both present; re-checked ~2.5s later
    — cleared correctly. This is now safe to demo.
- Re-verified end-to-end with a hotspot that has **only** a zone link (no
  gallery) — the earlier session's test was inconclusive because the one
  hotspot available had both a gallery and a zone link, and gallery
  correctly takes click priority, masking whether the zone-jump path worked
  at all. Confirmed it independently this time.

**Left off / next up:**
- Did not get to a fresh visual A/B look at the `section-starter`/`design`
  dark-gradient polish in this pass (spot-checked only `standard`/`concept`
  slides) — worth one more look before the meeting if there's time, though
  it was already verified once when Part D was originally built.
- Consider giving the "Linking Test" project (or a copy of it) more
  presentable content/naming before the actual meeting — it currently has
  scratch-test artifacts (a "cdcd" hotspot, a few unlabeled ones, generic
  "Zone 1/2/3" placeholders in the occupancy chart) mixed in with the real
  demo-worthy content. Fine for verification, less fine to present live.
- Nothing from this pass is committed yet.

---

## 2026-09-17 (cont'd 3)

**Done:**
- **Closed out the "Unable to add image" report — confirmed not a code bug.**
  User re-tested and still saw "nothing happens" on a Linked Views empty
  image slot, even after the earlier `hidden`-attribute fix (commit
  `6b68c38`). Investigated further this round:
  - Widened `MediaBox`'s click target from just the small "Choose a file"
    button to the whole empty-state box, and added a dev diagnostic
    (`console.warn` if `fileRef.current` were null at click time) —
    [SlideRenderer.tsx](src/components/SlideRenderer.tsx), `MediaBox`'s new
    `openPicker()` helper. Verified live: the diagnostic never fired, proving
    the ref is valid and `.click()` is genuinely being called on the file
    input.
  - Ruled out an enterprise Chrome-profile policy (user was on a "Work"
    profile) by testing on a non-work profile too — same symptom.
  - Ruled out "dialog never opens at all" by having the user Alt+Tab after
    clicking — **the native file dialog was opening the whole time, just
    without stealing window focus**, so it looked like nothing happened.
  - Confirmed end-to-end: after Alt+Tab to the hidden dialog, picking a file
    and confirming, the image uploaded into the slide correctly.
  - **Conclusion: not a Presenta bug.** The upload feature works correctly;
    the OS/Chrome dialog simply doesn't come to the foreground on this
    machine, which is a browser/window-manager focus behavior no page's
    JavaScript can control (intentionally, for security — a page must not be
    able to hijack focus of a native OS dialog it triggers). Workaround:
    Alt+Tab (or check the taskbar) after clicking "Choose a file".
  - The widened-click-area change and the diagnostic warning are harmless,
    real UX/debuggability improvements and are being kept regardless.

**Left off / next up:**
- Nothing outstanding on this specific report. If it resurfaces, the
  `console.warn` diagnostic in `MediaBox.openPicker()` is still in place to
  quickly rule the ref/click-wiring theory in or out again.
- Still uncommitted along with the batch-export work from the same day —
  see the entry above for what's staged.

---

## 2026-09-17 (cont'd 2)

**Done:**
- **Root-caused and fixed the batch-export hang from the previous entry** —
  it was real, reproduced on the user's own machine too (not a sandbox
  artifact): a real Selenium-driven Chrome (headless *and* headed) crashes
  outright ("tab crashed") on this app's **dev-mode** (`next dev`/Turbopack)
  bundle — reproducibly, on every page including the plain home page — while
  the exact same pages load fine once served from a **production** build
  (`next build` + `next start`). [scripts/batch_export.py](scripts/batch_export.py)
  now always builds and runs a production server for the export automation
  instead of `next dev` (a few seconds' build cost, paid once per script
  run) — this class of instability is specific to the dev bundle's HMR
  client/eval-heavy module wrapping, not anything about the app's own code
  or data.
- **Fixed the real, unrelated, long-standing `pdfjs-dist` type error** (first
  noted several entries back) properly instead of working around it — it
  was simply never added to `package.json` despite being imported in
  [importDeck.ts](src/lib/importDeck.ts). Added it as a real dependency.
  `npx tsc --noEmit -p .` is now **fully clean, zero errors** for the first
  time this whole session — every prior entry's "2 pre-existing unrelated
  errors" caveat no longer applies. This was also required to make `next
  build` succeed at all (production builds run real type-checking; dev mode
  doesn't), which the batch-export fix above depends on.
- Fixed two more real bugs found while verifying the fix end-to-end:
  - A `UnicodeEncodeError` crashed the script mid-run on Windows consoles
    (default cp1252 encoding can't print ✓/✗/…/→) — fixed by reconfiguring
    stdout/stderr with `errors="replace"` at startup.
  - On Windows, `Popen.terminate()` on a `shell=True` `npm run start` only
    killed the outer `cmd.exe` wrapper, leaving the actual `next start`
    Node process orphaned and still holding the port — fixed with
    `taskkill /F /T` (kills the whole process tree) on Windows.
  - Two projects sharing a sanitized name (several are literally named
    "xx"/"zzz" in this dev database) would silently overwrite each other's
    exported file — output filenames now include a short suffix from the
    project id.
  - A stray non-PDF/PPTX file appearing in the download folder mid-poll
    (observed once, cause unconfirmed — possibly a Chrome/Windows artifact)
    could be mistaken for the real download — `wait_for_new_file` now only
    considers files with the expected extension.
- Added `--export-timeout` (default 300s) since large decks take a while to
  rasterize (this app renders each slide to a PNG before assembling the
  PDF/PPTX) — the 163-slide Qualcomm deck did **not** finish within 300s in
  testing; needs a considerably longer timeout raised via this flag (not
  yet confirmed how long it actually needs — the one attempt at 900s in this
  session didn't produce a log, likely lost when its background shell exited
  rather than a real second failure; worth a clean re-run next session).
- Verified end-to-end on real data: ran the full batch across all 20 real
  projects in this Supabase database — every distinctly-named small/medium
  project exported a real, valid PDF successfully (confirmed by file size
  and count); duplicate-named ones no longer overwrite each other (fixed
  above, not yet re-verified against the full 20 after the fix, only against
  a smaller manual test). `tsc` clean throughout.

**Left off / next up:**
- **The 163-slide Qualcomm deck's actual export time is still unknown** —
  confirm it with a clean, foreground (not backgrounded) run and
  `--export-timeout` set generously (e.g. 1200+), and note the real number
  here once known so the default can be sanity-checked against it.
- Should re-run the full 20-project batch once more after the duplicate-name
  and stray-file fixes to confirm nothing regressed — only spot-tested
  individual pieces after those fixes, not the full batch again.
- `.gitignore` now excludes `__pycache__/` (added alongside this work).

---

## 2026-09-17 (cont'd)

**Done:**
- Added a Python batch-export tool: [scripts/batch_export.py](scripts/batch_export.py) +
  [requirements-batch-export.txt](scripts/requirements-batch-export.txt).
  Presenta's own export ([exportDeck.ts](src/lib/exportDeck.ts)) is entirely
  client-side (rasterizes slides, assembles PDF/PPTX in-browser, triggers a
  download) — there's no server API for it — so this drives a real headless
  Chrome via Selenium: for each project, open its editor, click Export,
  wait for the file. Projects are listed via a direct Supabase REST call
  (reads `NEXT_PUBLIC_SUPABASE_URL`/`ANON_KEY` straight from `.env.local`)
  rather than scraping the home page — see "Watch out for" below for why.
  `pip install -r scripts/requirements-batch-export.txt`, then e.g.
  `python scripts/batch_export.py --port 3001 --out ./exports --format both`.
- Handled the "different port" request: this Next.js version (16, Turbopack)
  allows only **one** dev server per project directory regardless of port —
  starting a second copy on another port while one's already running on
  3000 fails outright ("Another next dev server is already running"). The
  script detects this and reuses whatever's already up (checks `--port`,
  then falls back to checking 3000) instead of trying to spawn a doomed
  second instance; it only starts its own server if truly nothing is
  running anywhere reachable, and only shuts down a server it started
  itself. Added a `dev-3001` entry to [launch.json](.claude/launch.json) for
  the Claude Browser preview tool's own use, for symmetry.
- Added a harmless `data-project-id`/`data-project-name` attribute to each
  project row on the home page ([page.tsx](src/app/page.tsx)) — not
  currently used by the script (see below) but a small, safe, generally
  useful hook for any future browser-automation over this page.

**Left off / next up:**
- **Not fully verified end-to-end in this session's sandbox.** Listing
  projects via the direct Supabase REST call works (confirmed — returned
  the real 20-project list correctly). But opening a project's *editor*
  page in the same headless Chrome instance got stuck indefinitely on
  "Loading…" — the editor's own client-side Supabase fetch (loading the
  slide data) never resolved or errored, so the Export button never
  appeared and the script timed out. This looks like an environment-specific
  quirk (see Watch out for) rather than a bug in the script's own logic —
  couldn't get further in the time available. **Next step: run the script
  from a plain terminal on your own machine (not through this session's
  automation) and see if it gets past that point** — if the editor loads
  fine there, the tool should just work; if it hangs there too, that's a
  real bug worth another look.
- Given the above, the actual PDF/PPTX file output has **not** been
  confirmed to work — only the "list projects" and "reuse existing dev
  server" pieces are verified.

**Watch out for:**
- A real headless Chrome (Selenium-driven) making the app's own
  `supabase-js` client-side fetch calls appears to hang indefinitely in
  this session's sandboxed environment, even though: (a) a plain `curl` to
  the same Supabase REST endpoint with the same key succeeds instantly, and
  (b) a raw `fetch()` executed inside that same headless page also
  completes normally (tested with a deliberately-unauthenticated request,
  got the expected 401 back fast). So it's specifically supabase-js's own
  call path that stalls here, not network reachability in general — worth
  investigating further if this repros outside this specific sandbox too,
  but not chased down further given the time this already took. This is
  exactly why project *listing* was moved off the client-side fetch (onto a
  direct REST call from Python) — but the editor page itself still depends
  on that same client-side fetch to load a project's slides, and that part
  couldn't be routed around the same way without duplicating a large chunk
  of the app's own data-loading logic.

---

## 2026-09-17

**Done:** (plan: Parts C & D of `C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`)
- **Part D (visual polish pass)**: added a shadow/radius token scale to
  [globals.css](src/app/globals.css) (`--radius-sm/md/lg`, `--shadow-sm/md/lg`,
  ink-tinted); added accent-derived `--accent-wash`/`--accent-line-strong`
  and dark-style `--dark-veil-1/2` gradient stops to
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx)'s existing per-slide
  style block. Dark slides (`section-starter`/`design`) now render a radial
  gradient tied to the deck's own accent instead of flat ink.
  `StatsRow`/company-style stat cells get the new shadow scale (+ accent-wash
  fill for `company`); the `design` style's hero `MediaBox` gets a new
  `elevated` prop (larger radius + real shadow) via a small, scoped addition
  rather than changing `MediaBox` globally.
- **Part C (occupancy chart + hotspot linking + Excel import)**, all steps:
  - Data model: `OccupancyZone`, `SlideFields.occupancyZones/occupancyUnit/
    linkedViewSlideId`, `ViewHotspot.targetZoneId`, new `'occupancy-chart'`
    `SlideLayout` — all in [slide.ts](src/types/slide.ts).
  - New [OccupancyChart.tsx](src/components/OccupancyChart.tsx): a bar-per-zone
    chart (plain divs, not SVG — no shared coordinate space needed), hover
    highlight + tooltip, inline label/value/capacity editing, add/remove zone.
    Bar rule: `value/capacity` when capacity is set (over-capacity turns the
    bar red), else scaled against the slide's own max value.
  - Cross-slide linking: the hotspot edit popup gains a zone-picker
    (`targetZoneId`) when its "Jump to" target is an occupancy-chart slide;
    clicking such a hotspot navigates *and* sets a new transient
    (never-persisted) `focusZoneId` in the store so the matching bar
    highlights for a moment on arrival. This is click-to-jump, not live
    two-way hover — confirmed as the right simplification since the editor
    only ever mounts one slide at a time.
  - Excel import: added `xlsx` (SheetJS) as a dependency; new
    [importExcel.ts](src/lib/importExcel.ts) parses a workbook fully
    client-side (header-detects Zone/Capacity/Occupied columns, falls back to
    column order). New store action `importOccupancyData` (in
    [editorStore.ts](src/lib/editorStore.ts)) upserts the chart's zones by
    label match and patches every same-labeled hotspot on a paired
    `linked-views` slide (`linkedViewSlideId`, set once and reused) — one
    upload updates both. Reports back `{added, updated, hotspotsUpdated,
    unmatched}`, shown as a summary banner.
- **Verified in-browser** on "Linking Test": created an occupancy-chart slide,
  confirmed bar height math (value/capacity, over-capacity → red, no-capacity
  → scaled-to-max) via direct DOM inspection of computed styles; confirmed
  the Excel-import picker/summary UI end-to-end using a hand-built CSV
  through the same file input (real `.xlsx` byte transfer into the browser
  tool proved unreliable for a file this size — see Watch out for below —
  but the parser's core `XLSX.read`/`sheet_to_json` logic was independently
  verified correct via a Node script using the real `xlsx` package against a
  generated `.xlsx` file with the exact expected header/column shape).
  Confirmed the import summary correctly reported "3 zones added, 1 hotspot
  updated, 2 unmatched" and that the matched hotspot's side-list value
  updated to "7 / 10". **Not directly verified**: the click-to-jump +
  highlight behavior itself, because the one hotspot available to test with
  already had a gallery attached from earlier testing, and `jumpTo` correctly
  prioritizes gallery over zone-jump (pre-existing, intentional precedence,
  not something introduced here) — the wiring was reviewed instead of
  visually confirmed. `npx tsc --noEmit -p .` clean throughout (same 2
  pre-existing unrelated `pdfjs-dist` errors, nothing new).

**Left off / next up:**
- The click-to-jump-and-highlight path (a hotspot with *only* a zone link, no
  gallery) should get a real visual check next session — draw a fresh
  hotspot with no gallery, link it to a zone, confirm the bar highlights on
  arrival in Presenter mode.
- **Security note on the `xlsx` dependency**: `npm audit` flags the npm
  registry's `xlsx@0.18.5` with two known high-severity issues (prototype
  pollution, ReDoS) with "no fix available" via npm — SheetJS stopped
  publishing patched releases to the npm registry and now only distributes
  fixed builds via their own CDN (`cdn.sheetjs.com`). Installing directly
  from that CDN was blocked by this session's sandbox (untrusted-code-source
  restriction on non-registry package installs). Currently running the
  known-vulnerable npm build. Since parsing is fully client-side and only
  ever processes a file the deck's own author chooses to upload, the
  practical risk is low, but worth a deliberate call: either accept it, or
  have someone install the patched CDN build by hand
  (`npm install https://cdn.sheetjs.com/xlsx-<version>/xlsx-<version>.tgz`,
  version per sheetjs.com's own downloads page).
- Nothing from today is committed yet.

**Watch out for:**
- Transferring a real binary `.xlsx` file into the browser-automation tool by
  hand-copying its base64 encoding is unreliable at this size (~16KB) — a
  transcription/truncation error produced a corrupted ZIP the app correctly
  rejected with "Could not read that spreadsheet" (which did at least prove
  the error-handling path works). A plain-text CSV through the same input
  worked fine and is what actually exercised the success path end-to-end.
  For a future full `.xlsx` upload test, look for a more reliable transfer
  path than manual base64 copy-paste (a local static file server the browser
  tool can actually reach turned out to be blocked here too — investigate
  why before assuming it'll work next time).

---

## 2026-09-16 (cont'd 4)

**Done:**
- Built Part A step 5 — the last piece of the linked-views hotspot upgrade,
  per the plan: transient viewer zoom/pan. New per-view "Zoom/pan" checkbox
  (editable mode, next to the drawing tools) turns on `LinkedView.zoomPanEnabled`;
  when on and in view/Presenter mode (never in the editor, where dragging the
  image already means "adjust the authored crop"), the viewer can wheel-zoom
  and drag-pan the image — a "Reset zoom" pill appears once zoomed. This is
  genuinely transient (`viewportZoom`/`viewportPanX/Y` component state, never
  written to `ImageTransform` or the project) and resets whenever the active
  view/stage changes. The image and its hotspot SVG overlay are wrapped
  together in one scaled/translated container so hotspots stay registered to
  the image at any zoom level. A drag that actually moved (a small threshold,
  tracked via `panRef`/`justPannedRef`) suppresses the hotspot's own click for
  that one gesture, so panning never accidentally triggers a navigate/lightbox
  — a plain (near-stationary) click still does.
  - One real bug caught and fixed during verification, not stale-console
    noise this time: the wheel handler originally used React's own `onWheel`
    prop and called `e.preventDefault()` inside it — React attaches wheel
    listeners passively by default, so this actually failed with "Unable to
    preventDefault inside passive event listener invocation." console errors
    every scroll (would have let the underlying page scroll during a zoom
    gesture). Fixed by attaching a real native `wheel` listener via a ref +
    `useEffect` with `{ passive: false }` instead of the JSX prop.
- Verified in-browser on "Linking Test": enabled zoom/pan on the Layout view,
  confirmed wheel-scroll zooms in/out and drag pans (hotspots visibly stay
  registered to the image), confirmed a plain click on a hotspot still opens
  its gallery/lightbox correctly while zoomed in, confirmed (by diffing the
  console's `preventDefault` error count before/after a fresh scroll on a
  hard-reloaded page — it stayed at its old count, meaning no *new* one fired)
  that the passive-listener fix actually holds. `tsc --noEmit` clean (only
  the pre-existing unrelated `pdfjs-dist` errors in `importDeck.ts`).
  - **Correction to something claimed "confirmed stale" in earlier entries
    today**: this session's browser tool does **not** clear its console
    buffer on `navigate` — it just keeps accumulating for the tab's whole
    lifetime, growing past 260+ entries by the end of this session. So
    "the same error text is still there after a reload" was never actually
    proof of staleness by itself; what does prove it is what I used this
    time — checking whether the *count* of a specific error grows after
    triggering the action again. The earlier `SlideRenderer.tsx:1203`/`1440`
    parse-error read is still believed stale (`tsc` was clean each time and
    the UI kept working), but that belief rests on the tsc-clean + working-UI
    reasoning, not on the console going quiet — it never does.
- **Part A of the plan (`C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`)
  is now fully built end-to-end** — all 5 steps (data model, side-list/hover,
  gallery/lightbox, stages, zoom/pan) plus Part B (3 new layouts, hero video,
  Presenter nav bar) and the file-input fix. Nothing scoped in the plan is
  known-incomplete; the plan's own "Known limitations" (no touch-hover,
  hotspot-coordinate drift across differently-framed stage images) remain
  intentionally unsolved, per the plan.

**Left off / next up:**
- Still unconfirmed by the user: the file-input fix resolving their real
  "Choose a file" symptom in their own environment.
- This whole plan has had no dedicated cross-feature regression pass (e.g.
  stages + gallery + zoom/pan all in play on the same view at once) — each
  step was verified in isolation as it was built. Worth a broader manual pass
  before considering this fully done, especially given the console-buffer
  correction above (don't trust an old-looking error as proof of anything
  either way — verify by count-diffing a fresh trigger, or just trust
  `tsc`/actual UI behavior instead).
- The "Linking Test" scratch project can be cleaned up now that Part A is
  fully built and exercised.
- Nothing from today is committed beyond commit `6b68c38` (quick-wins +
  Part A steps 2–4) — this zoom/pan slice is not committed yet.

---

## 2026-09-16 (cont'd 3)

**Done:**
- Built Part A step 4 of the linked-views hotspot upgrade: stages. A view can
  now have named "stages" (e.g. Zoning vs Layout) — a stage switcher row
  appears under the view tabs (`LinkedViewsExplorer` in
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx)) with a "+ Stage"
  button in edit mode. Switching stages can swap the view's image (a stage
  gets its own `url`/`transform` the first time you replace/adjust the image
  while it's active; until then it just shows the view's own image) and
  filters which hotspots are visible/interactive (`stageIds` on the hotspot —
  absent = every stage, so nothing authored before this needs migrating). The
  hotspot popup has a new "Active on" checkbox row (only shown once a view
  has stages) to gate a hotspot to specific stages.
- Verified in-browser on "Linking Test": added a stage ("Stage 1"), confirmed
  it appears as a selectable pill next to "+ Stage", confirmed the existing
  hotspot (no `stageIds` set) still shows on it (correct default-to-all
  behavior). `tsc --noEmit` clean (same pre-existing unrelated `pdfjs-dist`
  errors only); console shows only the pre-existing 400s.
- **Not fully exercised**: only tested with one stage and the default-visible
  case — didn't verify a hotspot actually disappearing when unchecked from a
  specific stage's "Active on" list, or a stage with its own overridden
  image. Worth a closer look before calling step 4 fully done.

**Left off / next up:**
- **Part A step 5 (zoom/pan) has not been started** — deliberately stopped
  here (steps 1–4 done) ahead of a 5pm deadline rather than rush the riskiest
  step (pointer-handler conflicts with the existing draw/hover/click
  handlers) without time to verify it. Next session: pick up step 5 per the
  plan (`C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`) —
  transient viewport zoom/pan, gated on `tool === null`, never persisted.
  Also worth circling back to more thoroughly test stages (see above) before
  starting zoom/pan on top of them.
- Still unconfirmed by the user: the file-input fix resolving their real
  "Choose a file" symptom in their own environment.
- Nothing from today is committed — four batches of uncommitted work now
  (quick-wins layouts+nav bar, side-list+hover, gallery/lightbox, stages).
  Strongly consider committing before ending this session.

---

## 2026-09-16 (cont'd 2)

**Done:**
- Built Part A step 3 of the linked-views hotspot upgrade: gallery/lightbox.
  New [Lightbox.tsx](src/components/Lightbox.tsx) (prev/next viewer, caption,
  optional key-plan thumbnail, Escape/backdrop/close-button dismiss). The
  hotspot edit/create popup in `LinkedViewsExplorer`
  ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)) now has a "Gallery
  images" section — add via file picker (reuses the same fixed file-input
  pattern), thumbnail grid with per-image remove. In view/Presenter mode,
  clicking a hotspot that has a gallery opens the Lightbox instead of
  navigating (a hotspot with both a gallery and a target link currently
  always prefers the gallery — no explicit `clickAction` override wired yet,
  the plan's optional field for that is unused since the default rule covers
  the common case).
- Verified in-browser end-to-end on the "Linking Test" project: added a
  gallery image to the existing hotspot via the popup, saved, opened
  Presenter mode, clicked the hotspot, confirmed the Lightbox opens with that
  image and closes cleanly. `npx tsc --noEmit -p .` clean (the only errors
  are pre-existing/unrelated: `pdfjs-dist` missing types in
  `src/lib/importDeck.ts`, nothing to do with this work). Console shows only
  the pre-existing migration-column 400s, no new errors.

**Left off / next up:**
- Next per the plan's build order: step 4 (stages — gates hotspot visibility
  per named stage, needs a stage switcher UI), then step 5 (zoom/pan, last
  and riskiest for pointer-handler conflicts).
- Still unconfirmed by the user: the file-input fix (reported bug) actually
  resolving their real "Choose a file" symptom in their own environment.
- Nothing from today is committed yet — this is now three batches of
  uncommitted work (quick-wins layouts+nav bar, side-list+hover, this
  gallery/lightbox slice).

---

## 2026-09-16 (cont'd)

**Done:**
- Fixed the "Unable to add image, nothing happens at all" bug reported by the
  user: every hidden `<input type="file">` triggered via `ref.current?.click()`
  used the `hidden` attribute (`display:none`), which some browser/webview
  environments silently refuse to open a native picker for. Switched all four
  occurrences (`MediaBox` and `ClientLogo` in
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx), `OrbitNodeDot` in
  [OrbitDiagram.tsx](src/components/OrbitDiagram.tsx), the client-logo input on
  [page.tsx](src/app/page.tsx)) to a visually-hidden-but-rendered pattern
  (`className="absolute h-px w-px overflow-hidden opacity-0"`). **Not yet
  confirmed by the user in their real environment** — Claude's browser tool
  can't drive a native OS file dialog, so this needs their own hands-on check.
- Built Part A step 2 of the linked-views hotspot upgrade (plan at
  `C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`): side list
  + two-way hover, in `LinkedViewsExplorer`
  ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)) +
  [HotspotSidePanel.tsx](src/components/HotspotSidePanel.tsx). Drawing a
  hotspot now has a Label field and an "Add to side list" checkbox
  (value/description); listed hotspots show in a side panel next to the image;
  hovering either side highlights the other; clicking an existing hotspot in
  edit mode now opens an "Edit hotspot" popup (prefilled, Save/Remove/Cancel)
  instead of instantly deleting it.
- Verified in-browser: created a hotspot with a list entry, confirmed it shows
  in the side panel, confirmed two-way hover in both directions, confirmed
  edit-and-save on an existing hotspot. Chased down a console parse error
  (`SlideRenderer.tsx:1203`) that appeared after a Save click — confirmed
  stale/spurious (current file content at that line doesn't match the quoted
  error, `tsc --noEmit` is clean, and the UI keeps rendering/working
  correctly) rather than a real bug from these edits.

**Left off / next up:**
- Next per the plan's build order: step 3 (gallery/lightbox — new
  `Lightbox.tsx`, `gallery`/`keyPlanImage` fields, authoring UI in the hotspot
  popup), then step 4 (stages), then step 5 (zoom/pan, last/riskiest).
- The "Linking Test" scratch project (has a real hotspot + side-list entry) is
  being kept around intentionally to keep testing later Part A steps against
  it — clean it up once Part A is fully done, not before.
- Ask the user to confirm the file-input fix actually resolves their reported
  symptom in their own environment.
- Nothing from this batch is committed yet.

---

## 2026-09-16

**Done:**
- Imported the Qualcomm/Damascus II PDF bid deck into Presenta as a real
  project (163 slides, split across parallel transcription agents) — see the
  `2026-09-15` entry below for the fuller writeup; this just confirms it
  landed and stayed in Supabase (`proj_slrz9354mu3pc5mz`, name "Qualcomm ·
  Project Damascus II — QC Technical Bid").
- Built the first slice of generalizing `D:\Claude\sidvin-design-deck\index3.html`'s
  interaction patterns into Presenta (full plan at
  `C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md` — read that
  before continuing this work, it has the complete design for everything
  including what's not built yet):
  - Three new slide layouts, each a real `SlideLayout` + fields + renderer,
    not a one-off: `orbit` ([OrbitDiagram.tsx](src/components/OrbitDiagram.tsx),
    a rotating persona diagram with photo/label nodes — CSS-only rotation +
    counter-rotation, reuses `ConceptDiagram.tsx`'s radial-angle math),
    `site-locus` ([SiteLocusDiagram.tsx](src/components/SiteLocusDiagram.tsx),
    hover/tap-reveal card + a CSS sun-orbit compass diagram), and
    `material-compare` ([MaterialCompare.tsx](src/components/MaterialCompare.tsx),
    a draggable before/after slider — the reference's own version turned out
    to have no audio-reactive behavior at all despite the "resonance"/"pulse"
    naming, just a button-triggered sweep between two labeled images; ours
    adds a real drag handle plus keeps the sweep button for parity).
  - Hero video on the title slide (`heroVideoUrl`, URL-only like the
    linked-views walkthrough video) — see `HeroVideo` in
    [SlideRenderer.tsx](src/components/SlideRenderer.tsx).
  - A Presenter-mode navigation bar — step counter, current slide's
    kicker/title as a hint, and clickable dots to jump slides — in
    [present/page.tsx](src/app/p/[id]/present/page.tsx). Pure UI, no data
    model changes.
  - Data model groundwork for the bigger piece (Part A in the plan —
    upgrading `linked-views` hotspots to support a two-way-hover side list,
    per-hotspot image galleries, named "stages," and image zoom/pan): the
    types (`HotspotListEntry`, `HotspotGalleryImage`, `LinkedViewStage`, and
    the new optional fields on `ViewHotspot`/`LinkedView`) are in
    [slide.ts](src/types/slide.ts) now, but **none of it is wired into
    `LinkedViewsExplorer` yet** — the types exist, nothing reads or writes
    them.
- Verified: all three new layouts render cleanly in the browser with no
  console errors beyond the pre-existing migration-column 400s; the
  Presenter nav bar's counter/dots/jump-to-slide all work; an existing
  `linked-views` slide still renders and accepts a new hotspot draw exactly
  as before (confirms the additive type changes didn't disturb anything).

**Left off / next up:**
- **Part A (the linked-views hotspot upgrade) is not started** — data model
  only. Next: wire the side list + two-way hover into `LinkedViewsExplorer`
  (smallest end-to-end slice per the plan), then gallery/lightbox, then
  stages, then zoom/pan last. The plan file has the full component-level
  design already worked out — follow it rather than re-planning.
- **Accidentally wiped one slide's content** on the "zzz" test project while
  verifying linked-views still works: switching a slide's layout resets its
  `fields` to that layout's defaults (correct, pre-existing behavior in
  `changeLayout` — I just hadn't accounted for it), so the "PEOPLE & USER
  NEEDS / User Profiles" concept slide lost its title/lead/points text. Left
  as-is since it's disposable QA test data (same pattern as every other
  `xx`/`zzz` entry in that list), but didn't restore it — worth knowing if
  that specific slide is ever needed again, it isn't recoverable from here.
- Nothing from today is committed yet.

**Watch out for:**
- Browser-pane click coordinates in this environment don't always match
  1:1 with screenshot pixels when the pane is very short/cropped — if a
  click seems to land on the wrong element, re-derive the target's real
  `getBoundingClientRect()` via `javascript_tool` rather than eyeballing a
  screenshot, and prefer `find`/ref-based clicks over raw coordinates where
  the element is actually visible to the accessibility-tree reader (it
  wasn't, for the Properties panel's off-screen-but-scrollable content,
  which is why this took more back-and-forth than it should have).

---

## 2026-09-15

**Done:**
- Fixed the editor's slide canvas to scale to fit the window instead of
  scrolling — [ScaledStage.tsx](src/components/ScaledStage.tsx), wired into
  [edit/page.tsx](src/app/p/[id]/edit/page.tsx).
- Default accent color (no client logo) changed from blue to black —
  `DEFAULT_ACCENT` in [AccentPicker.tsx](src/components/AccentPicker.tsx) and
  [SlideRenderer.tsx](src/components/SlideRenderer.tsx).
- Fixed a real bug where a logo/accent picked at project creation vanished
  immediately in the editor (the editor was always re-fetching from Supabase
  and clobbering the just-created in-memory project) —
  [page.tsx](src/app/page.tsx) now preloads the store,
  [edit/page.tsx](src/app/p/[id]/edit/page.tsx) skips the redundant fetch.
- Built full Google-Slides-style image editing: click an image to select it,
  drag corner handles to resize/crop, drag the handle above to rotate,
  opacity slider, replace/remove/reset — all in an on-image toolbar, no
  separate buttons floating below. Applies to every image slot (Concept,
  Design, Linked Views via `MediaBox` +
  [ImageAdjustOverlay.tsx](src/components/ImageAdjustOverlay.tsx)) and the
  client logo (its own [LogoAdjustOverlay.tsx](src/components/LogoAdjustOverlay.tsx),
  since a logo has no crop frame — a corner handle resizes the whole picture
  instead). Transform data lives on `ImageTransform` in
  [slide.ts](src/types/slide.ts).
- Fixed rotation to be a smooth, incremental drag instead of snapping to the
  pointer's absolute angle on grab (see `ImageAdjustOverlay`/`LogoAdjustOverlay`).
- Set up this file, wired into `CLAUDE.md` via `@PROGRESS.md`. Gitignored
  `.claude/settings.local.json` (personal, machine-specific permission
  approvals) while keeping `.claude/launch.json` (shared dev-server config)
  tracked.
- Added a `SessionEnd` hook (`.claude/settings.json`) as a safety net for
  when a session ends with uncommitted changes and nobody asked for a
  progress-log update: it can't reliably invoke Claude itself
  non-interactively (no `claude` CLI or `jq` on PATH in this environment,
  only the Desktop app's own `claude.exe`, which isn't confirmed to support
  a non-interactive prompt mode without risking a stray window), so instead
  it appends raw `git status`/`diff --stat`/`log` output to
  `PROGRESS.md.pending`, zero dependencies, always works. Picking that up
  and folding it into a real entry here is a `CLAUDE.md` instruction for the
  next session. **Not yet proven end-to-end** — a `SessionEnd` hook fires
  after this turn ends, so I could only pipe-test the command body in
  isolation (confirmed it produces sensible output), not the real hook
  firing. It may also need `/hooks` opened once or a restart to be picked up
  at all, since `.claude/settings.json` didn't exist when this session
  started (the file-watcher only watches directories that already had a
  settings file at session start).

**Left off / next up:**
- **Nothing from today is committed yet** — `git status` shows it all as
  working-tree changes. Review and commit before anyone else can see it,
  including a future session on this same machine.
- The client logo, accent colour, font choice and typography still don't
  persist across a reload: Supabase is missing migrations
  `0003_add_client_logo.sql`, `0004_add_font_family.sql`,
  `0005_add_typography.sql`. Someone with access to the Supabase dashboard
  needs to run them in the SQL Editor (each ends with
  `NOTIFY pgrst, 'reload schema';`, no restart needed). Until then the editor
  shows an amber banner saying exactly this — it's not a regression, it's
  been true for a while.
- Image editing was tested manually in the browser (zoom/pan/rotate/opacity/
  reset/replace/remove, plus the Linked-Views hotspot-tool interaction
  boundary) but has no automated test coverage yet.

**Watch out for:**
- A pre-existing (not introduced today) React "duplicate key" console warning
  shows up on at least one seed/test project in the dev database — not yet
  tracked down. Unrelated to the image-editing work.
