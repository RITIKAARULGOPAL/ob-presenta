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

## 2026-09-22 (cont'd 6) — Presenter: Linked Views plan no longer overflows the slide

**Context:** in Presenter, a Linked Views "Layout" slide with a Stage
present needed to scroll vertically to see the whole plan — the user's ask
was blunt and correct: "the layout should fit the screen and no scrolling
up and down should be there."

**Root cause.** The plan's own box is `aspect-video` (16:9) sized by
*width* (`flex-1` in a row) with height *derived* from that width — nothing
ever checked whether the slide's fixed 1280×720 canvas actually had that
much vertical room left after the rows above it (view tabs, stage tabs,
overlay pills). Ran the numbers: even with *just* the view-tabs row and
nothing else, a full-width plan box derives to 648px tall against only
~582px actually available after padding — this slide type was overflowing
its own canvas by design, not as an edge case. The **shared** slide wrapper
(`base`, used by every layout) makes this worse: it's `min-h-full`, a floor
not a ceiling, so nothing ever stopped it from silently growing past 720px
to accommodate oversized content — the "no scrolling" contract the fixed
1280×720 canvas is supposed to guarantee (matching what `exportDeck.ts`
rasterizes) was never actually enforced for this layout.

**Fix — flip which dimension derives from which**, real flexbox-based
shrink-to-fit rather than any hardcoded pixel budget (Kicker/Title height is
content-dependent, so a hardcoded number would've been fragile):
- `base`'s className now conditionally uses `h-full overflow-hidden`
  instead of `min-h-full`, **only when `slide.layout === 'linked-views'`**
  — confirmed live that every other layout's className is byte-identical to
  before (a Title + Content slide still renders/centers exactly as it did).
  This turns `base` into a genuine 720px *ceiling* for this one layout,
  which the rest of the fix needs to have anything to shrink within.
- `LinkedViewsExplorer`'s own root is now `flex h-full min-h-0 flex-col` —
  claims that fixed budget and (`min-h-0`) is actually allowed to shrink
  below its content's natural size, overriding flexbox's normal default.
- Every "chrome" row above the plan (title/toolbar, view tabs, stage tabs,
  overlay pills, the music/key-plan row) gets `shrink-0` — they're short,
  fixed-content pill rows and should never be the thing that gives.
- The plan+seating row is now the one flexible element (`min-h-0 flex-1
  justify-center`), and the plan box itself drops `flex-1` for `h-full`.
  This is the actual inversion: `flex-1` would make *width* the definite
  dimension (via flex-grow), leaving nothing "auto" for `aspect-ratio` to
  derive — pairing `h-full` with `aspect-video` instead makes *height* the
  definite dimension (the row's own default `align-items: stretch`), so
  width is what gets derived and shrunk. `justify-center` on the row
  absorbs whatever horizontal space that leaves unclaimed. Neither sibling
  panel (`SeatingTable`, `HotspotSidePanel`) needed changes — both already
  had `shrink-0` + `overflow-y-auto`, ready for a definite-height parent.
- Verified live, real pixel measurements in actual Presenter (not the
  editor's own pannable/zoomable canvas, which is intentionally scrollable
  and untouched by this): with a Stage present and a plan image, the
  slide's rendered height matches its scaled 1280×720 box **exactly**
  (`overflowsBy: 0`), and `document.documentElement.scrollHeight` equals
  `window.innerHeight` — no page scroll at all, confirmed both via
  `getBoundingClientRect()` and a screenshot. Structured (`--format json`)
  eslint diff against the committed baseline: zero new errors/warnings.
  `tsc --noEmit` clean. Scratch project deleted after.

**Left off / next up:**
- Not yet checked against a *very* long chain of optional rows all present
  at once (stages **and** a populated overlay-pills row **and** an
  editable-mode toolbar) — plausible the plan could shrink quite narrow in
  that combination, which is the correct trade-off but hasn't been eyeballed
  for legibility at the extreme.
- Nothing from today committed yet — stacks on everything else.

---

## 2026-09-22 (cont'd 5) — North point: always on, drag-to-rotate; a real invisible-text bug

**Context:** follow-up to the toolbar-relocation entry below. Feedback on the
north-point control: it should always be there (no add/remove toggle), show
the actual compass symbol instead of a numeric degree field, and be directly
draggable to rotate. Planned properly first — an Explore pass over the
current code plus the existing image/logo rotate-handle pattern, then a
Plan-agent critique of the synthesized design — since the literal "reuse the
existing rotate pattern" instinct turned out to be wrong in two real
respects (see Design below). Full plan:
`C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`.

**Done:**
- **Removed the on/off toggle.** The toolbar's `"+ North"` button and the
  `N [___]° ✕` input are gone. The on-stage compass badge's gate changed
  from `northDeg != null` to `stageUrl && active.kind !== 'walkthrough'` —
  deliberately narrower than just dropping the null-check, since the badge
  itself never had its own `kind !== 'walkthrough'` guard (the old toolbar's
  gating was the only thing keeping it from ever appearing on a walkthrough
  view, and that protection would have silently vanished once the badge
  started rendering unconditionally). `northDeg` stays `number | undefined`
  in the type — `undefined` now means "never dragged, defaults to 0°" rather
  than "off" (updated the doc comment in [slide.ts](src/types/slide.ts)).
  **Real, visible behaviour change, called out deliberately**: every
  existing Linked View/stage with an image now shows a compass at 0° by
  default — in the editor, Presenter, *and* rendered PDF/image exports
  (`exportDeck.ts` renders the same component tree) — wherever it
  previously showed nothing.
- **Toolbar shows a symbol, not a number.** One always-rendered circular
  icon button (the same compass SVG as the on-stage badge, restyled with
  `currentColor` for toolbar chrome instead of white-on-photo), `cursor-
  grab`, with a `title` tooltip giving the live rounded degree as a
  hover aid. This icon is the *only* drag target — the on-stage badge stays
  `pointer-events-none`, exactly as before.
- **Drag mechanics, and two deliberate departures from the literal
  "reuse `ImageAdjustOverlay`'s pattern" instruction**, both surfaced by the
  Plan-agent critique before writing any code:
  1. Reused the `atan2`-delta-from-drag-start angle math verbatim (it's
     what makes the rotation feel smooth instead of snapping on grab), but
     wired the drag through plain synthetic pointer props +
     `e.currentTarget.setPointerCapture` — the same pattern this
     component's own hotspot-drawing handlers already use — instead of
     `ImageAdjustOverlay`'s `window.addEventListener` + ref-mirroring.
     Capture already keeps delivering moves once the pointer leaves the
     icon's small hit area, so the whole ref-mirroring workaround (built
     for a stale-closure bug in a *different* drag implementation
     elsewhere in this file) never applies here in the first place.
  2. Commits **once**, on release, not on every `pointermove` the way
     `ImageAdjustOverlay` does. Confirmed directly in
     [editorStore.ts](src/lib/editorStore.ts): `commitProject` pushes an
     undo-stack entry on *every* call with no de-duping for array fields,
     and `MAX_HISTORY` is 50 — a live per-move commit wouldn't just take
     "many Undo clicks" to revert one drag, a slow drag could evict
     *unrelated* earlier edits off the stack entirely. A small
     `dragNorthDeg` component-state value carries the live angle during
     the drag (read by **both** the toolbar icon and the on-stage badge, so
     they rotate together in real time — costs nothing extra, since both
     already close over the same `northDeg` in one component), committed
     once via the existing `setStage({ northDeg })` on `pointerup`.
     (`ImageAdjustOverlay`/`LogoAdjustOverlay` likely have this same
     per-move undo-flooding gap already — they predate undo/redo. Not
     touched here, flagged only.)
- **A real bug caught during my own planning, not a hooks-lint nitpick**:
  my first pass declared the new `useState`/`useRef` for the drag
  *after* `LinkedViewsExplorer`'s existing `if (!active) return null;` —
  every other piece of state in this component is deliberately declared
  *before* that line for exactly this reason (two comments in the file
  already say so), and mine broke the same rule. `eslint` caught it
  immediately (`react-hooks/rules-of-hooks`, "called conditionally") —
  fixed by moving both up alongside the component's other transient drag
  state (`panRef`, `viewportZoom`, …). Confirmed via a structured
  (`--format json`, not the fragile text output) diff against the
  committed baseline that this was the *only* thing my changes affected:
  zero new errors/warnings project-wide, one pre-existing one incidentally
  fixed. The two "conditionally called useEffect" warnings still present
  near the drag code are pre-existing (confirmed present in the committed
  file too, from before today) — not mine, not touched.
- **A "double commit" I chased as a real undo-flooding bug turned out to be
  a test-scripting artifact**, the same class of false alarm flagged
  several times earlier this session: an early verification pass showed
  one drag apparently needing two Undo clicks to fully revert. Diagnostic
  logging proved the drag's own commit handler fired exactly once; a
  clean, isolated retest (fresh page load, one drag, one Undo) confirmed a
  single click fully reverts every time — the earlier reading came from two
  separate drags run back-to-back in the same test script, not one.
- **Verified live**, real dispatched pointer drags (down/move/up), not just
  reasoning about the code: the compass renders immediately at 0° with no
  opt-in step; a drag rotates the toolbar icon *and* the on-stage badge
  together in real time (confirmed via `getComputedStyle().transform`
  matrices at intermediate angles, not just the final value); the
  committed angle matches the drag's actual geometry exactly (0°→90°,
  200°→290°); **exactly one** Undo click reverts a whole drag; a
  Walkthrough view shows no compass; two stages (one with its own image,
  one without) hold independent angles correctly, mirroring the
  already-verified stage-independence from the original feature; Presenter
  shows the committed angle with no drag affordance. `tsc --noEmit` clean.

