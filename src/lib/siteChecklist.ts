import { makeId } from './id';
import type { PlanLineStyle, SiteCategoryKey, SiteFact, SiteStatus } from '@/types/slide';

// The Site analysis checklist (S2), as the user supplied it on 2026-09-28:
// 96 items in 6 categories, with MEP split into its HVAC, Electrical and
// Plumbing groups so each can be a layer of its own. docs/site-analysis-
// checklist.md is the readable copy and says how each item shows up. A few
// of its items aren't entries of their own here: exit widths and window
// sizes and sill heights are values on the fire-exit and window markers,
// solar orientation is the plan's north arrow, fire exits are placed once
// (on the Fire & Life Safety layer), and floor area is three rows.

export interface SiteCategoryDef {
  key: SiteCategoryKey;
  label: string;
  /** For the legend on the plan, where room is short. */
  short: string;
  /** Fixed per layer rather than derived from a name like zone colours: the
   *  legend is a symbol key, so a layer should look the same in every deck.
   *  Each is dark enough to carry a marker's white code. */
  color: string;
}

export const SITE_CATEGORIES: SiteCategoryDef[] = [
  { key: 'site', label: 'Site & Building', short: 'Site', color: '#5b6474' },
  { key: 'access', label: 'Access & Circulation', short: 'Access', color: '#0b72c2' },
  { key: 'hvac', label: 'HVAC', short: 'HVAC', color: '#0f766e' },
  { key: 'electrical', label: 'Electrical', short: 'Electrical', color: '#b45309' },
  { key: 'plumbing', label: 'Plumbing', short: 'Plumbing', color: '#6d28d9' },
  { key: 'fire', label: 'Fire & Life Safety', short: 'Fire', color: '#c0392b' },
  { key: 'natural', label: 'Natural & Environmental', short: 'Natural', color: '#4d7c0f' },
  { key: 'regulatory', label: 'Regulatory & Landlord', short: 'Regulatory', color: '#a4479b' },
];

/** The categories that are layers on the plan. Regulatory & Landlord is
 *  facts only. */
export const PLAN_LAYERS = SITE_CATEGORIES.filter((c) => c.key !== 'regulatory');

export function siteCategory(key: SiteCategoryKey): SiteCategoryDef {
  return SITE_CATEGORIES.find((c) => c.key === key) ?? SITE_CATEGORIES[0];
}

export interface SiteItemDef {
  key: string;
  category: SiteCategoryKey;
  label: string;
  kind: 'marker' | 'line' | 'area' | 'fact';
  /** Markers: the code drawn in the circle. */
  code?: string;
  /** Lines. */
  lineStyle?: PlanLineStyle;
  /** Placeholder for the value, where the checklist names one. */
  valueHint?: string;
  /** Markers with a view direction (External views). */
  direction?: boolean;
}

const marker = (key: string, category: SiteCategoryKey, label: string, code: string, valueHint?: string): SiteItemDef => ({
  key,
  category,
  label,
  kind: 'marker',
  code,
  valueHint,
});
const line = (key: string, category: SiteCategoryKey, label: string, lineStyle: PlanLineStyle, valueHint?: string): SiteItemDef => ({
  key,
  category,
  label,
  kind: 'line',
  lineStyle,
  valueHint,
});
const area = (key: string, category: SiteCategoryKey, label: string, valueHint?: string): SiteItemDef => ({ key, category, label, kind: 'area', valueHint });
const fact = (key: string, category: SiteCategoryKey, label: string, valueHint?: string): SiteItemDef => ({ key, category, label, kind: 'fact', valueHint });

