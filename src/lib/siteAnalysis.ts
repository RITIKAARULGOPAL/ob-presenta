import { makeId } from './id';
import { createSiteFacts } from './siteChecklist';
import type { LinkedView, LinkedViewStage, PlanAnnotation, PlanLineStyle, SiteAnalysis, SiteCategoryKey, SiteFact } from '@/types/slide';

// A Site analysis stage's content (S2) as pure functions over one view, in
// the same style as linkedViewStages.ts: every caller goes through the
// store's updateLinkedView, which hands these the view fresh from the deck.
// Each one returns the view itself, unchanged, when nothing actually
// changes, so a no-op edit (a blur with the same text, say) never costs an
// Undo step or a save.

export const SITE_ANALYSIS_LABEL = 'Site analysis';

const norm = (label: string) => label.trim().toLowerCase();

/** The view's Site analysis stage, if it has one. There's at most one. */
export function siteStageOf(view: LinkedView | undefined): LinkedViewStage | undefined {
  return view?.stages?.find((s) => s.siteAnalysis);
}

/** A stage named "Site analysis" without the site content: one added from
 *  the stage picker before S2. Only while the view has no site stage yet. */
export function canSetUpSiteAnalysis(view: LinkedView, stage: LinkedViewStage | undefined): boolean {
  return !!stage && view.kind === 'layout' && !stage.siteAnalysis && norm(stage.label) === norm(SITE_ANALYSIS_LABEL) && !siteStageOf(view);
}

export function createSiteAnalysis(): SiteAnalysis {
  return { entries: [], facts: createSiteFacts() };
}

export function setUpSiteAnalysis(view: LinkedView, stageId: string): LinkedView {
  if (siteStageOf(view) || !view.stages?.some((s) => s.id === stageId)) return view;
  return { ...view, stages: view.stages.map((s) => (s.id === stageId ? { ...s, siteAnalysis: createSiteAnalysis() } : s)) };
}

/** Turns the stage back into an ordinary one, deleting its entries and
 *  checklist. */
export function removeSiteAnalysis(view: LinkedView, stageId: string): LinkedView {
  if (!view.stages?.some((s) => s.id === stageId && s.siteAnalysis)) return view;
  return {
    ...view,
    stages: view.stages.map((s) => {
      if (s.id !== stageId) return s;
      const rest = { ...s };
      delete rest.siteAnalysis;
      return rest;
    }),
  };
}

function withSite(view: LinkedView, stageId: string, update: (site: SiteAnalysis) => SiteAnalysis): LinkedView {
  const stage = view.stages?.find((s) => s.id === stageId);
  if (!stage?.siteAnalysis) return view;
  const next = update(stage.siteAnalysis);
  if (next === stage.siteAnalysis) return view;
  return { ...view, stages: view.stages!.map((s) => (s.id === stageId ? { ...s, siteAnalysis: next } : s)) };
}

function samePoints(a: { x: number; y: number }[], b: { x: number; y: number }[]): boolean {
  return a.length === b.length && a.every((p, i) => p.x === b[i].x && p.y === b[i].y);
}

/** Whether applying `patch` to `item` would change anything. Blank text
 *  counts as unset, so clearing an already-empty field is a no-op too. */
function changes<T extends object>(item: T, patch: Partial<T>): boolean {
  return (Object.keys(patch) as (keyof T)[]).some((key) => {
    const before = item[key];
    const after = patch[key];
    if (Array.isArray(before) && Array.isArray(after)) return !samePoints(before, after);
    const blank = (v: unknown) => v === undefined || v === '';
    if (blank(before) && blank(after)) return false;
    return before !== after;
  });
}

/** Text fields store trimmed text, or nothing: an empty value, note or code
 *  shouldn't sit in the deck as an empty string. */
function tidy<T extends Record<string, unknown>>(patch: T): T {
  const out: Record<string, unknown> = { ...patch };
  for (const key of ['value', 'note', 'code'] as const) {
    if (typeof out[key] === 'string') out[key] = (out[key] as string).trim() || undefined;
  }
  if (typeof out.label === 'string') out.label = (out.label as string).trim() || undefined;
  if (out.label === undefined && 'label' in patch) delete out.label; // a name can't be blanked
  return out as T;
}

/** What's picked to place on the plan: a checklist item or a name of your
 *  own. The store's SitePlacement adds the region shape used for areas. */
