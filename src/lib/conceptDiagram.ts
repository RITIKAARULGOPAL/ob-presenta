// Which diagram each concept gets, and why.
//
// The concept slides were text with an empty "paste a URL" box beside them,
// which is not a graphic. There's no file storage in this app, so a library of
// photography isn't an option — but a generated vector diagram is: it needs no
// assets, scales crisply, picks up the deck's accent colour, and rasterises
// fine on export.
//
// Rather than 65 bespoke drawings, each concept maps to a parametric archetype
// that draws itself from the concept's own points. Editing the points on a
// slide therefore redraws its diagram.

export type DiagramKind =
  /** Coloured blocks partitioning a plate — zones, settings, categories. */
  | 'zones'
  /** Nodes joined by weighted links — who sits near whom. */
  | 'nodes'
  /** Routes traced across a plate — movement and flow. */
  | 'paths'
  /** Concentric bands from open to restricted. */
  | 'layers'
  /** A density grid of seats. */
  | 'grid'
  /** A building section with rays or waves entering it. */
  | 'section'
  /** Spokes around a centre — a journey or a set of facets. */
  | 'radial'
  /** Comparative bars — cost, energy, anything measured. */
  | 'bars'
  /** A numbered left-to-right flow. */
  | 'sequence'
  /** Soft organic forms — planting, natural material, wellbeing. */
  | 'organic'
  /** Stacked strata — layers of a build-up or a lifecycle. */
  | 'stack';

/** Concept id → archetype. Anything unmapped falls back by pillar. */
const BY_CONCEPT: Record<string, DiagramKind> = {
  // People & User Needs
  'user-profiles': 'radial',
  'work-styles': 'zones',
  'employee-experience': 'sequence',
  'privacy-inclusion': 'layers',
  'visitor-experience': 'paths',

  // Space Planning
  zoning: 'zones',
  adjacency: 'nodes',
  circulation: 'paths',
  'capacity-density': 'grid',
  flexibility: 'zones',
  'access-hierarchy': 'layers',

  // Work Settings
  'focused-work': 'grid',
  collaboration: 'nodes',
  'formal-meetings': 'zones',
  'informal-collaboration': 'nodes',
  'phone-video-calls': 'grid',
  'training-multipurpose': 'zones',
  'social-breakout': 'organic',
  'wellness-recharge': 'organic',

  // Function & Workflow
  'movement-workflow': 'paths',
  'department-interaction': 'nodes',
  'support-spaces': 'zones',
  'meeting-patterns': 'bars',
  storage: 'stack',

  // Experience & Brand
  'brand-expression': 'radial',
  arrival: 'sequence',
  materiality: 'stack',
  placemaking: 'nodes',
  storytelling: 'sequence',

  // Environmental Design
  'daylight-views': 'section',
  lighting: 'section',
  acoustics: 'section',
  'thermal-comfort': 'section',
  'indoor-air-quality': 'section',
  biophilia: 'organic',

  // Technology
  'power-data': 'grid',
  'av-hybrid-work': 'nodes',
  connectivity: 'radial',
  'smart-workplace': 'grid',
  'future-technology': 'stack',

  // Wellbeing & Ergonomics
  ergonomics: 'radial',
  movement: 'paths',
  'mental-recharge': 'organic',
  'social-wellbeing': 'nodes',
  'user-control': 'radial',

  // Flexibility & Adaptability
  'modular-planning': 'grid',
  'moveable-elements': 'zones',
  'multi-purpose-spaces': 'zones',
  'growth-contraction': 'bars',
  'future-change': 'sequence',

  // Safety, Accessibility & Compliance
  'life-safety': 'paths',
  accessibility: 'paths',
  security: 'layers',
  'emergency-planning': 'paths',

  // Sustainability
  'material-selection': 'stack',
  energy: 'bars',
  water: 'bars',
  'reuse-refurbishment': 'stack',
  'waste-circularity': 'radial',
  'indoor-health': 'organic',

  // Economics & Operations
  budget: 'bars',
  'cost-per-seat': 'grid',
  'lifecycle-cost': 'bars',
  durability: 'stack',
  'operational-efficiency': 'sequence',
};

const BY_PILLAR: Record<string, DiagramKind> = {
  people: 'radial',
  'space-planning': 'zones',
  'work-settings': 'zones',
  'function-workflow': 'paths',
  'experience-brand': 'radial',
  environmental: 'section',
  technology: 'grid',
  wellbeing: 'organic',
  'flexibility-adaptability': 'zones',
  'safety-compliance': 'layers',
  sustainability: 'stack',
  'economics-operations': 'bars',
};

export function diagramFor(pillarId?: string, conceptId?: string): DiagramKind {
  if (conceptId && BY_CONCEPT[conceptId]) return BY_CONCEPT[conceptId];
  if (pillarId && BY_PILLAR[pillarId]) return BY_PILLAR[pillarId];
  return 'zones';
}

/** Deterministic 0–1 from a string, so a diagram's layout is stable per slide
 *  instead of reshuffling on every render. */
export function seedFrom(input: string): () => number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return ((h >>> 0) % 10000) / 10000;
  };
}
