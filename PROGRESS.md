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
