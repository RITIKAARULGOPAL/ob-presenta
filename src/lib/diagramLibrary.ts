// The diagram library: real floor-plan/process diagrams, built as genuine
// FreeformElement[] data — every box, line and label independently editable
// on the canvas, exactly like an imported PPTX slide (ecomExpressSlides) —
// rather than a picture of one. An author drops a preset onto a slide, then
// relabels/resizes/recolours the boxes to fit their own project.
//
// Source content: docs/template-system/ (the 106-slide typology library and
// its 18 companion diagrams, gen_images.py). This is the first of those 18
// rebuilt as real elements instead of a flat generated PNG — the proof that
// "editable library artwork" actually works before converting the rest.
//
// Nothing here touches the database: same pattern as conceptSlides.ts, a
// preset is just data and diagramSlide() returns the same {layout, style,
// fields} shape the editor already understands.

import { makeId } from './id';
import type { FreeformElement, Slide } from '@/types/slide';

export interface DiagramPreset {
  id: string;
  title: string;
  /** One line shown under the thumbnail in the library picker. */
  description: string;
  elements: FreeformElement[];
}

// Same validated categorical palette already used by every diagram in
// public/template-library (docs/template-system/gen_images.py, P[]) — one
// palette across the whole system, generated or hand-built.
const BLUE = '#2a78d6';
const GREEN = '#1baf7a';
const ORANGE = '#eb6834';
const AMBER = '#eda100';
const PINK = '#e87ba4';
const GREY = '#6b6b6b';
const INK = '#141a2b';
const INK_MUTED = '#6b7280';

/** One zone: a tinted, outlined box plus its own title/detail labels — three
 *  independently-draggable elements per zone rather than one element with
 *  baked-in text, so a label can be repositioned or resized without dragging
 *  the box it describes along with it. */
function zone(
  key: string,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
  fillOpacity: number,
  title: string,
  detail: string,
): FreeformElement[] {
  const pad = 0.010;
  return [
    { id: `${key}-box`, type: 'shape', kind: 'rect', x, y, w, h, color, fillOpacity, stroke: color, strokeWidth: 2, radius: 6 },
    {
      id: `${key}-title`,
      type: 'text',
      x: x + pad,
      y: y + 0.012,
      w: w - pad * 2,
      h: 0.045,
      fontSize: 14,
      paragraphs: [{ align: 'left', runs: [{ text: title, bold: true, color: INK }] }],
    },
    {
      id: `${key}-detail`,
      type: 'text',
      x: x + pad,
      y: y + 0.055,
      w: w - pad * 2,
      h: h - 0.06,
      fontSize: 11,
      paragraphs: [{ align: 'left', runs: [{ text: detail, color: INK_MUTED }] }],
    },
  ];
}

