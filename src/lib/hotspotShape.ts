// Geometry for drawn regions on a Linked-Views image.
//
// Points are normalised 0–1 against the image box, so a region survives the
// image being displayed at any size. The SVG overlay uses a 0–100 viewBox with
// preserveAspectRatio="none", so everything here works in that same stretched
// space — consistent with how the original polygon hotspots were stored.

export type Point = { x: number; y: number };

/** How the space between stored points is drawn. Absent means polygon, which
 *  is what every hotspot created before this existed is. */
export type ShapeKind = 'polygon' | 'spline';

const S = 100; // normalised → viewBox units

function fmt(n: number): string {
  return (Math.round(n * 1000) / 1000).toString();
}

/** The four corners of a drag, in order, so a rectangle is just a polygon and
 *  needs no separate storage or render path. */
export function rectPoints(a: Point, b: Point): Point[] {
  return [
    { x: a.x, y: a.y },
    { x: b.x, y: a.y },
    { x: b.x, y: b.y },
    { x: a.x, y: b.y },
  ];
}

/** Straight-edged closed path. */
function polygonPath(points: Point[]): string {
  const [first, ...rest] = points;
  return (
    `M ${fmt(first.x * S)} ${fmt(first.y * S)} ` +
    rest.map((p) => `L ${fmt(p.x * S)} ${fmt(p.y * S)}`).join(' ') +
    ' Z'
  );
}

/** A closed Catmull-Rom spline through every point, converted to cubic Béziers.
 *
 * Catmull-Rom because it *interpolates* — the curve passes through the points
 * the user actually placed, which is what you want when tracing a zone on a
 * plan. A B-spline would only approximate them and drift off the traced edge.
 * Tension 1/6 is the standard uniform conversion to Bézier control points. */
function splinePath(points: Point[], closed = true): string {
  const n = points.length;
  if (n < 3) return polygonPath(points);

  const at = (i: number): Point => {
    if (closed) return points[(i + n) % n];
    return points[Math.max(0, Math.min(n - 1, i))];
  };

  let d = `M ${fmt(at(0).x * S)} ${fmt(at(0).y * S)}`;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${fmt(c1.x * S)} ${fmt(c1.y * S)}, ${fmt(c2.x * S)} ${fmt(c2.y * S)}, ${fmt(p2.x * S)} ${fmt(p2.y * S)}`;
  }
  return closed ? `${d} Z` : d;
}

/** The `d` for a stored region. */
export function shapePath(points: Point[], shape?: ShapeKind): string {
  if (!points || points.length < 2) return '';
  return shape === 'spline' ? splinePath(points, true) : polygonPath(points);
}

/** Open preview path while still drawing — no Z, so it reads as unfinished. */
export function previewPath(points: Point[], shape?: ShapeKind): string {
  if (!points || points.length < 2) return '';
  if (shape === 'spline' && points.length >= 3) return splinePath(points, false);
  const [first, ...rest] = points;
  return `M ${fmt(first.x * S)} ${fmt(first.y * S)} ` + rest.map((p) => `L ${fmt(p.x * S)} ${fmt(p.y * S)}`).join(' ');
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Drops a point that lands on top of the previous one. A stray double-click
 *  used to add a duplicate vertex, which put a kink in the outline. */
export function isTooClose(points: Point[], candidate: Point, min = 0.008): boolean {
  const prev = points[points.length - 1];
  return !!prev && distance(prev, candidate) < min;
}

/** Ramer–Douglas–Peucker. A freehand drag samples far more points than the
 *  shape needs; thinning them before storing keeps the row small and stops the
 *  spline from wobbling between near-identical samples. */
export function simplify(points: Point[], tolerance = 0.006): Point[] {
  if (points.length < 3) return points;

  const perpendicular = (p: Point, a: Point, b: Point): number => {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len = Math.hypot(dx, dy);
    if (len === 0) return distance(p, a);
    return Math.abs((p.x - a.x) * dy - (p.y - a.y) * dx) / len;
  };

  const keep = new Array<boolean>(points.length).fill(false);
  keep[0] = true;
  keep[points.length - 1] = true;

  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [from, to] = stack.pop()!;
    let worst = 0;
    let index = -1;
    for (let i = from + 1; i < to; i++) {
      const dist = perpendicular(points[i], points[from], points[to]);
      if (dist > worst) {
        worst = dist;
        index = i;
      }
    }
    if (index >= 0 && worst > tolerance) {
      keep[index] = true;
      stack.push([from, index], [index, to]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

/** Keeps a drawn point inside the image. */
export function clamp01(p: Point): Point {
  return { x: Math.min(1, Math.max(0, p.x)), y: Math.min(1, Math.max(0, p.y)) };
}

/** Centroid, for placing the target picker over the finished shape. */
export function centroidOf(points: Point[]): Point | null {
  if (!points.length) return null;
  return {
    x: points.reduce((s, p) => s + p.x, 0) / points.length,
    y: points.reduce((s, p) => s + p.y, 0) / points.length,
  };
}
