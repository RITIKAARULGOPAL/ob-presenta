import { makeId } from './id';
import type { LinkedView, ViewHotspot } from '@/types/slide';

// Adding, renaming, reordering and deleting a Linked View's stages (S1, F8),
// as pure functions over one view. Both the stage timeline on the slide and
// the Stages list in the Properties panel go through these, via the store's
// updateLinkedView, which hands them the view fresh from the deck: a stage
// list captured in some earlier render is how a North drag once undid a
// rename (B16).

/** The stages a floor plan usually goes through, in the order they're
 *  presented. Every one is optional (S1): "+ Stage" offers these to tick,
 *  and any name can be added alongside them. */
export const SUGGESTED_PLAN_STAGES = [
  'Site analysis',
  'Zoning',
  'Walls',
  'Circulation',
  'Furniture',
  'Design consideration',
] as const;

const norm = (label: string) => label.trim().toLowerCase();

/** Where a label sits in SUGGESTED_PLAN_STAGES, or -1 for a custom name. */
export function suggestedRank(label: string): number {
  return SUGGESTED_PLAN_STAGES.findIndex((s) => norm(s) === norm(label));
}

/** Adds stages in the order given. A suggested stage slots in before the
 *  first existing stage that comes after it in the usual order, so ticking
 *  "Walls" on a Zoning/Furniture plan lands between the two; a custom name
 *  goes at the end. A suggested stage the view already has is skipped.
 *  Returns the view unchanged (same object) when nothing was added. */
export function addStages(view: LinkedView, labels: string[]): { view: LinkedView; added: string[] } {
  const stages = [...(view.stages ?? [])];
  const added: string[] = [];
  for (const raw of labels) {
    const label = raw.trim();
    if (!label) continue;
    const rank = suggestedRank(label);
    if (rank >= 0 && stages.some((s) => norm(s.label) === norm(label))) continue;
    const stage = { id: makeId('stage'), label };
    const at = rank >= 0 ? stages.findIndex((s) => suggestedRank(s.label) > rank) : -1;
    if (at === -1) stages.push(stage);
    else stages.splice(at, 0, stage);
    added.push(stage.id);
  }
  return added.length ? { view: { ...view, stages }, added } : { view, added };
}

export function renameStage(view: LinkedView, stageId: string, label: string): LinkedView {
  const next = label.trim();
  const current = view.stages?.find((s) => s.id === stageId);
  if (!next || !current || current.label === next) return view;
  return { ...view, stages: view.stages!.map((s) => (s.id === stageId ? { ...s, label: next } : s)) };
}

/** One place earlier (-1) or later (+1). Order is what the timeline and the
 *  stage pills show, and the order a presenter steps through. */
export function moveStage(view: LinkedView, stageId: string, delta: -1 | 1): LinkedView {
  const stages = [...(view.stages ?? [])];
  const from = stages.findIndex((s) => s.id === stageId);
  const to = from + delta;
  if (from === -1 || to < 0 || to >= stages.length) return view;
  [stages[from], stages[to]] = [stages[to], stages[from]];
  return { ...view, stages };
}

/** Regions that show on this stage and no other, counting only stages that
 *  still exist. These are what deleting the stage would take with it unless
 *  they're carried somewhere. A region with no stage list shows on every
 *  stage, so it never counts. */
export function regionsOnlyOn(view: LinkedView, stageId: string): ViewHotspot[] {
  const existing = new Set((view.stages ?? []).map((s) => s.id));
  return (view.hotspots ?? []).filter((h) => {
    const live = h.stageIds?.filter((id) => existing.has(id));
    return live?.length === 1 && live[0] === stageId;
  });
}

/** Removes regions along with every reference to them: other regions'
 *  adjacency lists and parent zone, and the seating table's row links.
 *  Otherwise a deleted space leaves ids behind that silently never
 *  highlight, burst or connect again. */
export function removeRegions(view: LinkedView, ids: ReadonlySet<string>): LinkedView {
  if (!ids.size) return view;
  return {
    ...view,
    hotspots: (view.hotspots ?? [])
      .filter((h) => !ids.has(h.id))
      .map((h) => {
        const adjacentHotspotIds = h.adjacentHotspotIds?.some((id) => ids.has(id))
          ? h.adjacentHotspotIds.filter((id) => !ids.has(id))
          : h.adjacentHotspotIds;
        const parentHotspotId = h.parentHotspotId && ids.has(h.parentHotspotId) ? undefined : h.parentHotspotId;
        if (adjacentHotspotIds === h.adjacentHotspotIds && parentHotspotId === h.parentHotspotId) return h;
        return { ...h, adjacentHotspotIds: adjacentHotspotIds?.length ? adjacentHotspotIds : undefined, parentHotspotId };
      }),
    seatingZones: view.seatingZones?.map((z) => ({
      ...z,
      rows: z.rows.map((r) => (r.hotspotIds?.some((id) => ids.has(id)) ? { ...r, hotspotIds: r.hotspotIds.filter((id) => !ids.has(id)) } : r)),
    })),
  };
}

/** What happens to the regions that are only on a stage being deleted: carry
 *  them to the stages listed (on the plan itself when no stages remain), or
 *  delete them. The person deleting the stage chooses, in the dialog. */
export type StageRegionFate = { carryTo: string[] } | 'delete';

/** Deletes a stage. Its own plan image, scale and north angle go with it,
 *  except when it's the last stage and the view has no image of its own:
 *  then its image becomes the view's, so the plan doesn't go blank. Regions
 *  shared with other stages just drop this one from their list; regions only
 *  on it follow `fate`. A carried region keeps the outline it had on the
 *  deleted stage. */
export function deleteStage(view: LinkedView, stageId: string, fate: StageRegionFate): LinkedView {
  const stages = view.stages ?? [];
  const gone = stages.find((s) => s.id === stageId);
  if (!gone) return view;
  const remaining = stages.filter((s) => s.id !== stageId);
  const remainingIds = new Set(remaining.map((s) => s.id));
  const only = new Set(regionsOnlyOn(view, stageId).map((h) => h.id));
  const carryTo = fate === 'delete' ? [] : fate.carryTo.filter((id) => remainingIds.has(id));

  let next: LinkedView = {
    ...view,
    stages: remaining.length ? remaining : undefined,
    hotspots: (view.hotspots ?? []).map((h) => {
      const ownShape = h.pointsByStage?.[stageId];
      let out = h;
      if (ownShape) {
        const rest = Object.fromEntries(Object.entries(h.pointsByStage!).filter(([id]) => id !== stageId));
        out = { ...out, pointsByStage: Object.keys(rest).length ? rest : undefined };
      }
      if (only.has(h.id)) {
        // No stage list means every stage, which is also what an empty carry
        // falls back to: never an empty list that would hide it everywhere.
        return { ...out, points: ownShape ?? out.points, stageIds: carryTo.length ? carryTo : undefined };
      }
      if (h.stageIds?.includes(stageId)) {
        const ids = h.stageIds.filter((id) => id !== stageId);
        out = { ...out, stageIds: ids.length ? ids : undefined };
      }
      return out;
    }),
  };

  if (fate === 'delete') next = removeRegions(next, only);
  if (!remaining.length && gone.url && !view.url) {
    next = {
      ...next,
      url: gone.url,
      transform: gone.transform,
      calibration: gone.calibration,
      geometry: gone.geometry,
      isPdfPlan: gone.isPdfPlan,
      northDeg: gone.northDeg,
      northLocked: gone.northLocked,
      calibrationLocked: gone.calibrationLocked,
    };
  }
  return next;
}
