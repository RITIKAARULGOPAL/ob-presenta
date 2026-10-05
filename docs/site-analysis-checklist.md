# Site analysis stage (S2): checklist, design and build plan

The Site analysis stage (the site due-diligence plan) comes first in a
Linked Views plan, before Zoning. It's optional, like every stage (see
FEATURES.md S1 and S2). This file holds the checklist as the user supplied
it on 2026-09-28 (category 1 arrived later the same day), how each item
shows up, and the plan for building it.

**Status:** plan written 2026-09-28 and checked against the code on 09-29.
Waiting for sign-off; nothing is built yet.

## Decisions for sign-off

My recommendation comes first in each.

1. **What a marker looks like.** A small circle in its layer's colour with
   a short code (PL, DB, SP…), explained by the legend, like the symbol key
   on a drawing. The alternative, a drawn icon for each of the 37 marker
   items, adds about 2–3 days.
2. **Design regions stay off the site plan.** A region left at "Active on:
   every stage" shows on every stage except Site analysis (and on Site
   analysis too while it's the only stage). A region drawn on Site analysis
   starts out on that stage only. Without this, every-stage regions show on
   the site plan. It costs about a day, because several places assume
   "every stage" really means every stage.
3. **Where details are edited.** In the Properties panel at full size, both
   for entries on the plan and for rows in the checklist: click one on the
   slide, edit it in the panel. The alternative is editing on the slide
   itself, where controls render at about 8px in the editor (U9) and the
   hotspot popup is already cramped (U10).
4. **What sits beside the plan.** On the Site analysis stage the Site
   checklist takes the Seating Capacity table's place, at the same width.
   Seating comes back on the other stages.
5. **The checklist in Presenter.** Only rows with something recorded (a
   value, a status or a note) show, so a client isn't shown 34 empty rows.
   The editor always shows every row.
6. **Later stages.** Site layers show on the Site analysis stage only.
   Showing chosen layers (columns, shafts, cores, fire exits) faintly on the
   later stages, as a reference, is a follow-up of about a day.
7. **What an export shows.** A Linked Views slide exports one picture: its
   first view at its first stage. With Site analysis first, that would be
   the site plan rather than the design. Recommended: export the first stage
   after Site analysis, and the site plan only when it's the only stage.
   Exporting every stage belongs to the per-view export item (W18).

## How it works

### Setting it up
- A plan can have one Site analysis stage. "+ Stage" offers it only while
  the plan has none, and adding it sets it up, with the checklist
  pre-filled with the 34 fact rows below.
- A stage named "Site analysis" that was added before S2 ships gets a "Set
  up site analysis" button in the Properties panel.
- The stage is recognised by its content, not its name, so renaming it
  keeps it a site analysis stage. "Remove site analysis" in the panel turns
  it back into an ordinary stage, deleting its entries and checklist; Undo
  brings them back.

### Layers
- Each category is a layer with its own colour: Site & Building, Access &
  Circulation, HVAC, Electrical, Plumbing, Fire & Life Safety, and Natural &
  Environmental. Regulatory & Landlord is facts only, so it has no layer on
  the plan.
- A legend inside the plan frame, top left across from North and
  Dimensions, lists the layers that have entries, with a count. It sits
  inside the frame so the plan doesn't change size between stages.
- Clicking a layer shows or hides it, in the editor and in Presenter, so
  you can walk a client through one layer at a time. This isn't saved:
  every layer shows again when you come back to the stage.

### Placing entries (editor)
- The Properties panel lists the checklist's plan items by layer, with a
  search box ("lift", "DB", "sprinkler"). Picking one turns off the region
  tools and Calibrate, since one tool works at a time. Then:
  - **Marker:** click the plan to drop it. The item stays picked, so twenty
    sprinklers take twenty clicks. Esc stops.
  - **Line:** click each point. Enter, a double-click or Finish ends it.
    Routes get arrowheads, pipes and beams are dashed, walls are thicker,
    and a grid line carries its label (A, B, 1, 2…) in a bubble.
  - **Area:** drawn with the region tools' shapes (rectangle, ellipse,
    polygon, spline, freehand).
- Each layer also offers a custom marker, line or area with a name of your
  own.
- Click an entry to select it; its details show in the Properties panel.
  Drag a marker to move it. Delete or Backspace removes the selected entry,
  and Esc deselects. Undo covers every step.
- Once a Site analysis stage has entries, its plan can't be re-cropped, as
  with PDF plans today, since moving the plan would leave the entries
  behind. Replacing the image keeps them, for a cleaner copy of the same
  plan.

### An entry's details
- Label, value, status and note. The value has a hint where the checklist
  names one: a fire exit's width, a window's size and sill height, a
  column's size, a slab level, a beam's drop, a level difference.
- Status is Verified, To verify, Not available, Not applicable, or not
  checked yet. On the plan, a marker set to To verify gets an amber dot and
  one set to Not available a red dot.
- An External view marker gets a direction, drawn as an arrow on it.