const ZONING_ELEMENTS: FreeformElement[] = [
  // Kicker — one paragraph, two runs, matching the real Kicker component's
  // own accent-eyebrow-then-muted-label treatment.
  {
    id: 'kicker',
    type: 'text',
    x: 0.050,
    y: 0.035,
    w: 0.500,
    h: 0.040,
    fontSize: 12,
    paragraphs: [{ align: 'left', runs: [
      { text: 'PLANNING', bold: true, color: BLUE },
      { text: '   ·   04 · ZONING', color: INK_MUTED },
    ] }],
  },
  {
    id: 'title',
    type: 'text',
    x: 0.048,
    y: 0.075,
    w: 0.500,
    h: 0.090,
    fontSize: 30,
    paragraphs: [{ align: 'left', runs: [{ text: 'Zoning', bold: true, color: INK }] }],
  },

  // The floor plate outline. Fill-less by design (this is the "frame the
  // whole plan" rectangle every zoning/circulation/daylight diagram in the
  // library draws) — fillOpacity 0 makes SlideRenderer's FreeformShape
  // render it non-interactive, so it can't sit on top of the zones and
  // swallow clicks meant for them.
  { id: 'plate', type: 'shape', kind: 'rect', x: 0.050, y: 0.205, w: 0.900, h: 0.585, color: '#000000', fillOpacity: 0, stroke: INK, strokeWidth: 2, radius: 8 },

  // Entry
  { id: 'entry-line', type: 'shape', kind: 'line', x: 0.006, y: 0.290, w: 0.046, h: 0.020, color: INK, strokeWidth: 2, arrowEnd: true },
  {
    id: 'entry-label', type: 'text', x: 0.000, y: 0.258, w: 0.060, h: 0.028, fontSize: 10,
    paragraphs: [{ align: 'left', runs: [{ text: 'ENTRY', bold: true, color: INK }] }],
  },

  // Seven zones — same numbers as the worked EX1 (IT + Biophilic) example,
  // kept as a believable starting point an author edits rather than a blank
  // template; the whole point of "editable" is that none of this is final.
  ...zone('wh-n', 0.060, 0.215, 0.730, 0.155, GREEN, 0.15, 'Workhall · North', '9,400 sq ft · 268 desks · daylit elevation'),
  ...zone('wh-s', 0.060, 0.625, 0.730, 0.150, GREEN, 0.15, 'Workhall · South', '8,600 sq ft · 244 desks · daylit elevation'),
  ...zone('arrival', 0.060, 0.385, 0.150, 0.220, BLUE, 0.15, 'Arrival & Client Suite', '3,200 sq ft · 6 rooms, segregated'),
  ...zone('collab', 0.222, 0.385, 0.205, 0.220, ORANGE, 0.15, 'Collaboration Spine', '5,600 sq ft · 14 rooms · 4 war rooms'),
  ...zone('core', 0.440, 0.385, 0.110, 0.220, GREY, 0.16, 'Core & Support', '3,900 sq ft · services, server, stores'),
  ...zone('focus', 0.563, 0.385, 0.145, 0.220, AMBER, 0.18, 'Focus & Booths', '22 phone booths'),
  ...zone('social', 0.800, 0.215, 0.140, 0.560, PINK, 0.15, 'Social / Town Hall', '5,400 sq ft · 180 covers — seats the all-hands without a second room'),

  // The planting spine — the one move Biophilic actually adds to an IT
  // zoning plan: a dashed connector run through the collaboration zone.
  { id: 'spine-line', type: 'shape', kind: 'line', x: 0.232, y: 0.565, w: 0.176, h: 0.010, color: GREEN, strokeWidth: 3, dashed: true },
  {
    id: 'spine-label', type: 'text', x: 0.232, y: 0.535, w: 0.180, h: 0.025, fontSize: 10,
    paragraphs: [{ align: 'left', runs: [{ text: 'planting spine', bold: true, color: GREEN }] }],
  },

  {
    id: 'caption', type: 'text', x: 0.060, y: 0.815, w: 0.880, h: 0.090, fontSize: 12,
    paragraphs: [
      { align: 'left', runs: [
        { text: 'Adjacency logic — ', bold: true, color: INK },
        { text: 'both halls take the daylit long elevations; core, support and every enclosed room are pushed inboard, so no desk sits more than 12 m from glass.', color: INK_MUTED },
      ] },
    ],
  },
];

export const DIAGRAM_PRESETS: DiagramPreset[] = [
  {
    id: 'zoning-it-biophilic',
    title: 'Zoning',
    description: 'A floor resolved into zones before any furniture — 7 labeled zones, an entry arrow, a planting-spine connector.',
    elements: ZONING_ELEMENTS,
  },
];

/** One preset, one freeform slide — mints fresh element ids per insertion so
 *  two drops of the same preset never collide (same pattern as
 *  conceptSlide()'s own `concept.elements` branch). No title/kicker chrome
 *  from the layout itself, because the preset already carries its own —
 *  same convention as every other freeform slide. */
export function diagramSlide(preset: DiagramPreset): Slide {
  return {
    id: makeId('slide'),
    layout: 'freeform',
    style: 'standard',
    fields: { elements: preset.elements.map((el) => ({ ...el, id: makeId('elem') })) },
    animation: { entry: 'fadeUp', duration: 600, delay: 0 },
  };
}
