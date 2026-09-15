import type { ImageTransform } from '@/types/slide';

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/** The furthest an axis can pan (as a fraction of the frame's own size)
 *  before the zoomed image would reveal empty space at that frame's edge. */
export function maxPan(zoom: number): number {
  return Math.max(0, zoom - 1) / 2;
}

export function clampTransform(t: ImageTransform): Required<ImageTransform> {
  const zoom = clamp(t.zoom ?? 1, MIN_ZOOM, MAX_ZOOM);
  const limit = maxPan(zoom);
  return {
    zoom,
    panX: clamp(t.panX ?? 0, -limit, limit),
    panY: clamp(t.panY ?? 0, -limit, limit),
    rotation: ((t.rotation ?? 0) + 540) % 360 - 180,
    opacity: clamp(t.opacity ?? 1, 0, 1),
  };
}

/** True once any axis differs from the untouched default, so callers can
 *  decide whether there's anything worth offering to reset. */
export function isTransformed(t?: ImageTransform): boolean {
  if (!t) return false;
  const c = clampTransform(t);
  return c.zoom !== 1 || c.panX !== 0 || c.panY !== 0 || c.rotation !== 0 || c.opacity !== 1;
}

/** The inline style for the <img>/<video> itself — the frame around it stays
 *  a plain overflow-hidden box, untouched by any of this. */
export function imageStyle(t?: ImageTransform): React.CSSProperties {
  const c = clampTransform(t ?? {});
  return {
    opacity: c.opacity,
    transform: `translate(${c.panX * 100}%, ${c.panY * 100}%) rotate(${c.rotation}deg) scale(${c.zoom})`,
    transformOrigin: 'center',
  };
}