### The Site checklist (beside the plan)
- The facts, grouped by category, each showing its value and status. It
  collapses and closes like the Seating Capacity table.
- In the editor, clicking a row edits it in the Properties panel, where
  rows can also be removed, added back, or added to any category with a
  name of your own.

### Presenter
- The layers, legend and checklist show as in the editor, without the
  editing controls.
- Clicking a marker, line or area opens a small card with its label, value,
  status and note, kept inside the plan frame. Esc or a click elsewhere
  closes it without leaving Presenter, and opening a region's gallery or
  space detail closes it first.
- Arriving at the slide shows the first stage, as today, so a plan with
  Site analysis opens on the site plan and steps forward from there.

### With the rest of Linked Views
- Moving from Site analysis to Zoning fades the site layers out on the same
  1.2-second clock as the plan morph, and back in going the other way.
  Where only one of the two stages has a table beside the plan, the table
  slides in or out, so the plan resizes smoothly instead of jumping.
- Dimensions, calibration and north work as on any stage, so maximum travel
  distance can be checked with Dimensions.
- Deleting the stage deletes its site analysis. The delete dialog says how
  many entries and rows go with it, and Undo brings them back. Duplicating
  the slide copies it.
- Rail thumbnails, Presenter's dot previews and exports show the layers but
  never react to clicks.

## Build plan

About 13–14 working days (2.5–3 weeks), in this order, each step checked
live before the next. There's no automated test suite, so the checks are
by hand in the in-app browser.

0. **Groundwork (½d).**
   - Fix B2 first, so Delete and Backspace remove a slide only while the
     slide rail has focus, as in Google Slides. Selected entries need those
     keys.
   - Remount the Linked Views component per slide, so a picked tool or
     hidden layers can't carry over to the next plan slide.
   - Add an explicit "interactive" flag, so rail thumbnails, dot previews
     and exports never take clicks.
1. **Data and checklist (1d).**
   - Types in `slide.ts`: `LinkedViewStage.siteAnalysis` holds `entries`
     (markers, lines and areas) and `facts`. The entry type is generic, so
     Design consideration pins can reuse it later.
   - The checklist in `src/lib/siteChecklist.ts`: layers, colours, items,
     codes and value hints.
   - Pure functions in `src/lib/siteAnalysis.ts` for setting up, adding,
     moving, editing and removing. Each returns the view unchanged when
     nothing changed, so a no-op never costs an Undo step, and all of them
     are written through the store's `updateLinkedView`.
   - `cloneSlide` gives copied entries and facts new ids.
2. **Drawing the layers (1.5d).**
   - Markers are HTML, so they stay round at any size, like the plan's
     existing labels.
   - Lines and areas get their own SVG with a 1600×900 box, so dashes and
     arrowheads keep their shape.
   - The legend and its toggles.
   - The fade with the stage transition, and the table's slide-in.
   - Markers keep their size when a viewer zooms in.
3. **Placing and selecting (3d).**
   - A site tool, separate from the region tools.
   - Clicks are gated, so placing or selecting never also opens the image
     adjuster, a region's popup, a measurement or a pan.
   - Marker drag, with a move threshold and one commit on release.
   - The line tool, and areas drawn through the region shapes.
   - Selection. Delete, Backspace and Esc are claimed only while an entry is
     selected, and never from inside a menu or dialog.
4. **Properties panel (2d).**
   - The site tools' state (selected entry, picked item, hidden layers)
     lives in the store, and entries are read fresh from the deck, so the
     panel can't show stale data (B16's lesson).
   - Set up and remove, the layer list, the item list with search, custom
     items, and the selected entry's or row's fields, including the
     External view direction.
   - Edits are drafted, then committed on blur or Enter against that
     entry's own ids. A selection change mid-edit can't write into the
     wrong entry, and typing doesn't fill the 50-step Undo history.
5. **Site checklist (1d).** Grouped rows, selection, remove and add back,
   the Presenter filter, and collapse and close.
6. **Presenter (1d).** The entry card, status dots and legend toggles, with
   Esc handled before Presenter's own keys.
7. **Stage integration (2d).**
   - One Site analysis stage per plan in "+ Stage", and set-up for stages
     added before S2.
   - Decision 2's region rule, about 1d on its own. One helper serves the
     stage filter, "Active on", the delete dialog's counts and default carry
     targets, and stage deletion.
   - The delete dialog's site-analysis counts, the crop lock, and decision
     7's export.
8. **Verification and docs (1.5d).**
   - Checked live: the editor, Presenter, the rail, undo, duplicate,
     delete, reload and export.
   - `tsc`, and eslint against a baseline.
   - FEATURES.md and PROGRESS.md.

New code goes in new files: the two libraries above, plus components for
the layer, the panel section, the checklist and the card.
`LinkedViewsExplorer` only wires them in, since it's already about 2,600
lines.