/** In checklist order within each category. */
export const SITE_ITEMS: SiteItemDef[] = [
  // 1. Site & Building Information
  fact('site.location', 'site', 'Site location & address'),
  fact('site.campus', 'site', 'Building / campus context'),
  fact('site.floor-number', 'site', 'Floor number', 'e.g. 7th of 12'),
  fact('site.floor-plate', 'site', 'Floor plate shape & dimensions', 'e.g. rectangular, 62 × 38 m'),
  fact('site.floor-to-floor', 'site', 'Floor-to-floor height', 'e.g. 4.2 m'),
  fact('site.clear-height', 'site', 'Clear ceiling height', 'e.g. 3.0 m'),
  line('site.grid', 'site', 'Structural grid', 'grid', 'Grid label, e.g. A or 3'),
  marker('site.columns', 'site', 'Column sizes & locations', 'C', 'Size, e.g. 600 × 600'),
  line('site.beams', 'site', 'Beams / drop beams', 'dashed', 'Drop, e.g. 600 mm'),
  area('site.cores', 'site', 'Core locations'),
  marker('site.shafts', 'site', 'Existing shafts', 'SH'),
  fact('site.carpet-area', 'site', 'Carpet area', 'e.g. 12,000 sq ft'),
  fact('site.built-up-area', 'site', 'Built-up area', 'e.g. 14,500 sq ft'),
  fact('site.chargeable-area', 'site', 'Chargeable area', 'e.g. 18,000 sq ft'),
  line('site.walls', 'site', 'Existing walls / partitions', 'wall'),
  marker('site.slab-levels', 'site', 'Existing slab levels', 'LV', 'Level, e.g. +0.00'),
  area('site.level-differences', 'site', 'Floor level differences', 'Difference, e.g. −150 mm'),

  // 2. Access & Circulation (fire exits are on the Fire & Life Safety layer)
  marker('access.building-entry', 'access', 'Main building entry', 'BE'),
  marker('access.lift-lobby', 'access', 'Floor entry / lift lobby', 'LL'),
  marker('access.passenger-lifts', 'access', 'Passenger lifts', 'PL', 'e.g. 13 persons, 1,000 kg'),
  marker('access.service-lifts', 'access', 'Service lifts', 'SL', 'Capacity, e.g. 1,600 kg'),
  marker('access.staircases', 'access', 'Staircases', 'ST'),
  line('access.evacuation-routes', 'access', 'Emergency evacuation routes', 'route'),
  line('access.service-route', 'access', 'Service / material movement route', 'route'),
  marker('access.loading', 'access', 'Loading/unloading access', 'LD'),
  line('access.visitor', 'access', 'Visitor access', 'route'),
  line('access.staff', 'access', 'Staff access', 'route'),
  marker('access.wheelchair', 'access', 'Accessibility / wheelchair access', 'WA'),
  marker('access.security', 'access', 'Security checkpoints', 'SC'),
  marker('access.turnstiles', 'access', 'Turnstiles / access-control locations', 'TS'),

  // 3. Existing MEP / Building Services: HVAC
  marker('hvac.ahu', 'hvac', 'Existing AHUs / FCUs', 'AHU'),
  area('hvac.zones', 'hvac', 'HVAC zones'),
  marker('hvac.supply-return', 'hvac', 'Supply & return air locations', 'SR'),
  marker('hvac.fresh-air', 'hvac', 'Fresh-air provisions', 'FA'),
  line('hvac.chilled-water', 'hvac', 'Chilled-water lines', 'dashed'),
  marker('hvac.condensate', 'hvac', 'Condensate drainage', 'CD'),
  fact('hvac.capacity', 'hvac', 'HVAC capacity', 'e.g. 120 TR'),

  // Electrical
  marker('electrical.room', 'electrical', 'Electrical room / panel location', 'ER'),
  marker('electrical.db', 'electrical', 'DB locations', 'DB', 'e.g. 63 A TPN, 12-way'),
  fact('electrical.capacity', 'electrical', 'Power capacity', 'e.g. 150 kVA'),
  marker('electrical.power-points', 'electrical', 'Existing power points', 'PP'),
  fact('electrical.ups-dg', 'electrical', 'UPS / DG availability', 'e.g. DG, 250 kVA'),
  marker('electrical.shafts', 'electrical', 'Electrical shafts', 'ES'),
  fact('electrical.metering', 'electrical', 'Metering'),

  // Plumbing
  marker('plumbing.water-supply', 'plumbing', 'Water supply points', 'WS'),
  marker('plumbing.drainage', 'plumbing', 'Drainage points', 'DP'),
  line('plumbing.soil-waste', 'plumbing', 'Soil/waste lines', 'dashed'),
  marker('plumbing.pantry', 'plumbing', 'Pantry provisions', 'PN'),
  area('plumbing.toilets', 'plumbing', 'Toilet locations'),
  marker('plumbing.shafts', 'plumbing', 'Plumbing shafts', 'PS'),

  // 4. Fire & Life Safety
  marker('fire.exits', 'fire', 'Fire exits', 'EX', 'Width, e.g. 1,200 mm'),
  line('fire.rated-walls', 'fire', 'Fire-rated walls', 'wall', 'Rating, e.g. 2 h'),
  marker('fire.doors', 'fire', 'Fire doors', 'FD', 'Rating, e.g. 2 h'),
  line('fire.escape-routes', 'fire', 'Fire escape routes', 'route'),
  marker('fire.extinguishers', 'fire', 'Fire extinguishers', 'FE', 'Type, e.g. CO₂ 4.5 kg'),
  marker('fire.sprinklers', 'fire', 'Sprinkler locations', 'SP'),
  marker('fire.alarms', 'fire', 'Fire alarm devices', 'AL'),
  marker('fire.smoke-detectors', 'fire', 'Smoke detectors', 'SD'),
  marker('fire.hose-reels', 'fire', 'Hose reels / hydrants', 'HR'),
  marker('fire.shafts', 'fire', 'Fire shafts', 'FS'),
  marker('fire.command-centre', 'fire', 'Fire command centre', 'FC'),
  area('fire.refuge', 'fire', 'Refuge areas, if applicable'),
  fact('fire.travel-distance', 'fire', 'Maximum travel distance', 'e.g. 30 m, measured with Dimensions'),
  fact('fire.occupancy', 'fire', 'Occupancy/load limitations'),

  // 5. Natural & Environmental Conditions
  area('natural.light', 'natural', 'Natural light'),
  marker('natural.windows', 'natural', 'Window locations', 'W', 'Size and sill, e.g. 1,800 × 1,500, sill 900'),
  { ...marker('natural.views', 'natural', 'External views', 'V'), direction: true },
  area('natural.heat-gain', 'natural', 'Heat gain'),
  area('natural.glare', 'natural', 'Glare'),
  area('natural.shading', 'natural', 'Shading'),
  marker('natural.obstructions', 'natural', 'External obstructions', 'OB'),
  marker('natural.noise', 'natural', 'Noise sources', 'NS'),
  area('natural.neighbours', 'natural', 'Neighbouring buildings'),
  fact('natural.air-quality', 'natural', 'Outdoor air quality / pollution considerations'),
  area('natural.landscaping', 'natural', 'Existing landscaping / terraces / balconies'),

  // 6. Regulatory & Landlord Constraints
  fact('regulatory.building-regs', 'regulatory', 'Local building regulations'),
  fact('regulatory.fire-regs', 'regulatory', 'Fire regulations'),
  fact('regulatory.accessibility-regs', 'regulatory', 'Accessibility regulations'),
  fact('regulatory.codes', 'regulatory', 'NBC / applicable codes'),
  fact('regulatory.authority', 'regulatory', 'Local authority requirements'),
  fact('regulatory.building-management', 'regulatory', 'Building management guidelines'),
  fact('regulatory.landlord-fitout', 'regulatory', 'Landlord fit-out guidelines'),
  fact('regulatory.working-hours', 'regulatory', 'Permissible working hours', 'e.g. 10 pm–6 am'),
  fact('regulatory.noise', 'regulatory', 'Noise restrictions'),
  fact('regulatory.material-movement', 'regulatory', 'Material movement restrictions'),
  fact('regulatory.lift-usage', 'regulatory', 'Lift usage restrictions'),
  fact('regulatory.debris', 'regulatory', 'Debris disposal rules'),
  fact('regulatory.signage', 'regulatory', 'Signage restrictions'),
  fact('regulatory.facade', 'regulatory', 'Façade restrictions'),
  fact('regulatory.wet-areas', 'regulatory', 'Wet-area restrictions'),
  fact('regulatory.structural', 'regulatory', 'Structural modification restrictions'),
  fact('regulatory.core-drilling', 'regulatory', 'Core drilling restrictions'),
  fact('regulatory.ceiling-slab', 'regulatory', 'Ceiling / slab modification restrictions'),
];

