import type { PlanGeometry } from '@/types/slide';
import type { Point } from './hotspotShape';

// ---------------------------------------------------------------------------
// Snapping a measurement pick onto a PDF plan's own geometry.
//
// Everything here works in the same 0-1 frame-normalised space as hotspots and
// calibration (see PlanGeometry) — the conversion happened once, at upload.
// ---------------------------------------------------------------------------

export type SnapKind = 'vertex' | 'edge';

export interface SnapResult {
  point: Point;
  kind: SnapKind;
  /** The full segment this point was snapped onto, in true frame space —
   *  only present when kind === 'edge', so the UI can highlight the whole
   *  line being snapped to rather than just the point on it. */
  segment?: { x1: number; y1: number; x2: number; y2: number };
}

/** A uniform grid over the frame. A plan's lines are spread across the whole
 *  drawing rather than clustered, so a plain hash grid beats a tree here: it
 *  builds in one pass and every query touches a fixed handful of cells.
 *
 *  The frame is 16:9, not square, so a raw y-unit and a raw x-unit are NOT the
 *  same number of screen pixels — 1 raw y-unit is worth fewer pixels than 1
 *  raw x-unit whenever `aspect` (width/height) is above 1. The grid is keyed,
 *  and every distance below is computed, in **x-equivalent units**: y is
 *  always divided by `aspect` first, exactly the correction
 *  `planOverlay.ts`'s `realDistance` already applies for real-world distance.
 *  Skipping this made an on-screen circle of "equal" radius read as an oval —
 *  fine near the frame's own diagonal, silently short in the vertical
 *  direction, so a click could miss a corner or land on the wrong wall by a
 *  margin that grows with the frame's own aspect ratio. */
export interface SnapIndex {
  cell: number;
  aspect: number;
  vertices: Map<number, number[]>;
  segments: Map<number, number[]>;
  raw: PlanGeometry;
  count: number;
}

/** Cells about this size (in x-equivalent units) keep a typical plan at a few
 *  items per cell. */
const CELL = 0.02;

function key(cx: number, cy: number): number {
  // One integer key rather than a string: this runs per pointermove.
  return cx * 4096 + cy;
}

function cellOfX(x: number): number {
  return Math.floor(x / CELL);
}

/** Cells are sized in x-equivalent units, so a y-coordinate is converted
 *  before it is bucketed — otherwise a cell would cover a different number of
 *  pixels depending on which axis it measured. */
function cellOfY(y: number, aspect: number): number {
  return Math.floor(y / aspect / CELL);
}

export function buildSnapIndex(geometry: PlanGeometry | undefined, aspect: number): SnapIndex | null {
  if (!geometry || (!geometry.vertices.length && !geometry.segments.length)) return null;

  const vertices = new Map<number, number[]>();
  for (let i = 0; i < geometry.vertices.length; i += 2) {
    const k = key(cellOfX(geometry.vertices[i]), cellOfY(geometry.vertices[i + 1], aspect));
    const bucket = vertices.get(k);
    if (bucket) bucket.push(i);
    else vertices.set(k, [i]);
  }

  // A segment is registered in every cell its bounding box touches, so a query
  // near the middle of a long wall still finds it.
  const segments = new Map<number, number[]>();
  for (let i = 0; i < geometry.segments.length; i += 4) {
    const x1 = geometry.segments[i];
    const y1 = geometry.segments[i + 1];
    const x2 = geometry.segments[i + 2];
    const y2 = geometry.segments[i + 3];
    const cx0 = cellOfX(Math.min(x1, x2));
    const cx1 = cellOfX(Math.max(x1, x2));
    const cy0 = cellOfY(Math.min(y1, y2), aspect);
    const cy1 = cellOfY(Math.max(y1, y2), aspect);
    for (let cx = cx0; cx <= cx1; cx++) {
      for (let cy = cy0; cy <= cy1; cy++) {
        const k = key(cx, cy);
        const bucket = segments.get(k);
        if (bucket) bucket.push(i);
        else segments.set(k, [i]);
      }
    }
  }

  return {
    cell: CELL,
    aspect,
    vertices,
    segments,
    raw: geometry,
    count: geometry.vertices.length / 2,
  };
}

/** Nearest point on segment ab to p, clamped to the segment. All three points
 *  are in x-equivalent space (see the module note) — the caller stretches
 *  coordinates in and un-stretches the result back to true frame space, so the
 *  projection itself can stay ordinary isotropic geometry. */
function projectOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): Point {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return { x: ax, y: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return { x: ax + t * dx, y: ay + t * dy };
}

/** Finds the best snap target within `radius` of `p`, or null.
 *
 *  **Vertices beat edges**, not merely by distance: a corner is what someone
 *  aims at when measuring a room, and a wall's own edge passes within a hair
 *  of its corner, so nearest-wins would make corners nearly unselectable.
 *  Falling through to the nearest point along a segment covers measuring
 *  across a wall face, where there is no corner to aim at.
 *
 *  `radius` is in x-equivalent frame-normalised units (see the module note on
 *  `SnapIndex`) and must already be corrected for viewer zoom by the caller —
 *  snapping should not get coarser the further you zoom in, which is exactly
 *  when precision is wanted. */
export function snapTo(index: SnapIndex | null, p: Point, radius: number): SnapResult | null {
  if (!index) return null;
  const { raw, aspect } = index;
  const reachX = Math.max(1, Math.ceil(radius / index.cell));
  const cx = cellOfX(p.x);
  const cy = cellOfY(p.y, aspect);
  const radiusSq = radius * radius;
  const py = p.y / aspect;

  let bestVertex: Point | null = null;
  let bestVertexDist = radiusSq;
  let bestEdge: Point | null = null;
  let bestEdgeDist = radiusSq;
  let bestEdgeSegment: { x1: number; y1: number; x2: number; y2: number } | null = null;

  for (let ix = cx - reachX; ix <= cx + reachX; ix++) {
    for (let iy = cy - reachX; iy <= cy + reachX; iy++) {
      const k = key(ix, iy);

      const vs = index.vertices.get(k);
      if (vs) {
        for (const i of vs) {
          const dx = raw.vertices[i] - p.x;
          const dy = raw.vertices[i + 1] / aspect - py;
          const d = dx * dx + dy * dy;
          if (d < bestVertexDist) {
            bestVertexDist = d;
            bestVertex = { x: raw.vertices[i], y: raw.vertices[i + 1] };
          }
        }
      }

      const ss = index.segments.get(k);
      if (ss) {
        for (const i of ss) {
          const q = projectOnSegment(
            p.x, py,
            raw.segments[i], raw.segments[i + 1] / aspect,
            raw.segments[i + 2], raw.segments[i + 3] / aspect,
          );
          const dx = q.x - p.x;
          const dy = q.y - py;
          const d = dx * dx + dy * dy;
          if (d < bestEdgeDist) {
            bestEdgeDist = d;
            // q.y is in x-equivalent space (divided by aspect) — undo that
            // before handing the point back, so it lands in true frame space.
            bestEdge = { x: q.x, y: q.y * aspect };
            // raw.segments[i..i+3] are already true frame-space coordinates
            // (only the *comparison* above works in x-equivalent space) — no
            // aspect-undoing needed here, unlike bestEdge's point.
            bestEdgeSegment = { x1: raw.segments[i], y1: raw.segments[i + 1], x2: raw.segments[i + 2], y2: raw.segments[i + 3] };
          }
        }
      }
    }
  }

  if (bestVertex) return { point: bestVertex, kind: 'vertex' };
  if (bestEdge) return { point: bestEdge, kind: 'edge', segment: bestEdgeSegment! };
  return null;
}