- **Separately, a real bug the user caught live**: the calibration
  "Distance apart"/unit text inputs rendered with effectively invisible
  text. Root cause, confirmed from `globals.css` before touching anything:
  `body { color: var(--app-ink); }` sets the **app chrome's** default text
  colour — dark navy in light mode, near-white (`#e8edf5`) in dark mode —
  and every other piece of slide text in this codebase explicitly
  overrides it per-element (`text-[var(--ink)]`/`-2`/`-3`), which is *why*
  this doesn't show up as a general "dark mode breaks the slide" problem.
  These two inputs (and, once checked, a much longer list: the music/
  key-plan URL row, and nearly every field in the hotspot edit/create
  popup — Label, Jump-to time, list value/description, zone category,
  gallery key-plan URL/arrow, concept title/body/image, walkthrough URL,
  BOQ note, space note) simply never set their own colour, so they fell
  through to the app chrome's — invisible specifically when the *editor
  chrome* (not the slide) is in dark mode, which is exactly the state this
  whole session has been running in. Fixed at the **container** level
  (three spots: the calibration `<span>`, the music/key-plan `<div>`, and
  the hotspot popup's own wrapper) rather than patching each input
  individually — one `text-[var(--ink)]` per container, inherited by every
  field nested inside, matching how `--surface-2`'s light-gray sub-box
  already inherits correctly today. Verified live: both computed colour
  (`rgb(20,26,43)`, an exact match for `--ink`) and a real screenshot,
  before/after.

**Left off / next up:**
- Nothing outstanding on either piece. Scratch project deleted after.
- Still nothing from today committed — stacks on everything else.

---

## 2026-09-22 (cont'd 4) — Linked Views toolbar moved into the title row

**Context:** follow-up to the north-point feature. The per-view toolbar
(Zoom/pan checkbox, the north-point angle control, and the Rectangle/
Ellipse/Polygon drawing tools) lived in its own row, squeezed in next to the
Layout/Render/Walkthrough/Axo view tabs. The user pointed out the empty
space beside the slide's own title, above that row, and asked for the
toolbar to move up into it — with the north-point control moving along with
it, "in line with" the rest.

**Done:**
- **`LinkedViewsExplorer` now renders its own `Title`**, sharing one flex row
  with the toolbar (`slide.title` on the left, toolbar right-aligned via
  `justify-between`), instead of the toolbar sitting in its own row further
  down. The generic per-layout wrapper in `SlideRenderer`
  ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)) now skips its own
  `<Title/>` specifically for `slide.layout === 'linked-views'` so the title
  isn't rendered twice — every other layout is unaffected, still rendering
  `<Title/>` exactly as before. `Kicker` stays where it was; only `Title`
  moved. The view-tabs row (Layout/Render/Walkthrough/Axo) is now on its own
  line beneath, no longer crowded by the toolbar.
- Since `Title` already only needs `slide`/`editable`/`dark`, and `dark` is a
  one-line derivation from `slide.style` (matching the same computation the
  main component already does), `LinkedViewsExplorer` computes it locally
  rather than threading a new prop through.
