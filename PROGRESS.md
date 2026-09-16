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