export interface PlacementSpec {
  itemKey?: string;
  kind: 'marker' | 'line' | 'area';
  category: SiteCategoryKey;
  label: string;
  code?: string;
  lineStyle?: PlanLineStyle;
  direction?: boolean;
}

export function entryFromPlacement(
  spec: PlacementSpec,
  points: { x: number; y: number }[],
  shape?: PlanAnnotation['shape'],
): PlanAnnotation {
  return {
    id: makeId('site'),
    kind: spec.kind,
    itemKey: spec.itemKey,
    category: spec.category,
    label: spec.label,
    ...(spec.kind === 'marker' ? { code: spec.code } : {}),
    ...(spec.kind === 'line' ? { lineStyle: spec.lineStyle ?? 'route' } : {}),
    ...(spec.kind === 'area' && shape && shape !== 'polygon' ? { shape } : {}),
    ...(spec.direction ? { directionDeg: 0 } : {}),
    points,
  };
}

export function addSiteEntry(view: LinkedView, stageId: string, entry: PlanAnnotation): LinkedView {
  return withSite(view, stageId, (site) => ({ ...site, entries: [...site.entries, entry] }));
}

export function updateSiteEntry(view: LinkedView, stageId: string, entryId: string, patch: Partial<Omit<PlanAnnotation, 'id'>>): LinkedView {
  const clean = tidy(patch);
  return withSite(view, stageId, (site) => {
    const entry = site.entries.find((e) => e.id === entryId);
    if (!entry || !changes(entry, clean)) return site;
    return { ...site, entries: site.entries.map((e) => (e.id === entryId ? { ...e, ...clean } : e)) };
  });
}

export function removeSiteEntry(view: LinkedView, stageId: string, entryId: string): LinkedView {
  return withSite(view, stageId, (site) =>
    site.entries.some((e) => e.id === entryId) ? { ...site, entries: site.entries.filter((e) => e.id !== entryId) } : site,
  );
}

/** Adds a checklist row: one of the checklist's own, back where it belongs
 *  in checklist order (`order` is the checklist's item keys), or a row of
 *  your own at the end of its category. */
export function addSiteFact(view: LinkedView, stageId: string, row: SiteFact, order: string[]): LinkedView {
  return withSite(view, stageId, (site) => {
    if (row.itemKey && site.facts.some((f) => f.itemKey === row.itemKey)) return site;
    const facts = [...site.facts];
    const rank = (f: SiteFact) => (f.itemKey ? order.indexOf(f.itemKey) : -1);
    const mine = rank(row);
    let at: number;
    if (mine >= 0) {
      at = facts.findIndex((f) => rank(f) > mine);
    } else {
      // After the last row of the same category.
      const last = facts.map((f) => f.category).lastIndexOf(row.category);
      at = last === -1 ? -1 : last + 1;
    }
    if (at === -1) facts.push(row);
    else facts.splice(at, 0, row);
    return { ...site, facts };
  });
}

export function updateSiteFact(view: LinkedView, stageId: string, factId: string, patch: Partial<Omit<SiteFact, 'id'>>): LinkedView {
  const clean = tidy(patch);
  return withSite(view, stageId, (site) => {
    const fact = site.facts.find((f) => f.id === factId);
    if (!fact || !changes(fact, clean)) return site;
    return { ...site, facts: site.facts.map((f) => (f.id === factId ? { ...f, ...clean } : f)) };
  });
}

export function removeSiteFact(view: LinkedView, stageId: string, factId: string): LinkedView {
  return withSite(view, stageId, (site) =>
    site.facts.some((f) => f.id === factId) ? { ...site, facts: site.facts.filter((f) => f.id !== factId) } : site,
  );
}

/** Where an entry's card or selection anchors: the marker's point, a line's
 *  middle, or an area's centre. */
export function entryAnchor(entry: PlanAnnotation): { x: number; y: number } {
  const pts = entry.points;
  if (entry.kind === 'marker' || pts.length === 1) return pts[0];
  if (entry.kind === 'line') {
    const mid = Math.floor((pts.length - 1) / 2);
    const a = pts[mid];
    const b = pts[mid + 1] ?? a;
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }
  if (entry.shape === 'ellipse' && pts.length === 2) return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  const n = pts.length;
  return { x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n };
}

/** A checklist row counts as recorded once anything is filled in. Presenter
 *  shows only those. */
export function factRecorded(f: SiteFact): boolean {
  return !!(f.value || f.note || f.status);
}