- **Verified live**: dropped a synthetic image onto a fresh Linked Views
  slide (so the toolbar's `active.url` gate is satisfied), then read real
  `getBoundingClientRect()`s rather than trusting a screenshot — the title
  (`top 318–330`) and the Zoom/pan label / Rectangle button (`top 321–328`)
  overlap vertically, confirming they're genuinely one row, while the view
  tabs row starts cleanly below at `top 335`. Enabling north point placed
  its `N [_]° ✕` control in that same row, and confirmed the already-shipped
  on-stage compass badge (the one rendered over the plan image itself in
  both editor and Presenter) is a completely separate element, untouched by
  this change. Also added a second, non-Linked-Views slide
  (`Title + Content`) and confirmed its title still renders normally with no
  toolbar, proving the `!== 'linked-views'` guard doesn't affect any other
  layout. `tsc --noEmit` clean. Scratch project deleted afterward.

**Left off / next up:**
- Nothing outstanding on this one. Stacks on everything else from today,
  still uncommitted.

---

## 2026-09-22 (cont'd 3) — Design options: multiple plan/concept groups per project

**Context:** while showing the north-point feature live, the user pointed at
Presenter's "1 / 5" slide counter on a real pre-existing project ("xx") and
asked why one slide had 5 layouts — a misreading of that counter (it's the
deck's total slide count, unrelated to the Layout/Zoning/Adjacency/Dimensions
overlay system already built in Phase H), but investigating it surfaced a
real, separate ask underneath: "xx" turned out to have 4 separate Linked
Views slides, and the user wants a real way to express **multiple design
options within one project** — e.g. Option 1 and Option 2 for the same
brief, each with its own concept, plan, and renders. Clarified the shape of
that with two questions: options are a **tag across existing slide types**
(a Concept + a Layout + some Renders sharing a label), not a new slide type
or a bigger new entity — and the "xx" project itself is scratch/test data
(placeholder name, matches this codebase's own established convention),
left untouched.

**Done:**
- **New `Slide.designOption?: string`** ([slide.ts](src/types/slide.ts)) —
  free text, matched by exact string, same convention as
  `ViewHotspot.zoneCategory` already uses: no central registry to keep in
  sync, two slides typed "Option 1" just belong together. New
  `setDesignOption` store action ([editorStore.ts](src/lib/editorStore.ts)),
  mirroring `setBrandOverride` exactly.
- **Editor**: a new "Design Option" section at the very top of the
  Properties panel ([PropertiesPanel.tsx](src/components/PropertiesPanel.tsx))
  — above Background/Layout/Style, since it groups across the whole deck
  rather than describing one slide. A plain text input with a `<datalist>`
  of every option already used in the project, so a second "Option 1" is one
  keystroke, not a near-miss.
- **Slide rail**: consecutive slides sharing an option now get a small
  labelled header (an accent dot + the option name) above the run
  ([SlideRail.tsx](src/components/SlideRail.tsx)) — shown once per
  contiguous run, not repeated per slide, recomputed live off array order so
  drag-to-reorder can never leave it stale.
- **Presenter's nav-dot grouping** (already split the dot row at each
  section-starter slide) now also splits wherever a slide's `designOption`
  changes ([present/page.tsx](src/app/p/[id]/present/page.tsx)) — a deck
  that never sets it is provably unaffected, since every comparison is
  `undefined !== undefined`, which is always false.
- **`cloneSlide` needed no changes** — `designOption` is a plain string with
  nothing to remap, and the function's existing `{ ...slide, ... }` spread
  already carries it over automatically, the same way `brandOverride`/
  `skipped`/`background` already do. Confirmed by reading the spread, not
  assumed.
- **Verified live**, and a real mistake in my own test script became part of
  the proof: tagging the title slide by accident instead of the first
  Linked Views slide produced `[Option 1, untagged, Option 1]` — correctly
  rendered as **two** separate rail headers, since the run was genuinely
  broken by the untagged slide in between. Fixed the mistake, re-tagged the
  two actually-adjacent Linked Views slides, and got exactly **one** header
  this time — proving both the "split on any real change" and "don't repeat
  within a run" halves of the logic, not just the happy path. The datalist
  correctly offered "Option 1" exactly once (deduplicated). Presenter's dot
  groups came out as `[1, 2]` — the untagged title alone, then both
  Option-1 slides together, un-split — confirmed by counting dots per group
  container, not by eye.
- **Nearly touched a real project by accident while setting up the
  demo for this**: a misclick during project-list navigation opened "xx"
  (a real, pre-existing project) instead of creating a new scratch one.
  Caught immediately by checking the Undo button's `disabled` state before
  touching anything further — confirmed `true` (nothing to undo), proving
  zero edits had actually landed, and backed out. Worth remembering: check
  `disabled` on Undo as a cheap, reliable "did I actually change anything
  yet" signal whenever a misclick is suspected, rather than guessing from
  what's on screen.

**Left off / next up:**
- This is the tagging mechanism only — there's no dedicated "manage design
  options" UI (rename one everywhere, reorder them, delete one and see what
  used it), no cross-referencing between an option's Concept/Layout/Render
  slides beyond the shared tag, and no Presenter-level "jump to option"
  navigation beyond what the extended dot-grouping already gives for free.
  All deliberately out of scope for this first pass — the user's own answer
  described the *shape* (existing slide types, tagged, grouped), not these
  extras; worth revisiting once the tagging itself has been used for real.
- The "xx" project's own 4 Linked Views slides (2 real, different plans; 2
  empty) were explicitly left untouched, per the user's own call — not
  migrated into this new tagging, not cleaned up.
- Nothing from today is committed yet.

---

## 2026-09-22 (cont'd 2) — Small follow-ups: dev port, image URL field, collapsible seating

**Done:**
- **Eliminated port 3000 as an option entirely**, rather than just relying on
  remembering to type `dev-3001`. `.claude/launch.json` previously had two
  configs (`dev` on 3000, `dev-3001` on 3001) both running the same bare
  `npm run dev` — the `"port"` field was purely informational, since
  `next dev` defaults to 3000 regardless of it unless a `-p` flag is actually
  passed. Collapsed to a single `dev` entry running
  `npm run dev -- -p 3001` explicitly. Verified by reading the real server
  log line (`next dev -p 3001`, `Local: http://localhost:3001`), not just
  the tool's own reported port. Now the natural-default name (`dev`) can only
  ever bind to 3001; port 3000 stays free for the user's own use with no
  config left that could bind it.
- **Removed the "Paste image URL…" fallback input from `MediaBox`, image-kind
  only** ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)). Checked
  first whether this was safe to remove globally — it isn't: `kind="video"`
  MediaBox instances (walkthrough/hero video) have no upload path at all by
  design (a base64 video would be tens of megabytes in the project row), so
  that same input is their *only* way to ever get a source. Scoped the
  removal to `kind === 'image'` only, after confirming all 5 image call
  sites already pass `onChangeTransform` (meaning the standalone Upload
  button never showed for them anyway — they already fully rely on
  drag-drop, "Choose a file," PDF upload, and the on-image Replace toolbar).
  Verified live: uploaded an image, no URL box appears, ✕ Remove still
  works; switched to a Walkthrough view, "Paste video URL…" is still there
  unchanged.
