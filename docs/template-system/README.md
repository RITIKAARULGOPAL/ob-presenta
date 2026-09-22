# Presenta — Typology + Concept Template System

The **content layer** for template population: which slides exist, what goes on
each, and which of them a given project should get. There are no `src/` changes
here — this folder defines the data and the selection rules; the engine that
reads them is still to be built.

If you are the session building that engine, this file is your entry point.

---

## Read in this order

| # | Read | Why |
|---|---|---|
| 1 | `data/typologies.csv` · `data/typology_axes.csv` | one of the two things a user picks — 16 labels over 5 independent axes |
| 2 | `data/design_concepts.csv` | the other thing a user picks — 12 character themes + 4 grades |
| 3 | `data/slide_library.csv` | the 106 slides the engine is allowed to emit |
| 4 | **`model_rules.py`** | how a pick becomes a deck. **This is the spec — port it, don't re-derive it** |
| 5 | `data/example_decks.csv` | four worked decks to test your port against |

Everything else is derived from those. `data/readme.csv` is the same orientation
text as the Google Sheet's `00 README` tab.

## The one structural decision

`IT`, `GCC`, `Startup` and `Managed Workspace` — the four examples this was
commissioned around — are four different *kinds* of thing: an industry sector,
an occupancy model, a company stage, and a real-estate model. A flat typology
list conflates them and cannot express "IT + Startup" or "IT + GCC", both of
which are ordinary projects.

So: **16 typology labels** (what a project is tagged with) sitting on **5
independent axes** (occupancy, sector, stage/scale, project nature, grade).
The rules read the axes, not the label.

Second decision: **`Premium` is a grade, not a concept.** It composes with every
character theme — Premium Biophilic and Premium Industrial are both coherent —
so it lives on axis E beside Value / Standard / Luxury rather than becoming a
13th theme. Keeping it in the concept list would have made that dimension
non-orthogonal and produced contradictory rules.

## The algorithm to port

Levels: `M` mandatory · `R` recommended (in by default, removable) ·
`O` optional (out by default, offered in the picker) · `X` excluded (never
offered). Numerically `X=-1, O=0, R=1, M=2`.

For each slide, starting from its `baseline`, fold in rule blocks **in this
order**:

```
baseline → typology → project nature → concept(s) → grade → scale
```

Each block does, in this order (`_apply` in `model_rules.py`):

1. `X` → mark excluded, return immediately
2. `down` → `level = min(level, O)`
3. `O`, `R`, `M` → `level = max(level, that)`

Demote before escalate, so a block that trims a whole section but pulls one
slide back out of it behaves the way it reads. `build_deck()` then keeps
`M` and `R` (and `O` when `include_optional`), in library order — which is
deck order.

`SPECIAL_SPACES` short-circuits the baseline: seven space-by-space slides
(dealing floor, lab interface, control tower, public counter, …) are `X`
everywhere except the typologies that own them.

## Four invariants that will bite you

1. **Exclusion is sticky.** An `X` from typology or project-nature can never be
   undone by a later rule. Without this, picking the Tech-Forward concept pulls
   a BFSI dealing floor into a startup deck.
2. **`down` is a separate operation from listing a slide under `O`.**
   Escalations resolve by MAX, so listing an already-`R` slide under `O` does
   nothing at all. Before `down` existed, every deck came out 52–60 slides
   regardless of typology — the one thing this system exists to prevent.
   Today the spread is 28 (Startup) … 59 (GCC / BFSI), 11 distinct lengths
   across 16 typologies.
3. **Every `Presenta layout` value is a real `SlideLayout`** from
   `src/types/slide.ts`, and every `Slide style` a real `SlideStyleKind`.
   Note `design` is a *style*, not a layout — `createStyledSlide('design')` in
   `src/lib/slideDefaults.ts` pairs it with the `title-content` layout. Twenty
   rows got this wrong and would have failed to render; `verify.py` check 2
   parses the real union out of `slide.ts` so it cannot go stale.
4. **The matrices are derived, not hand-filled.** Tabs / CSVs
   `slide_x_typology`, `slide_x_concept`, `example_decks` and `layout_coverage`
   are rendered from `model_rules.py`. Edit the rules and re-run
   `build_sheet.py`; editing a matrix cell by hand is overwritten on the next
   build, and a hand-filled 106×16 grid drifts from the engine the first time
   someone edits one and not the other.

## Test your port against these

| | Combination | Profile | Slides |
|---|---|---|---|
| EX1 | IT + Biophilic | `T01 + C01 + G2 + SC3 + N1` | 57 |
| EX2 | Managed Workspace + Premium | `T04 + C02 + G3 + SC3 + N1` | 55 |
| EX3 | GCC + Contemporary | `T02 + C02 + G2 + SC4 + N1` | 60 |
| EX4 | Startup + Collaborative | `T03 + C03 + G1 + SC2 + N1` | 33 |

`data/example_decks.csv` lists every slide of each, with the rule that put it
there. `verify.py` check 7 re-runs the rules and asserts they reproduce all
four exactly — which is what stops the worked examples from becoming an
aspirational description of behaviour the engine does not have.

## Images

`public/template-library/` — under `public/` so Next.js serves them directly.
18 diagrams that go *on* slides (zoning, adjacency, circulation, journey, sun
path, stacking, workstation mix, ABW settings, access hierarchy, attendance,
acoustics, daylight, programme, …), 12 concept boards, 106 layout thumbnails,
the harvested E-Com Express imagery re-indexed by slide type, and brand marks.
Indexed in `public/template-library/_index.csv` and mirrored as
`data/image_library.csv`.

**No stock photography is included, deliberately.** The 68 photo slots are
**spec rows** — asset slot, required flag, aspect ratio, minimum pixels, no
file. The images these slides need (the reception render, the floor plan)
belong to the project, not to the library. That list is the collection
checklist, and what the engine should render as an empty frame with a prompt.

## Known gaps for the app side

**Eight slides have no adequate layout today** (`data/layout_coverage.csv`):
area-statement table, BOQ line-item table, cost/package table,
option-comparison table, project timeline/Gantt, client-logo wall, mood-board
image grid, team grid. `merge-diagram` and `title-stats` are standing in and
fit none of them well. These are the clearest next build items.

## Regenerate and verify

```bash
pip install openpyxl          # not a project dependency, deliberately
python3 docs/template-system/gen_images.py    # rebuilds public/template-library/
python3 docs/template-system/build_sheet.py   # rebuilds the xlsx + data/*.csv
python3 docs/template-system/verify.py        # 25 checks
```

`verify.py` parses the real `SlideLayout` union out of `src/types/slide.ts` and
the real pillar ids out of `src/lib/conceptLibrary.ts`, so those checks cannot
go stale as the app changes.

## Files

| Path | What |
|---|---|
| `model_typology.py` | 16 typologies, 5 axes, 12 concepts, 4 grades — **authored** |
| `model_slides.py` | the 106 slide types across 9 sections — **authored** |
| `model_rules.py` | selection rules + the four worked examples — **authored** |
| `build_sheet.py` | builds the 13-tab workbook and the CSV mirror |
| `gen_images.py` | builds `public/template-library/` |
| `verify.py` | 25 checks across 8 groups |
| `data/*.csv` | one CSV per tab — **generated**, read these from the engine |
| `presenta-slide-template-system.xlsx` | the workbook; import to Sheets in two clicks |
