# Mockup — one slide, fully populated

**S062 Zoning** from [`../data/slide_library.csv`](../data/slide_library.csv),
resolved for the **EX1 · IT + Biophilic** profile (`T01 + C01 + G2 + SC3 + N1`)
and drawn at Presenta's real slide size.

It exists to answer one question the CSVs can't: *what does a row of the slide
library actually look like once the rules have picked it and a project has
filled it in?*

**Live page:** https://claude.ai/artifact/LhXgwBmFCdhZSFyzdF7oPP — the same
`.slide` content below, framed in a short page (title, a one-line summary of
what T01+C01 each contributed, the slide itself scaled to fit, a real/invented
note). Private; share it from its own page if someone besides the owner needs
it. `s062-zoning-it-biophilic.html` is its source — republish that same path
to update the page in place.

`s062-zoning-it-biophilic.png` is a flat crop of just the `.slide` element,
made before the page grew that surrounding chrome — still accurate, since the
slide markup itself hasn't changed, just what wraps it.

## What is real vs. invented

| Real | Invented |
|---|---|
| The 1280×720 stage (`ScaledStage.tsx`) | The floor plate — `_index.csv` marks it `photo-slot`, "supplied per project" |
| Every colour token, taken from `SlideRenderer.tsx`'s slide-root style block | The zone names, areas and headcount |
| `DEFAULT_ACCENT = #000000` (`AccentPicker.tsx`) | |
| Kicker / Title / BrandFooter chrome, at their real sizes | |
| The `linked-views` layout: view tabs, stage pills, plan, two-way-hover side list | |
| Zone colours — the categorical palette already used by every diagram in `public/template-library` (`gen_images.py`, `P[]`) | |

No real client is named. The numbers are internally consistent (38,000 sq ft,
620 headcount, 512 desks, 1 : 0.83) because a sharing ratio that contradicts
the attendance slide is exactly the failure this system exists to prevent.

## What the typology and the concept each contributed

- **T01 IT** — a dense workhall split in two, a collaboration spine with war
  rooms, phone booths at scale, and one social space big enough to double as
  the all-hands. The sharing ratio is the argument, so it gets the footer.
- **C01 Biophilic** — both halls take the daylit long elevations and every
  enclosed room is pushed inboard; the planting spine is drawn where it lands.

Swap the typology and the same slide changes shape: **T06 BFSI** replaces the
collaboration spine with a dealing floor and segregates the client suite behind
an access boundary; **T03 Startup** loses the client suite entirely.

## Rebuilding the PNG

The recipe below is **stale** as of the page gaining its wrapper chrome — it
assumed `.slide` sat alone at the document's top-left at native 1280×720
(`body{width:1280px;height:720px}`). It's kept for the history: it's still
correct for any future file built that same way, and the 85px lesson below
still applies to this file too.

```bash
/opt/pw-browsers/chromium --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --force-device-scale-factor=2 --window-size=1280,805 \
  --screenshot=/tmp/raw.png --allow-file-access-from-files \
  file://$PWD/s062-zoning-it-biophilic.html
python3 -c "from PIL import Image; \
  Image.open('/tmp/raw.png').convert('RGB').crop((0,0,2560,1440)) \
  .save('s062-zoning-it-biophilic.png')"
```

**The window is 805, not 720, on purpose.** This Chromium gives a viewport 85 px
shorter than the requested window, so a `--window-size=1280,720` render silently
clips everything below y≈635 — the brand footer disappears and the side panel
loses its last line — while still writing a full-height PNG whose bottom rows are
transparent. `gen_images.py` never hit this because an SVG document has an
intrinsic size. Render 85 px tall and crop back.

Now that `.slide` sits inside a JS-scaled `.stage-frame` partway down a
responsive page, reproducing this exact crop means forcing the frame to render
at its native, unscaled width (viewport ≥ 1280 + the page's own side padding
so `.stage-frame.clientWidth === 1280` and the JS scale resolves to 1), then
cropping to `.stage-frame`'s actual rendered rect rather than `(0,0)` — that
rect now depends on the header's height above it, so it isn't a fixed offset.
Not yet scripted; the one existing PNG was captured before this was true and
didn't need it.

**A second, unrelated Chromium quirk, found rebuilding this page responsively:**
`--window-size` under ~500px wide is **not reliable** in this same bundled
Chromium — `window.innerWidth` was measured (via an injected script) reporting
~500 regardless of a smaller requested width, while the screenshot's own pixel
dimensions still exactly matched the smaller request. The page gets laid out
at that wider internal size, then the screenshot canvas simply **crops** it
down to the requested pixel dimensions — text and boxes appear to overflow the
right edge, looking exactly like a CSS bug, when the actual page is correct
(confirmed: identical CSS renders pixel-perfect, zero horizontal scroll, at
1200px). Don't trust a `--window-size` narrower than ~550px from this
Chromium for responsive/mobile-width checks — verify with the injected
`getBoundingClientRect()` + `innerWidth` trick before believing what a narrow
screenshot appears to show, or just reason about the CSS directly.
