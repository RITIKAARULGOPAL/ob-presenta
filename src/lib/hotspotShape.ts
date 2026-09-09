// Geometry for drawn regions on a Linked-Views image.
//
// Points are normalised 0–1 against the image box, so a region survives the
// image being displayed at any size. The SVG overlay uses a 0–100 viewBox with
// preserveAspectRatio="none", so everything here works in that same stretched
// space — consistent with how the original polygon hotspots were stored.

export type Point = { x: number; y: number };

/** How the stored points become an outline. Absent means polygon, which is
 *  what every hotspot created before this existed is.
 *
 *  'ellipse' stores exactly two points — opposite corners of the drag — and
 *  'spline' is kept for regions traced with the old freehand tool, which no
 *  longer exists but whose output still has to render. */
export type ShapeKind = 'polygon' | 'spline' | 'ellipse';

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

/** An ellipse inscribed in the box the drag defined, as two arcs. Exact rather
 *  than an approximation in Béziers, and only two points to store. */
function ellipsePath(a: Point, b: Point): string {
  const rx = (Math.abs(b.x - a.x) / 2) * S;
  const ry = (Math.abs(b.y - a.y) / 2) * S;
  if (rx <= 0 || ry <= 0) return '';
  const cx = ((a.x + b.x) / 2) * S;
  const cy = ((a.y + b.y) / 2) * S;
  return (
    `M ${fmt(cx - rx)} ${fmt(cy)} ` +
    `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx + rx)} ${fmt(cy)} ` +
    `A ${fmt(rx)} ${fmt(ry)} 0 1 0 ${fmt(cx - rx)} ${fmt(cy)} Z`
  );
}

/** Whether a stored region has enough points to draw. Ellipses need two; the
 *  outline shapes need three. */
export function hasEnoughPoints(points: Point[] | null | undefined, shape?: ShapeKind): boolean {
  if (!points) return false;
  return points.length >= (shape === 'ellipse' ? 2 : 3);
}

/** The `d` for a stored region. */
export function shapePath(points: Point[], shape?: ShapeKind): string {
  if (!points || points.length < 2) return '';
  if (shape === 'ellipse') return ellipsePath(points[0], points[1]);
  return shape === 'spline' ? splinePath(points, true) : polygonPath(points);
}

/** Open preview path while still drawing — no Z, so it reads as unfinished. */
export function previewPath(points: Point[], shape?: ShapeKind): string {
  if (!points || points.length < 2) return '';
  if (shape === 'ellipse') return ellipsePath(points[0], points[1]);
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

/** Snaps a segment's direction to a multiple of `stepDeg`, holding Shift.
 *
 * The maths runs in display space, not normalised space. Points are stored 0–1
 * against a 16:9 box, so a 45° line in normalised units renders at about 29° on
 * screen and "horizontal" is the only angle that happens to survive. `aspect`
 * is the box's width/height, which puts the constraint back where the eye
 * expects it. The point follows the cursor's projection onto the chosen axis,
 * rather than jumping to a fixed radius, so it still tracks the hand.
 */
export function snapAngle(from: Point, to: Point, aspect: number, stepDeg = 45): Point {
  const dx = (to.x - from.x) * aspect;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return to;

  const step = (Math.PI * stepDeg) / 180;
  const angle = Math.round(Math.atan2(dy, dx) / step) * step;
  const ux = Math.cos(angle);
  const uy = Math.sin(angle);

  // Shorten along the locked axis to stay in bounds. Clamping x and y
  // separately would pull the point off the axis and quietly bend the angle,
  // which is the whole thing the constraint is meant to prevent.
  const along = Math.max(0, Math.min(dx * ux + dy * uy, roomAlong(from, ux, uy, aspect)));

  return { x: from.x + (ux * along) / aspect, y: from.y + uy * along };
}

/** How far a unit direction can travel from `from` before leaving the box,
 *  measured in the same display units the constraints work in. */
function roomAlong(from: Point, ux: number, uy: number, aspect: number): number {
  const limits: number[] = [];
  if (ux > 0) limits.push(((1 - from.x) * aspect) / ux);
  else if (ux < 0) limits.push((from.x * aspect) / -ux);
  if (uy > 0) limits.push((1 - from.y) / uy);
  else if (uy < 0) limits.push(from.y / -uy);
  return limits.length ? Math.min(...limits) : 0;
}

/** Shift on the rectangle tool: a square as drawn, which in normalised
 *  coordinates over a 16:9 box is not an equal delta on both axes. */
export function squareFrom(from: Point, to: Point, aspect: number): Point {
  const dx = (to.x - from.x) * aspect;
  const dy = to.y - from.y;
  const sx = dx < 0 ? -1 : 1;
  const sy = dy < 0 ? -1 : 1;

  // Shrink to fit rather than clamp per axis — clamping one side turns the
  // square back into a rectangle, which is what it was asked not to be.
  const roomX = sx > 0 ? (1 - from.x) * aspect : from.x * aspect;
  const roomY = sy > 0 ? 1 - from.y : from.y;
  const side = Math.min(Math.max(Math.abs(dx), Math.abs(dy)), roomX, roomY);

  return { x: from.x + (sx * side) / aspect, y: from.y + sy * side };
}