- **Seating Capacity panel is now collapsible**
  ([SeatingTable.tsx](src/components/SeatingTable.tsx)) — a small ▾ toggle
  next to the title collapses the Area/Req/Achv rows down to just the title
  bar (Excel import stays visible either way), ▸ expands it back. Kept as
  local, non-persisted component state — a viewer convenience like the
  key-plan card's own visible/expanded state, not authored content, so
  collapsing it while presenting never edits the deck. Deliberately a
  sibling `<button>` next to the title rather than wrapping the title in
  one: the title is `contentEditable` via `EditableText`, and a
  `contentEditable` element inside a `<button>` is unreliable (a click meant
  to place the text cursor can fire the button's own click instead).
  Verified live in both the editor and Presenter mode: added a zone/row,
  collapsed (content gone, title + Excel still visible), expanded again
  (content back) — in both places.
- **Follow-on the same session: collapsing now lets the plan actually reflow
  into the freed space**, instead of just leaving it empty. The table's root
  container dropped its fixed `w-72` for a natural `w-auto` while collapsed
  — the plan's own box is a sibling `flex-1 aspect-video` in the same `flex`
  row, so it was already built to grow into whatever width a sibling frees;
  the fix was just letting the table stop claiming that width. Growing the
  width also grows the height, since `aspect-video` derives height from
  width. One line, no new layout logic. Verified by measuring
  `getBoundingClientRect()` before/after collapsing, not just eyeballing it:
  in the editor, 567.1×319.0 → 633.3×356.2px (+11.6% both dimensions,
  exactly preserving 16:9); in Presenter, 927.5×521.7 → 1233.8×694.0px, an
  even bigger jump since Presenter has less competing chrome. Aspect ratio
  held exact in both.
- **North-point arrow on a Linked Views plan** — the standard architectural
  convention of an arrow marking true north, since a plan is rarely drawn
  with north straight up. Built as a small inline SVG (no image asset to
  manage) rotated by an authored angle, the same "store the angle, rotate at
  render time" technique already used for the key-plan card's own
  camera-direction arrow. New `northDeg?: number` on both `LinkedView` and
  `LinkedViewStage` ([slide.ts](src/types/slide.ts)) — scoped and derived
  exactly like `calibration`/`geometry`/`isPdfPlan` already are (a stage
  showing a different plan can face a different way), written through the
  existing `setStage()` helper. `undefined` means no arrow at all — nothing
  changes on any existing deck; `0` is a real, valid angle (north already
  up) and stays distinguishable from "off" the same way `keyPlanImage`'s own
  presence, not a truthiness check on its angle, already gates that
  feature. Editor control sits next to the existing "Zoom/pan" checkbox
  (identical gating — not restricted to just Layout, any non-walkthrough
  view): "+ North" when unset, a compact `N [__]°` input + ✕ once set.
  Originally rendered at `bottom-3 right-3` — the one corner none of the
  other stage overlays occupied, chosen specifically to avoid Reset
  Zoom/music mute at top-right. **Corrected same session**: moved to
  top-right after all, aligned with those other controls rather than kept
  away from them. Reset Zoom, the music-mute button, "Tap for sound," and
  North now all live inside **one shared** `absolute right-2 top-2 z-20
  flex items-center gap-2` row instead of each being independently
  `absolute`-offset — the old approach was already fragile before North
  joined it ("Tap for sound"'s own `right-12` only ever worked because it
  assumed the mute button's exact width at `right-2`); a shared flex row
  gives genuine alignment regardless of how many of the four controls are
  actually present, not one more hand-picked offset to keep in sync.
  North's own badge shrank from `h-10 w-10` to `h-8 w-8` to match the
  music-mute circle's size (same viewBox SVG, scales with no internal
  recalculation). Order left-to-right: North, Reset Zoom, music controls.
  - **Verified live**, not just read off the diff: created the arrow at 0°,
    confirmed `rotate(0deg)`; set 37°, confirmed the DOM transform actually
    changed to `rotate(37deg)`; confirmed `pointer-events: none` via
    *computed* style, not just the class name. Gave a second stage its own
    image and confirmed it correctly stopped inheriting the view's 37° (the
    "+ North" button reappeared, exactly mirroring how a new stage doesn't
    inherit the view's calibration either) — set that stage's own arrow to
    200°. Then, to genuinely prove independence rather than assume it: added
    a *third*, image-less stage and confirmed it inherited the *view's* 37°
    (not either stage's own value), then switched back to the 200° stage and
    confirmed its own value had survived the round trip untouched. Same
    200° confirmed again in Presenter mode.
  - **Re-verified live after the top-right repositioning**, with real pixel
    measurements rather than trusting the CSS by eye: enabled North alone
    first, confirmed it sits at top-right on its own (~5px from the
    corner). Then enabled zoom-in (via a real dispatched wheel event, not a
    stubbed flag) and background music on the same view simultaneously and
    measured all three controls' actual `getBoundingClientRect()`s in
    Presenter — North at x 1077.7–1112.7, Reset Zoom at 1121.4–1207.5, the
    mute button at 1216.3–1251.3, each pair separated by the same ~8–9px
    `gap-2`, all top-aligned within 2px (the flex row's own `items-center`
    correctly reconciling the badge's 35px height against the text
    button's 31px). No overlap, correct order, genuinely one row.

**Left off / next up:**
- Nothing outstanding on any of these. Test projects created for
  verification were deleted from Supabase afterward.
- Still nothing from today committed — this stacks on top of the Linked
  Views audit pass below, which stacks on everything before it.

---

## 2026-09-22 (cont'd) — Linked Views audit and fix pass

**Context:** asked to tighten the Linked Views slide until "every aspect
works perfectly." Ran three parallel investigations first rather than
guessing at scope: a full line-by-line inventory of `LinkedViewsExplorer`,
a chronological mining of every Linked-Views-related `PROGRESS.md` entry
back to 2026-09-15 (bugs already fixed, gaps already flagged, and — just as
important — decisions already made *deliberately* that a "make it perfect"
pass could easily mistake for oversights), and a cross-cutting audit of the
data model, `editorStore.ts`, export, Presenter, and import paths. That
produced a short, bounded list of real gaps, confirmed with the user (wire up
both dead fields found rather than delete them; for the export gap, just
disclose it rather than build per-slide export control), then fixed.

**Done:**
- **`cloneSlide` wasn't remapping `adjacentHotspotIds`**
  ([slideDefaults.ts](src/lib/slideDefaults.ts)) despite its own header
  comment claiming every same-slide cross-reference gets rewritten — it
  already remapped `targetViewId`, `stageIds`, and seating rows'
  `hotspotIds` through the id maps it builds, just not this one. A
  duplicated slide's hotspots were left pointing at the *original* slide's
  hotspot ids in their adjacency lists. Fixed by adding it through the same
  `hotspotIdMap`.
- **`removeHotspot` wasn't cleaning seating-table references**
  ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)) — it already
  purged the deleted id out of every other hotspot's `adjacentHotspotIds`
  (with a comment about exactly this class of staleness) but left
  `seatingZones[].rows[].hotspotIds` untouched. Extended the same function
  to filter it there too, in the same `setView` patch.
- **State-reset consistency.** The one effect that already reset
  `viewportZoom`/`overlayMode`/`pickMode` on `[activeId, activeStageId]`
  now also resets: key-plan visibility/expansion (previously scoped to
  `activeId` only — a stage switch left an expanded card open, unlike every
  other viewer-facing state, which resets on stage changes too);
  `hoveredHotspotId`/`hoveredRowHotspotIds` (previously never reset at
  all — a hover highlight from the last plan could survive onto a new one);
  and `lightboxHotspotId`/`spaceDetailHotspotId`/`spaceDetailGalleryIndex`
  (previously relied on the next render's `hotspots.find(...)` quietly
  returning `undefined` to make the modal disappear, silently skipping
  each one's own `onClose` cleanup). Separately, `cancelDrawing()` — already
  called on view switch — is now also called on stage switch (both the
  stage-tab click and "+ Stage"): editing a hotspot then switching stage
  could leave `editingHotspotId` set while the popup itself vanished
  (`editingHotspot` derives to `null` once the hotspot falls outside the new
  stage's filtered list), a half-cancelled edit session with no visible sign
  anything was wrong.
- **Wired up two fields that were fully speced in the type but dead in the
  UI.** `ViewHotspot.clickAction` — its own doc comment already described
  exactly what it should do ("what a click does when both a gallery and a
  nav target are set"), but nothing ever set it and `jumpTo()` never read
  it, hardcoding its own gallery-then-target priority instead. Added an "On
  click: Open gallery / Jump to target" toggle to the hotspot popup (shown
  only once a hotspot actually has both, since otherwise there's nothing to
  choose between), and `jumpTo()` now checks it before falling back to the
  same default order. Hotspot-level `keyPlanImage` — `Lightbox` already
  accepted and rendered it, there was simply no way to set one from the
  editor. Added a paste-URL + arrow° input to the popup's gallery section,
  mirroring the existing view-level key-plan inputs almost verbatim.
- **Seating table rows couldn't open what they link to.** `HotspotSidePanel`
  rows already called through to `jumpTo`/`startEditingHotspot`; a
  `SeatingTable` row only ever hover-highlighted, even though its own
  cursor-pointer styling already hinted a click should do something (a
  half-finished affordance, not new). Added `onSelectHotspot`, wired only
  when a row maps to exactly **one** hotspot id — a group row spanning
  several stays hover-only, same as before, since there's no single obvious
  target to jump to.
- **Excel import had no preview step**
  ([SeatingTable.tsx](src/components/SeatingTable.tsx)) — parsing and
  committing happened in one step, with the app's global undo as the only
  way back. Now parses first, shows the same added/updated/matched summary
  it already computed, and holds it pending an explicit Apply (or Cancel,
  which discards it untouched).
- **`targetTime` video-seek was a timing race.** `jumpTo`'s old version set
  the active view then hoped one `requestAnimationFrame` later the
  newly-mounted `<video>` would be attached to `videoRef` — fragile, no
  fallback. Replaced with a `pendingSeekRef` consumed by an effect keyed on
  `activeId`: applies immediately if the video is already ready, otherwise
  waits on its own `loadedmetadata` event rather than gambling on a single
  frame. A same-view timestamp jump (video already mounted) still applies
  instantly with no effect round-trip needed.
- **Export-menu notice**, per the user's call rather than building real
  per-slide export control: when a deck contains any Linked Views slide,
  the Export menu now says plainly that it exports only that slide's first
  view/stage — a real, known limitation (confirmed, not fixed, by the same
  cross-cutting audit: `exportDeck.ts` mounts the component cold with no
  way to pick a view/stage) that was previously silent.
- **Verified every one of the above live**, through the real UI, not just
  by reading the diff — on a disposable scratch project with two real
  drawn hotspots, a seating row, a walkthrough video, and a multi-stage
  view: duplicated-slide adjacency remapping (traced by deleting and
  redrawing a hotspot mid-test, confirming the seating row's dangling
  reference was gone — see Watch out for), stage-switch popup
  cancellation (confirmed the tool itself also genuinely reset to `null`,
  not just the popup disappearing visually), a hotspot with both a gallery
  and a target correctly navigating instead of opening its gallery once
  `clickAction` was set to override the default, a seating row opening a
  full `SpaceDetailOverlay` on click, Excel import leaving the table
  untouched on Cancel and committing exactly on Apply, and a `targetTime`
  jump into a walkthrough view that had never been mounted before landing
  at the exact requested second (`video.currentTime === 3`) rather than
  silently doing nothing. `tsc --noEmit` clean throughout; `eslint` stayed
  at or below the branch baseline the whole way (one file's error count
  actually *dropped* by one, from consolidating two separate reset effects
  that each independently tripped the same lint rule into one).
- **Found and ruled out a false alarm, not a real bug, during this pass**:
  redrawing a hotspot produced a `path` with `NaN` coordinates once, which
  looked exactly like a real regression in the drag-to-draw math. Isolated
  by deleting and cleanly redrawing the same hotspot with the viewport held
  perfectly still — it worked correctly every time once the viewport
  genuinely stopped moving mid-drag. The corruption traced to this
  session's own test scripting resizing the browser viewport *while a drag
  was in flight*, not anything in the app.

**Watch out for:**
- The rail-thumbnail-vs-main-canvas DOM-duplication hazard flagged in
  several earlier entries struck again here, compounding with a viewport
  resize this time: tagging "the largest `.aspect-video` element" is **not
  enough on its own** once the viewport has just changed size, because a
  stale reference to a previously-largest element can persist across a
  render that replaced it. Re-tag fresh (excluding anything with a
  `scale-[...]` class, which marks a rail/thumbnail preview) immediately
  before each new interaction rather than trusting a tag set even one tool
  call earlier — and never resize the viewport mid-drag or mid-gesture.
- This session's browser pane's own "responsive" width varies a lot
  between navigations (was seen at 607px, 977px, 1400px, 1677px across
  this project's various sessions) — if `.aspect-video` widths all come
  back tiny (rail-thumbnail-sized), check `window.innerWidth` before
  assuming something is broken; it's very likely just a narrow pane that
  needs an explicit `resize_window({width, height})`, since the `"desktop"`
  preset only clears emulation back to the pane's own current (and not
  necessarily wide) size, it doesn't guarantee a wide one.

**Left off / next up:**
- Phase 6's same-view immediate-seek branch (clicking a `targetTime`
  hotspot while already on that walkthrough view) was reviewed, not
  independently live-tested — the cross-view race case (the harder,
  riskier path) was verified live; the same-view path is a much simpler,
  lower-risk direct assignment with no ref/effect indirection.
- The export-menu notice's negative case (no notice on a deck with zero
  Linked Views slides) was confirmed correct by reading the `.some()`
  gate rather than spun up as a second scratch project — trivially correct
  by construction, not worth the extra project for this pass.
- Nothing from today is committed yet — stacked on top of everything else
  already uncommitted (Phase H, the upload-clobber fix, the PDF-plan
  feature, the home-page field removals). Given how much has piled up,
  worth committing in deliberately separated commits rather than one giant
  one, next time this is picked up.

---

## 2026-09-22 — PDF plans with snap-to-line measurement

**Context:** follow-on to Phase H's calibration/measure tool — measuring by
eye against a raster image means clicking *near* a wall, not *on* it. Ask:
upload the plan as a PDF and pick measurement points off its own vector lines.
Confirmed scope: true snap-to-line (not just a crisper raster), plans
rastered at ~2400px. Plan file:
`C:\Users\Ritika\.claude\plans\ok-lets-no-do-giggly-snowglobe.md`.

**Done:**
- **New [pdfPlan.ts](src/lib/pdfPlan.ts)**: `loadPdfDocument` (reuses
  `importDeck.ts`'s pdfjs/worker setup), `renderPlanPage` (PNG, not JPEG — a
  plan is thin lines on white, exactly where JPEG ringing smears the edges
  you're trying to click), and `extractPlanGeometry`. The last one is the
  risky part: pdf.js v6 changed its path-operator encoding from what training
  data would suggest — verified against the installed source
  (`node_modules/pdfjs-dist/legacy/build/pdf.mjs`) before writing a line of
  extraction code. A `constructPath` op's path data is a flat **Float32Array**
  buffer (`0,x,y` moveTo · `1,x,y` lineTo · `2,×6` cubic · `3,×4` quad · `4`
  close) — `Array.isArray()` on it is `false`, a check that would have made
  extraction silently find nothing. It's also **mutated into a `Path2D`
  during rendering**, so geometry has to be read before the page renders, not
  after — extraction runs first for exactly this reason. Curves are sampled
  (4 segments) in PDF space against their own control points so arcs stay
  snappable instead of collapsing to a chord.
- **New `PlanGeometry`** ([slide.ts](src/types/slide.ts)): flat
  `vertices`/`segments` number arrays (not `{x,y}` objects — this rides next
  to a ~1MB plan image in the project row, and the object form roughly
  triples the JSON), normalised into the **same 0–1 frame space hotspots and
  calibration already use**, with the `contain` letterbox baked in at
  extraction time — so the runtime needs no aspect maths to place a snap
  point. Added to both `LinkedView` and `LinkedViewStage`, scoped and cleared
  exactly like `calibration`. New `isPdfPlan` flag disables the authored
  crop for a PDF plan — re-cropping would desync both the geometry and the
  calibration.
- **`object-cover` was cropping every non-16:9 plan** — an A4/A1 plan is
  ~1.41:1 against the stage's fixed 16:9, so the top and bottom were being
  cropped away entirely, uncroppable. New `fit?: 'cover'|'contain'` prop on
  `MediaBox` ([SlideRenderer.tsx](src/components/SlideRenderer.tsx));
  `'contain'` for PDF plans, `'cover'` unchanged everywhere else.
- **`MediaBox` now accepts PDFs** — `accept()` branches on
  `application/pdf`, a 1-page PDF goes straight through, a multi-page one
  gets a compact page-number picker (no thumbnail strip — a real 1397-page
  bid deck exists in this user's workflow, so a blanket thumbnail render
  would hang). A new `onPdfPlan` callback hands the caller the rendered
  image *and* geometry together, so the linked-views call site commits both
  in **one** `setStage()` patch — two writes into the same `views` array in
  one tick clobber each other, exactly the bug fixed in the entry below this
  one, and the reason that fix's freshest-state read stayed in `setView`.
- **New [planSnap.ts](src/lib/planSnap.ts)**: a uniform hash-grid index over
  a plan's geometry, `snapTo(point, radius)` → nearest vertex within radius,
  falling back to nearest point along an edge (vertices win outright, not by
  distance — a wall's own edge passes within a hair of its corner, so
  nearest-wins would make corners nearly unselectable). Wired into the
  pick-capture layer already built for calibrate/measure: `onPointerMove`
  now tracks a live snap candidate (shown as a small on-canvas indicator —
  a box for a vertex, a dot for an edge point) and the click commits the
  *snapped* point, not the raw one. Snap radius is a fixed screen-pixel
  distance divided by viewer zoom, so precision doesn't get coarser the
  further in you zoom — exactly when it's wanted.
- **Found and fixed a real bug during verification, not a fluke of the test
  harness**: the first version's snap radius/distance math treated the
  16:9 frame as if it were square — comparing raw `dx`/`dy` in
  frame-normalised units with a single isotropic radius. Since 1 frame-y-unit
  is worth *fewer* screen pixels than 1 frame-x-unit whenever the frame is
  wider than tall, an on-screen circle of "equal" radius was actually an
  oval: generous near the frame's diagonal, silently short in the vertical
  direction. A live end-to-end test caught it directly — clicking 6px off a
  known corner sometimes missed the vertex snap and fell through to an edge
  snap on the adjacent wall instead, producing a measured 5.03 m against a
  provably-exact 5.00 m edge. Confirmed analytically before touching code
  (naive frame-distance 0.0426 vs. radius 0.0418 — just outside; the
  existing `dy/aspect` correction already established in `planOverlay.ts`'s
  `realDistance` brings it to 0.0296 — comfortably inside). Fixed by
  threading `aspect` through `buildSnapIndex`/`snapTo`: grid cells and all
  distance comparisons now work in x-equivalent units (`y` divided by
  `aspect` for indexing and distance, un-divided again on the point actually
  returned), the same correction this codebase already uses for real-world
  distance, just applied to hit-testing too.
- **Verified end-to-end through the real UI**, not just the extraction
  module in isolation, using a synthetic vector PDF with exactly known
  dimensions (reportlab: an 8.00 × 5.00 m room with a 4.00 m interior wall
  and a 4.00 m partition, at a stated 50pt/m scale, on a deliberately
  non-16:9 A4-landscape page): uploaded through the actual file input,
  confirmed "Added — 92KB · 8 snap points" (matching the room's 4 corners +
  the two interior-wall endpoints + the partition's endpoint pair exactly);
  confirmed the full-page letterboxed `contain` render shows the whole plan,
  nothing cropped; calibrated by clicking 6px off both ends of the known
  8.00 m edge and confirmed both clicks snapped to the *exact* stored vertex
  coordinates despite the imprecise click; measured the vertical 5.00 m edge
  (the check that specifically catches a missing aspect correction, since a
  naive implementation reports the same figure for both axes) — **5.00 m
  exactly** after the fix, was 5.03 m before it; re-measured the horizontal
  8.00 m edge for a full closed-loop confirmation — **8.00 m exactly**.
  Separately uploaded a synthetic *raster-only* PDF (a PNG embedded via
  `drawImage`, zero vector paths) and confirmed the honest fallback: "Added
  — 87KB. No vector lines in this PDF (it looks scanned), so picks won't
  snap." `tsc --noEmit` clean; eslint at the branch baseline (17 errors,
  unchanged) after fixing one self-inflicted violation — a plain async
  function named `applyPdfPage` (originally `usePdfPage`) tripped
  `react-hooks/rules-of-hooks` purely on its name.
- **A live browser-testing gotcha worth recording, since it cost real time
  here**: the rail thumbnail preview renders its own independent
  `LinkedViewsExplorer` instance, so buttons like "Dimensions"/"Measure"/
  "Recalibrate" exist **twice** in the DOM — once in the tiny non-editable
  rail preview, once in the real editable main canvas — and a plain
  text-match `find()` silently grabs whichever renders first, not
  necessarily the one meant. This produced a very convincing false alarm
  (the plan's own image appeared to have been silently replaced by an
  unrelated JPEG mid-test) before the actual cause became clear: several
  clicks upstream had landed on the rail preview's own controls instead of
  the main canvas's. Tagging the real target once with a throwaway
  `data-test-*` attribute and scoping every subsequent query to it resolved
  it immediately. Same class of issue flagged in the 2026-09-18 entries
  below — worth remembering as a standing rule for this component
  specifically, not just a one-off.

**Left off / next up:**
- Not yet retrofitted onto **stage** switching mid-session — a view's own
  base plan and a stage's own plan both carry `geometry`/`isPdfPlan`
  independently and correctly, but there's no dedicated test yet of
  uploading a PDF specifically *as a stage* (only the no-stage view path was
  exercised live). The code path is identical (`setStage()` already routes
  to whichever owns the image), so this is believed correct by
  construction, not proven live.
- The page picker for a multi-page PDF was built but not exercised live —
  only ever tested with 1-page PDFs, which skip it entirely. Worth a real
  multi-page upload check next time this is touched.
- Segment/vertex decimation caps (`MAX_SEGMENTS`/`MAX_VERTICES` in
  `pdfPlan.ts`) are untested against a genuinely dense real-world plan — the
  synthetic test PDF has only 6 segments, nowhere near the cap.
- Nothing from today is committed yet — stacked on top of Phase H and
  everything still uncommitted below it.

---

## 2026-09-21 (cont'd 5) — Linked Views image upload silently discarded

**Context:** user reported "unable to upload image" on a Linked Views image
slot, with a screenshot showing the upload's own success note ("Added —
113KB.") next to a still-empty slot. So the file *was* read; something threw
it away right afterwards.

**Done:**
- **Root cause**: `MediaBox.accept()` commits two things back-to-back in one
  tick — `onChangeUrl(dataUrl)` then `onChangeTransform?.(undefined)`. For an
  ordinary slide those are two *separate* fields, so they can't collide. For a
  Linked View both land inside the same `views` array, and
  `LinkedViewsExplorer`'s `setView` mapped over the `views` from **this
  render's closure** — so the second write was computed from a snapshot taken
  before the first one, and silently overwrote the just-set url with `''`.
  Classic stale-closure clobber; it only ever surfaced here because this is
  the one place two writes into one array field happen in the same tick.
- **Fix** (one line, [SlideRenderer.tsx](src/components/SlideRenderer.tsx),
  `setView`): read the freshest views from the store
  (`useEditorStore.getState()`) instead of the closure before mapping.
- **Verified by A/B, not by inspection.** With the fix: the note fires, the
  image renders, and the persisted url is a real 1111-char
  `data:image/jpeg;base64…`. With the fix reverted and the identical drop
  replayed: the note still fires ("Added — 1KB.") but no image renders and
  the url stays empty — exactly the reported symptom, reproduced and then
  un-reproduced on demand. `tsc --noEmit` clean.
- **Testing gotcha worth keeping**: the first repro attempt looked like the
  bug *didn't* exist, because the synthetic drop targeted an ancestor `<div>`
  rather than the `bg-black/30` frame that actually owns `onDrop` — the
  handler simply never ran (no note at all). If a scripted drop produces no
  note, the drop missed the frame; that's not the same signal as a note with
  no image.
- Cleaned up the repro project (`proj_7a7735a81a0c429f278`) from Supabase.

**Left off / next up:**
- **Any other component that commits two patches into the same array field in
  one tick has this same shape of bug.** `setView` is fixed; nothing else was
  audited for it. Worth a grep next time someone's in here.
- Still uncommitted, stacked on Phase H (below) and everything before it.

---

## 2026-09-21 (cont'd 4) — Phase H: layout overlay modes + calibration

**Context:** the last item from the post-demo action plan, scoped with the
user back when the plan was written: a Layout view should carry several
readings of the same plan — Zoning, Adjacency, Dimensions — switchable live
mid-pitch, with dimensions requiring the plan to be calibrated first. Built on
top of the phases 1-3 UI rework, on that branch.

**Done:**
- **Three overlay modes plus the plain plan**, as a pill row under the stage
  switcher in `LinkedViewsExplorer`
  ([SlideRenderer.tsx](src/components/SlideRenderer.tsx)). The active mode is
  transient state, deliberately — like the active stage, it's how the plan is
  being *looked at* right now, not something authored into the deck. It resets
  on every view/stage change, since an overlay left over from another plan
  would be describing the wrong image. An overlay with no data behind it is
  offered only while editing; in Presenter it's hidden rather than being a
  dead end mid-pitch.
- **Zoning** — new `ViewHotspot.zoneCategory` (free text). Each space is
  repainted by its zone, with the colour *derived from the zone's own name*
  (`zoneColor()` in [planOverlay.ts](src/lib/planOverlay.ts)) rather than
  configured: two spaces typed "Meeting" always match, in this deck and the
  next, with nothing to keep in sync. Unzoned spaces stay visible but read as
  unassigned instead of quietly joining whichever zone looks nearest. A legend
  of the zones in use sits inline in the pill row. The editor's zone field
  offers the view's existing zones as a datalist, so a second "Meeting" is one
  keystroke rather than a near-miss like "meeting ".
- **Adjacency** — new `ViewHotspot.adjacentHotspotIds`, drawn as connector
  lines between space centroids. Only one end of a pair has to name the other
  (the overlay dedupes by sorted id pair), so linking is one click per
  relationship rather than two. Deleting a space also drops it from everyone
  else's adjacency list, so a plan that gets rebuilt doesn't accumulate links
  pointing at nothing.
- **Dimensions + calibration** — new `PlanCalibration` on both
  `LinkedViewStage` and `LinkedView` (per stage, because each stage can carry
  a different plan at a different scale; on the view itself for the common
  no-stages case). Calibrate by clicking two points and entering the real
  distance between them; then every space gets an area label and a Measure
  tool gives point-to-point distances. Uncalibrated, it says so and offers to
  calibrate rather than showing confident wrong numbers. Replacing the image
  clears the calibration — a new plan is a new scale.
- **The one genuinely easy-to-get-wrong part is the units**, so it's worth
  spelling out: scale is stored as `unitsPerWidth` — how many real units span
  the frame's full width — not as any kind of pixels-per-unit. Hotspot
  coordinates are already normalised 0–1 against that same frame, so this one
  number stays correct at any render size, export scale or viewer zoom with no
  recalibration. Conversions also need the frame's aspect ratio, because a
  normalised step sideways covers more ground than the same step downwards;
  the frame is `aspect-video`, so that's a constant 16:9 rather than something
  measured. Verified live: the same calibration produced identical areas in
  the editor (frame 327×184px) and in Presenter (1044×587px).
- Verified end-to-end against a seeded four-space plan: zoning gave the two
  "Front of House" spaces the same colour and the other two their own;
  adjacency drew exactly the 3 expected pairs at the right centroids, with no
  duplicates, including two spaces that were only ever named *by* others;
  areas came out at the hand-computed values (59.4 / 177.84 / 42.12 m²); the
  ruler round-tripped the calibration distance exactly (20.0 m) and read
  11.25 m for a vertical span of the same normalised length — which is the
  measurement that actually proves the aspect correction is applied, since a
  naive version reports 20 m for both. `tsc --noEmit` clean; project-wide
  eslint unchanged at the branch baseline of 17 errors / 6 warnings.

**Watch out for:**
- **A wrong calibration I chased as an app bug turned out to be the test
  harness.** Synthetic clicks were dispatched using a stage rect captured
  moments earlier, while entering calibrate mode had just re-flowed the
  toolbar row above the stage and resized it — so the points the handler
  computed weren't the ones intended, and the stored scale was ~4× off. It
  looked exactly like a units bug, and the wrong numbers then showed up in
  Presenter, which made it look like an edit-vs-present mismatch on top.
  Instrumenting the save path settled it in one run. For any future scripted
  verification here: re-read the element rect immediately before dispatching,
  never across a state change that can re-lay-out the toolbar.
- Calibration is tied to the plan *as currently framed*. The image is drawn
  `object-cover`, so changing the authored crop (zoom/pan on the image)
  shifts the plan within the frame and invalidates the scale. Replacing the
  image clears it automatically; re-cropping does not.

**Left off / next up:**
- **"Rendered layout" was read as "the plan with no overlay"** and is the
  `Plan` pill. If what was wanted is a *photoreal render* of the same floor,
  that's already expressible as a stage (a stage carries its own image), so
  it may just need wiring rather than new code — worth confirming which was
  meant.
- Zoning/adjacency/calibration are all authored per hotspot or per stage
  through the existing popup; there's no bulk way to zone a whole plan yet.
  Fine for a plan with a handful of spaces, tedious for a large one.
- Phases 4-6 of the UI rework (⌘K palette, home redesign, concept-library
  dialog) are still pending — unchanged by this.

---

## 2026-09-21 (cont'd 3) — UI/UX rework, phases 1-3

**Context:** asked to make the app feel like a designer-friendly modern tool.
Chosen together: a fresh, denser pro-tool direction; full UX rework; the whole
app. Reviewed as a mockup first —
[canvas](https://claude.ai/artifact/NjkSTkpHmtT3Kvrx7XtJik), six artboards —
and approved with one condition: **do not deviate from the Presenta idea and
features.** Nothing may become unreachable; the plan carries a parity
checklist.

Six phases. This is 1 to 3; the review checkpoint is now.

**Done:**
- **Tokens** ([globals.css](src/app/globals.css)). A six-step type scale
  (`text-micro` … `text-display`) replacing nine ad-hoc sizes — `text-[9px]`
  through `text-4xl`, with `text-xs` and `text-[12px]` both in use for the
  same 12px. Three chrome radii as `rounded-ui-sm/md/lg`, deliberately NOT
  `--radius-*`: **the deck owns that name** and slides reference
  `var(--radius-md)` directly, so taking it would reshape exported cards.
  Plus one `--ease-ui`.
- **Primitives** (`src/components/ui/`): `Button`/`IconButton`/`ToolbarDivider`,
  `Menu`/`MenuItem`/`MenuLabel`/`MenuSeparator`/`Kbd`, `SegmentedControl`.
  `ThemeToggle` now sits on `SegmentedControl` — it always was one.
- **Editor shell** ([edit/page.tsx](src/app/p/[id]/edit/page.tsx)) rebuilt as
  two rows: a 48px header for the *deck* (name, save status, undo/redo, theme,
  add, export, present) and a 44px toolbar for the *current slide*. Zoom
  floats on the canvas instead of owning a full-width footer. The two
  hand-rolled dropdowns are gone — `Menu` handles Escape, click-outside and
  focus return, which neither did.
- **Slide Style and Slide Layout moved out of the properties panel** into
  toolbar menus that say what is currently set. 18 always-visible pills
  became two triggers.

**Watch out for:**
- **I deleted the Background section by accident** doing that move, and only
  caught it because eslint flagged the orphaned `setSlideBackground`. The
  end-anchor of the deletion was "the next section whose icon is `IconImage`"
  — but Background uses `IconDroplet`, so the cut ran past it into Logo &
  Copyright. Restored from `git show HEAD:`. If you cut a region out of a
  file by matching markup, **diff the section list before and after** — the
  parity checklist exists for exactly this.

**Left off / next up:**
- Phase 4 is the real IA work: contextual inspector with `Disclosure` groups,
  the layout picker as a searchable dialog with real slide previews, and ⌘K
  over `editorStore`'s ~50 named actions. The footer shortcut hint stays until
  ⌘K can carry it — removing discoverability before replacing it is a
  regression.
- Then Phase 5 (home grid) and 6 (concept library, Presenter last — it is
  used live in front of clients).
- Verified: build clean; eslint 17 errors/6 warnings, identical to the
  `98b4056` baseline; both themes driven in Chromium at 1440 wide;
  `scrollWidth === innerWidth` still holds.

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

- **Fixed the horizontal overflow** flagged as pre-existing in the entry
  below. Root cause: `ScaledStage` in `pannable` mode lays its slide out at a
  literal `width: 1280px` and only shrinks it *visually* with
  `transform: scale()` — and a transform does not change layout size. That
  gave `<main>` a 1280px min-content width, which a flex item will not shrink
  below, so 1280 + rail 192 + panel 288 + padding 64 = the 1824px body width
  measured earlier. One class (`min-w-0` on the stage `<main>` in
  [edit/page.tsx](src/app/p/[id]/edit/page.tsx)) lets it shrink; the stage's
  own `overflow-auto` then scrolls internally as intended. Verified
  `scrollWidth === innerWidth` at both 1440 and 1280, panel fully on screen.

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
- ~~The editor page overflows horizontally at 1440px wide.~~ **Fixed** — see
  the comfort-pass entry above.
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