**Follow-ups, not in this estimate:**
- Layers on later stages (decision 6), about 1d.
- A sun-path overlay for solar orientation, ½d.
- Values printed next to markers on the plan, ½d.
- Moving a line's or an area's points after drawing, 1d.
- Drawn icons (decision 1), 2–3d.
- Excel import and export of the checklist, 1d.
- Exporting every stage, part of W18's per-view export.

## Checklist

96 items in 6 categories. "Shown as" says how each appears. Marker codes
are proposals and can change.

### 1. Site & Building Information
| Item | Shown as |
|---|---|
| Site location & address | Fact |
| Building / campus context | Fact |
| Floor number | Fact |
| Floor plate shape & dimensions | The plan itself, with its overall size as a Fact (measure it with Dimensions) |
| Floor-to-floor height | Fact |
| Clear ceiling height | Fact |
| Structural grid | Line (grid), one per grid line, with its label |
| Column sizes & locations | Marker `C`, with the size as its value |
| Beams / drop beams | Line (dashed), with the drop as its value |
| Core locations | Area |
| Existing shafts | Marker `SH` |
| Floor area — carpet / built-up / chargeable | Three Facts: carpet, built-up and chargeable area |
| Existing walls / partitions | Line (wall) |
| Existing slab levels | Marker `LV`, with the level as its value |
| Floor level differences | Area, with the difference as its value |

### 2. Access & Circulation
| Item | Shown as |
|---|---|
| Main building entry | Marker `BE` |
| Floor entry / lift lobby | Marker `LL` |
| Passenger lifts | Marker `PL` |
| Service lifts | Marker `SL` |
| Staircases | Marker `ST` |
| Fire exits | Placed once, on the Fire & Life Safety layer (category 4) |
| Emergency evacuation routes | Line (route) |
| Service / material movement route | Line (route) |
| Loading/unloading access | Marker `LD` |
| Visitor access | Line (route) |
| Staff access | Line (route) |
| Accessibility / wheelchair access | Marker `WA` |
| Security checkpoints | Marker `SC` |
| Turnstiles / access-control locations | Marker `TS` |

### 3. Existing MEP / Building Services

**HVAC**
| Item | Shown as |
|---|---|
| Existing AHUs / FCUs | Marker `AHU` |
| HVAC zones | Area |
| Supply & return air locations | Marker `SR` |
| Fresh-air provisions | Marker `FA` |
| Chilled-water lines | Line (dashed) |
| Condensate drainage | Marker `CD` |
| HVAC capacity | Fact |

**Electrical**
| Item | Shown as |
|---|---|
| Electrical room / panel location | Marker `ER` |
| DB locations | Marker `DB` |
| Power capacity | Fact |
| Existing power points | Marker `PP` |
| UPS / DG availability | Fact |
| Electrical shafts | Marker `ES` |
| Metering | Fact |

**Plumbing**
| Item | Shown as |
|---|---|
| Water supply points | Marker `WS` |
| Drainage points | Marker `DP` |
| Soil/waste lines | Line (dashed) |
| Pantry provisions | Marker `PN` |
| Toilet locations | Area |
| Plumbing shafts | Marker `PS` |

### 4. Fire & Life Safety
| Item | Shown as |
|---|---|
| Fire exits | Marker `EX` |
| Exit widths | Value on each fire-exit marker |
| Fire-rated walls | Line (wall) |
| Fire doors | Marker `FD` |
| Fire escape routes | Line (route) |
| Fire extinguishers | Marker `FE` |
| Sprinkler locations | Marker `SP` |
| Fire alarm devices | Marker `AL` |
| Smoke detectors | Marker `SD` |
| Hose reels / hydrants | Marker `HR` |
| Fire shafts | Marker `FS` |
| Fire command centre | Marker `FC` |
| Refuge areas, if applicable | Area |
| Maximum travel distance | Fact (can be checked with the Dimensions tool) |
| Occupancy/load limitations | Fact |

### 5. Natural & Environmental Conditions
| Item | Shown as |
|---|---|
| Natural light | Area |
| Window locations | Marker `W` |
| Window sizes | Value on each window marker |
| Window sill height | Value on each window marker |
| External views | Marker `V`, with a view direction |
| Solar orientation | The plan's north arrow; a sun-path overlay is a follow-up |
| Heat gain | Area |
| Glare | Area |
| Shading | Area |
| External obstructions | Marker `OB` |
| Noise sources | Marker `NS` |
| Neighbouring buildings | Area |
| Outdoor air quality / pollution considerations | Fact |
| Existing landscaping / terraces / balconies | Area |

### 6. Regulatory & Landlord Constraints
All of these are **Facts**: rows in the site checklist, each with a status
and a note.

- Local building regulations
- Fire regulations
- Accessibility regulations
- NBC / applicable codes
- Local authority requirements
- Building management guidelines
- Landlord fit-out guidelines
- Permissible working hours
- Noise restrictions
- Material movement restrictions
- Lift usage restrictions
- Debris disposal rules
- Signage restrictions
- Façade restrictions
- Wet-area restrictions
- Structural modification restrictions
- Core drilling restrictions
- Ceiling / slab modification restrictions
