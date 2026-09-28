# Site analysis stage: checklist and plan design

The Site analysis stage (the site due-diligence plan) comes first in a
Linked Views plan, before Zoning. It's optional, like every stage (see
FEATURES.md S1 and S2). This file holds the checklist as the user supplied
it on 2026-09-28, plus a proposal for how each item shows up.

## How items show up (proposal)

Each checklist item is one of four kinds:

| Kind | On the plan | Examples |
|---|---|---|
| **Marker** | An icon placed on a spot, with an optional note or value | Passenger lift, DB location, sprinkler |
| **Line** | A drawn path, with an arrow for routes | Evacuation route, chilled-water line, fire-rated wall |
| **Area** | A shaded region, using the existing region drawing tools | HVAC zone, refuge area, glare zone |
| **Fact** | Not on the plan. A row in a site-facts checklist beside it | Power capacity, landlord fit-out guidelines |

- **Categories are layers.** Each category (Access & Circulation, HVAC,
  Electrical, and so on) can be shown or hidden on its own, so the plan
  isn't cluttered, and you can walk a client through one layer at a time.
  A legend lists the layers that are shown.
- **Every entry can carry a note, a value and a status:** Verified, To
  verify, Not available, or Not applicable. Examples: "Service lift:
  1,600 kg", "Window sill: 900 mm", "Power capacity: 150 kVA, To verify".
- **The site-facts checklist** is a table beside the plan, like the Seating
  Capacity table, listing every Fact item by category with its status,
  value and note. It starts pre-filled with this list, and items can be
  removed or added per project.
- **In Presenter:** layer toggles and the legend stay available, and clicking
  a marker shows its note. Editing controls are hidden.
- **Reuse:** the same marker/line/area system can later carry the Design
  consideration stage (for example, pinned notes) and the Circulation
  stage's routes.

## Checklist

> **Category 1 is missing:** the user confirmed on 2026-09-28 that one exists
> and will send it. Add it above "2. Access & Circulation" when it arrives.

### 2. Access & Circulation
| Item | Shown as |
|---|---|
| Main building entry | Marker |
| Floor entry / lift lobby | Marker |
| Passenger lifts | Marker |
| Service lifts | Marker |
| Staircases | Marker |
| Fire exits | Marker |
| Emergency evacuation routes | Line (route) |
| Service / material movement route | Line (route) |
| Loading/unloading access | Marker |
| Visitor access | Line (route) |
| Staff access | Line (route) |
| Accessibility / wheelchair access | Marker |
| Security checkpoints | Marker |
| Turnstiles / access-control locations | Marker |

### 3. Existing MEP / Building Services

**HVAC**
| Item | Shown as |
|---|---|
| Existing AHUs / FCUs | Marker |
| HVAC zones | Area |
| Supply & return air locations | Marker |
| Fresh-air provisions | Marker |
| Chilled-water lines | Line |
| Condensate drainage | Marker |
| HVAC capacity | Fact |

**Electrical**
| Item | Shown as |
|---|---|
| Electrical room / panel location | Marker |
| DB locations | Marker |
| Power capacity | Fact |
| Existing power points | Marker |
| UPS / DG availability | Fact |
| Electrical shafts | Marker |
| Metering | Fact |

**Plumbing**
| Item | Shown as |
|---|---|
| Water supply points | Marker |
| Drainage points | Marker |
| Soil/waste lines | Line |
| Pantry provisions | Marker |
| Toilet locations | Area |
| Plumbing shafts | Marker |

### 4. Fire & Life Safety
| Item | Shown as |
|---|---|
| Fire exits | Marker |
| Exit widths | Value on each fire-exit marker |
| Fire-rated walls | Line |
| Fire doors | Marker |
| Fire escape routes | Line (route) |
| Fire extinguishers | Marker |
| Sprinkler locations | Marker |
| Fire alarm devices | Marker |
| Smoke detectors | Marker |
| Hose reels / hydrants | Marker |
| Fire shafts | Marker |
| Fire command centre | Marker |
| Refuge areas, if applicable | Area |
| Maximum travel distance | Fact (can be checked with the Dimensions tool) |
| Occupancy/load limitations | Fact |

### 5. Natural & Environmental Conditions
| Item | Shown as |
|---|---|
| Natural light | Area |
| Window locations | Marker |
| Window sizes | Value on each window marker |
| Window sill height | Value on each window marker |
| External views | Marker (with a view direction) |
| Solar orientation | The plan's north arrow, plus a sun-path overlay |
| Heat gain | Area |
| Glare | Area |
| Shading | Area |
| External obstructions | Marker |
| Noise sources | Marker |
| Neighbouring buildings | Area |
| Outdoor air quality / pollution considerations | Fact |
| Existing landscaping / terraces / balconies | Area |

### 6. Regulatory & Landlord Constraints
All of these are **Facts**: rows in the site-facts checklist, each with a
status and a note.

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