/** The items placed on the plan: markers, lines and areas. */
export const PLAN_ITEMS = SITE_ITEMS.filter((i) => i.kind !== 'fact');

export function siteItem(key: string | undefined): SiteItemDef | undefined {
  return key ? SITE_ITEMS.find((i) => i.key === key) : undefined;
}

/** A new site analysis's checklist: every fact row, none checked yet. */
export function createSiteFacts(): SiteFact[] {
  return SITE_ITEMS.filter((i) => i.kind === 'fact').map((i) => ({ id: makeId('fact'), itemKey: i.key, category: i.category, label: i.label }));
}

export const SITE_STATUSES: { key: SiteStatus; label: string; color: string }[] = [
  { key: 'verified', label: 'Verified', color: '#16a34a' },
  { key: 'to-verify', label: 'To verify', color: '#d97706' },
  { key: 'not-available', label: 'Not available', color: '#dc2626' },
  { key: 'not-applicable', label: 'Not applicable', color: '#94a3b8' },
];

export function siteStatus(key: SiteStatus | undefined) {
  return key ? SITE_STATUSES.find((s) => s.key === key) : undefined;
}

/** A marker code for a name of your own: its initials, or the first two
 *  letters of a one-word name, up to three characters. */
export function codeFromLabel(label: string): string {
  const words = label.trim().split(/[\s/&-]+/).filter(Boolean);
  if (!words.length) return '?';
  const code = words.length === 1 ? words[0].slice(0, 2) : words.map((w) => w[0]).join('');
  return code.slice(0, 3).toUpperCase();
}
