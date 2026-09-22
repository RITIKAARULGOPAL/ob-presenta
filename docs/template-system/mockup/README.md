# Mockup — one slide, fully populated

`s062-zoning-it-biophilic.png` is **S062 Zoning** from
[`../data/slide_library.csv`](../data/slide_library.csv), resolved for the
**EX1 · IT + Biophilic** profile (`T01 + C01 + G2 + SC3 + N1`) and drawn at
Presenta's real slide size.

It exists to answer one question the CSVs can't: *what does a row of the slide
library actually look like once the rules have picked it and a project has
filled it in?*

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

## Rebuilding

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
