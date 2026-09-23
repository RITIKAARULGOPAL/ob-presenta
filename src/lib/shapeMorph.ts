import type { Point } from './hotspotShape';

// Morphing two independently hand-drawn polygons for "the same room" across
// two plan-evolution phases (Zoning's rough blob -> Walls' precise
// rectangle, say). This is genuinely harder than Sidvin's own reference
// morph, which only ever resamples a perfect circle to arc-length-match one
// fixed hand-authored destination — here *both* sides are arbitrary, so
// vertex-count resampling, winding-direction alignment, and a best-fit
// rotation offset all have to be solved together, not just interpolated
// index-to-index. A naive index-to-index lerp between very different
// aspect ratios/concavity can self-intersect into a momentary "bowtie" mid
// -morph frame — a known limitation of per-vertex lerp, not solved here.

const MORPH_VERTEX_COUNT = 24;

function polygonPerimeter(points: Point[]): number[] {
  // Cumulative arc length at the START of each edge i -> i+1 (mod n),
  // length n+1 so the last entry is the whole perimeter.
  const cumulative = [0];
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    cumulative.push(cumulative[i] + Math.hypot(b.x - a.x, b.y - a.y));
  }
  return cumulative;
}

function signedArea(points: Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Resamples a closed polygon to exactly `count` vertices, evenly spaced by
 *  arc length around its perimeter — so two differently-drawn shapes end up
 *  with a matching, evenly-distributed point count to interpolate between,
 *  instead of lerping mismatched original vertices index-to-index. */
export function resamplePolygon(points: Point[], count: number): Point[] {
  const n = points.length;
  if (n === 0) return [];
  if (n === 1) return Array.from({ length: count }, () => points[0]);

  const cumulative = polygonPerimeter(points);
  const perimeter = cumulative[n];
  if (perimeter === 0) return Array.from({ length: count }, () => points[0]);

  const out: Point[] = [];
  for (let i = 0; i < count; i++) {
    const target = (perimeter * i) / count;
    let edge = 0;
    while (edge < n - 1 && cumulative[edge + 1] < target) edge++;
    const a = points[edge];
    const b = points[(edge + 1) % n];
    const edgeLen = cumulative[edge + 1] - cumulative[edge];
    const t = edgeLen > 0 ? (target - cumulative[edge]) / edgeLen : 0;
    out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  }
  return out;
}

/** Reverses `points` if its winding direction differs from `reference`'s, so
 *  index-to-index interpolation moves consistently around the shape instead
 *  of two polygons winding opposite ways and twisting through each other. */
export function alignWinding(reference: Point[], points: Point[]): Point[] {
  const refCW = signedArea(reference) < 0;
  const ptsCW = signedArea(points) < 0;
  return refCW === ptsCW ? points : [...points].reverse();
}

function rotateStart<T>(arr: T[], offset: number): T[] {
  return arr.map((_, i) => arr[(i + offset) % arr.length]);
}

function totalSquaredDistance(a: Point[], b: Point[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const dx = a[i].x - b[i].x;
    const dy = a[i].y - b[i].y;
    sum += dx * dx + dy * dy;
  }
  return sum;
}

/** Finds the cyclic rotation offset of `points` that best lines its
 *  vertices up against `reference`'s, index-to-index — two independently
 *  hand-drawn polygons for the same room don't necessarily start their
 *  point arrays at "corresponding" corners, so interpolating raw index
 *  0-to-0 can twist the whole shape through itself mid-morph. Brute force
 *  over all `n` offsets is fine at this vertex count and is only ever run
 *  once per stage transition, not per animation frame. */
export function bestRotationOffset(reference: Point[], points: Point[]): number {
  let bestOffset = 0;
  let bestDist = Infinity;
  for (let offset = 0; offset < points.length; offset++) {
    const dist = totalSquaredDistance(reference, rotateStart(points, offset));
    if (dist < bestDist) {
      bestDist = dist;
      bestOffset = offset;
    }
  }
  return bestOffset;
}

/** Interpolates between two arbitrary closed polygons at `t` in [0,1] — `t
 *  <= 0` is equivalent to `from`, `t >= 1` to `to`. Resamples both to a
 *  shared vertex count, aligns winding, and searches once for the
 *  least-distorted rotation offset, so a mid-morph frame reads as one shape
 *  reshaping into another. Degenerate input (fewer than 3 points on either
 *  side) falls back to a hard cut at t = 0.5 rather than crashing. */
export function morphShapes(from: Point[], to: Point[], t: number): Point[] {
  if (t <= 0) return from;
  if (t >= 1) return to;
  if (from.length < 3 || to.length < 3) return t < 0.5 ? from : to;

  const count = Math.max(MORPH_VERTEX_COUNT, from.length, to.length);
  const a = resamplePolygon(from, count);
  const bAligned = alignWinding(a, resamplePolygon(to, count));
  const b = rotateStart(bAligned, bestRotationOffset(a, bAligned));

  return a.map((p, i) => ({
    x: p.x + (b[i].x - p.x) * t,
    y: p.y + (b[i].y - p.y) * t,
  }));
}
