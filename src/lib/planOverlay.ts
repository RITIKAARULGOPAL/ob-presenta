import type { PlanCalibration } from '@/types/slide';
import type { Point } from './hotspotShape';

// ---------------------------------------------------------------------------
// Maths and colour for the Layout view's overlay modes (Zoning, Adjacency,
// Dimensions). Kept out of SlideRenderer.tsx because none of it needs React,
// and because the distance/area conversions are the one part of this feature
// that is genuinely easy to get subtly wrong.
// ---------------------------------------------------------------------------

/** Zone fills are derived from the zone's own name rather than picked per
 *  project: two spaces typed "Meeting" always land on the same colour, in
 *  this deck and the next one, with nothing to configure and nothing to keep
 *  in sync. Deliberately not the deck's accent — a zoning diagram needs
 *  several distinguishable hues at once, which one accent can't give. */
const ZONE_COLORS = [
  '#0b72c2',
  '#e07b1b',
  '#2f9e6b',
  '#a4479b',
  '#c0392b',
  '#1f8a9c',
  '#8a6d1f',
  '#5a5fd0',
];

export function zoneColor(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) hash = (hash * 31 + category.charCodeAt(i)) | 0;
  return ZONE_COLORS[Math.abs(hash) % ZONE_COLORS.length];
}

/** Hotspot coordinates are normalised 0–1 against the frame, and the frame is
 *  wider than it is tall, so a normalised step sideways covers more real
 *  ground than the same step downwards. Every conversion below therefore
 *  needs the frame's pixel aspect ratio (width / height) alongside the
 *  calibration — that pairing is what makes a measurement independent of how
 *  large the plan happens to be rendered. */
export function realDistance(a: Point, b: Point, aspect: number, cal: PlanCalibration): number {
  const dx = (b.x - a.x) * cal.unitsPerWidth;
  const dy = ((b.y - a.y) * cal.unitsPerWidth) / aspect;
  return Math.hypot(dx, dy);
}

/** `areaNorm` comes from shapeArea() — a fraction of the frame's own box. */
export function realArea(areaNorm: number, aspect: number, cal: PlanCalibration): number {
  return (areaNorm * cal.unitsPerWidth * cal.unitsPerWidth) / aspect;
}

/** Inverse of realDistance: the user clicked two points and told us how far
 *  apart they are in the real world. Returns null for a degenerate pick (the
 *  same point twice, or a non-positive distance), so the caller can keep the
 *  previous calibration rather than storing an Infinity. */
export function calibrationFrom(
  a: Point,
  b: Point,
  aspect: number,
  distance: number,
  unit: string,
): PlanCalibration | null {
  if (!(distance > 0)) return null;
  const spanInWidths = Math.hypot(b.x - a.x, (b.y - a.y) / aspect);
  if (spanInWidths < 1e-6) return null;
  return { unitsPerWidth: distance / spanInWidths, unit };
}

/** Two significant-ish decimals below 10, one above, none past 100 — a plan
 *  measured to the centimetre reads as noise at room scale. */
export function formatMeasure(value: number, unit: string): string {
  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${unit}`;
}

export function formatArea(value: number, unit: string): string {
  const decimals = value < 10 ? 2 : value < 100 ? 1 : 0;
  return `${value.toFixed(decimals)} ${unit}²`;
}
