'use client';

import { useRef, useState } from 'react';
import { shapePath } from '@/lib/hotspotShape';
import { siteCategory, siteStatus } from '@/lib/siteChecklist';
import type { PlanAnnotation, PlanLineStyle } from '@/types/slide';

type Point = { x: number; y: number };

// A Site analysis stage's markers, lines and areas (S2), drawn over the plan.
//
// Lines and areas go in their own SVG with a 1600×900 box. The plan frame is
// always 16:9, so that box maps evenly and dashes and arrowheads keep their
// shape, which they wouldn't in the hotspot layer's stretched 100×100 box.
// It still uses preserveAspectRatio="none", so for the moment before the
// frame's fitted size lands it lines up with the hotspots and the pointer
// maths, which assume the frame's own box. Markers and grid labels are HTML,
// like the plan's other labels, so they stay round at any frame size.

const W = 1600;
const H = 900;

const LINE: Record<PlanLineStyle, { width: number; dash?: string; cap: 'round' | 'butt' | 'square' }> = {
  route: { width: 5, cap: 'round' },
  dashed: { width: 4, dash: '16 10', cap: 'butt' },
  wall: { width: 10, cap: 'square' },
  grid: { width: 2.5, dash: '28 8 4 8', cap: 'butt' },
};

const toUnits = (p: Point) => ({ x: p.x * W, y: p.y * H });

function lineD(points: Point[]): string {
  return points
    .map(toUnits)
    .map((p, i) => `${i ? 'L' : 'M'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');
}

/** A filled triangle pointing from `from` to `to`, its tip at `to`. */
function arrowD(from: Point, to: Point, length: number, halfWidth: number): string {
  const a = toUnits(from);
  const b = toUnits(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const baseX = b.x - ux * length;
  const baseY = b.y - uy * length;
  return `M ${b.x.toFixed(1)} ${b.y.toFixed(1)} L ${(baseX - uy * halfWidth).toFixed(1)} ${(baseY + ux * halfWidth).toFixed(1)} L ${(baseX + uy * halfWidth).toFixed(1)} ${(baseY - ux * halfWidth).toFixed(1)} Z`;
}

/** Arrowheads for a route: one at its end, and a smaller one partway along
 *  each long segment so the direction reads anywhere on the line. */
function routeArrows(points: Point[]): string[] {
  const out: string[] = [];
  for (let i = 1; i < points.length; i++) {
    const a = toUnits(points[i - 1]);
    const b = toUnits(points[i]);
    if (Math.hypot(b.x - a.x, b.y - a.y) > 160) {
      const mid = { x: (points[i - 1].x + points[i].x) / 2, y: (points[i - 1].y + points[i].y) / 2 };
      out.push(arrowD(points[i - 1], mid, 16, 8));
    }
  }
  out.push(arrowD(points[points.length - 2], points[points.length - 1], 24, 12));
  return out;
}

function tooltip(entry: PlanAnnotation, editable: boolean): string {
  const parts = [entry.label, entry.value].filter(Boolean).join(' · ');
  return editable && entry.kind === 'marker' ? `${parts}\nClick to edit, drag to move` : parts;
}

export function SiteLayer({
  entries,
  opacity = 1,
  selectedId = null,
  interactive,
  passive = false,
  editable,
  counterScale = 1,
  frameRef,
  onSelect,
  onMoveMarker,
}: {
  entries: PlanAnnotation[];
  /** Fades the whole layer, for a stage transition. */
  opacity?: number;
  selectedId?: string | null;
  /** Takes clicks at all (see SlideRenderer's `interactive`). */
  interactive: boolean;
  /** Something's being placed or drawn, so clicks go through to the plan. */
  passive?: boolean;
  editable: boolean;
  /** 1 ÷ the viewer's zoom, so markers keep their size when Presenter zooms
   *  in on the plan. */
  counterScale?: number;
  /** The plan frame, for turning a marker drag into plan coordinates. */
  frameRef?: React.RefObject<HTMLElement | null>;
  onSelect?: (entry: PlanAnnotation) => void;
  onMoveMarker?: (entry: PlanAnnotation, point: Point) => void;
}) {
  // Live position while a marker is dragged; committed once, on release, so a
  // drag is one Undo step.
  const [drag, setDrag] = useState<{ id: string; point: Point } | null>(null);
  const dragRef = useRef<{ id: string; startX: number; startY: number; origin: Point; moved: boolean } | null>(null);
  const clickable = interactive && !passive;

  function press(entry: PlanAnnotation, e: React.PointerEvent) {
    if (!clickable) return;
    // Keeps the plan from also starting a shape, a pan or a deselect.
    e.stopPropagation();
    if (!editable) return;
    onSelect?.(entry);
    if (entry.kind !== 'marker' || !frameRef) return;
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      // No pointer to capture; moves over the marker still arrive.
    }
    dragRef.current = { id: entry.id, startX: e.clientX, startY: e.clientY, origin: entry.points[0], moved: false };
  }

  function move(e: React.PointerEvent) {
    const d = dragRef.current;
    const rect = frameRef?.current?.getBoundingClientRect();
    if (!d || !rect || !rect.width || !rect.height) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    // A few pixels of jitter is still a click, not a move.
    if (!d.moved && Math.abs(dx) + Math.abs(dy) < 4) return;
    d.moved = true;
    const point = {
      x: Math.min(1, Math.max(0, d.origin.x + dx / rect.width)),
      y: Math.min(1, Math.max(0, d.origin.y + dy / rect.height)),
    };
    setDrag({ id: d.id, point });
  }

  function release(entry: PlanAnnotation, e: React.PointerEvent) {
    const d = dragRef.current;
    dragRef.current = null;
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // Already released.
    }
    if (d?.moved && drag?.id === entry.id) onMoveMarker?.(entry, drag.point);
    setDrag(null);
  }

  function click(entry: PlanAnnotation, e: React.MouseEvent) {
    if (!clickable || editable) return;
    e.stopPropagation();
    onSelect?.(entry);
    // Presenter's own keys (Space, the arrows) mustn't press this again.
    if (e.currentTarget instanceof HTMLElement) e.currentTarget.blur();
  }

  const handlers = (entry: PlanAnnotation) => ({
    onPointerDown: (e: React.PointerEvent) => press(entry, e),
    onClick: (e: React.MouseEvent) => click(entry, e),
  });

  const areas = entries.filter((e) => e.kind === 'area' && e.points.length >= 2);
  const lines = entries.filter((e) => e.kind === 'line' && e.points.length >= 2);
  const markers = entries.filter((e) => e.kind === 'marker' && e.points.length >= 1);
  const gridLabels = lines.filter((l) => l.lineStyle === 'grid' && l.value);
  const pointerStyle = { pointerEvents: clickable ? 'visiblePainted' : 'none' } as const;

  return (
    <div className="pointer-events-none absolute inset-0" style={{ opacity }}>
      <svg className="absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
        {areas.map((entry) => {
          const color = siteCategory(entry.category).color;
          const selected = entry.id === selectedId;
          const d = shapePath(entry.points, entry.shape);
          return (
            // shapePath works in the hotspot layer's 0–100 box; scale it up.
            <g key={entry.id} transform={`scale(${W / 100} ${H / 100})`}>
              <path
                d={d}
                fill={color}
                fillOpacity={selected ? 0.34 : 0.2}
                stroke={color}
                strokeWidth={selected ? 2.5 : 1.5}
                vectorEffect="non-scaling-stroke"
                style={pointerStyle}
                className={clickable ? 'cursor-pointer' : undefined}
                {...handlers(entry)}
              >
                <title>{tooltip(entry, editable)}</title>
              </path>
              {selected && <path d={d} fill="none" stroke="var(--accent)" strokeWidth={2} strokeDasharray="6 4" vectorEffect="non-scaling-stroke" pointerEvents="none" />}
            </g>
          );
        })}
        {lines.map((entry) => {
          const color = siteCategory(entry.category).color;
          const style = LINE[entry.lineStyle ?? 'route'];
          const selected = entry.id === selectedId;
          const d = lineD(entry.points);
          return (
            <g key={entry.id}>
              {selected && <path d={d} fill="none" stroke="var(--accent)" strokeOpacity={0.35} strokeWidth={style.width + 12} strokeLinecap="round" strokeLinejoin="round" />}
              <path d={d} fill="none" stroke={color} strokeWidth={style.width} strokeDasharray={style.dash} strokeLinecap={style.cap} strokeLinejoin="round" />
              {entry.lineStyle === 'route' && routeArrows(entry.points).map((a, i) => <path key={i} d={a} fill={color} />)}
              {/* A wide invisible stroke to click, since the drawn line is
                  only a few pixels across. */}
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={Math.max(24, style.width + 16)}
                style={{ pointerEvents: clickable ? 'stroke' : 'none' }}
                className={clickable ? 'cursor-pointer' : undefined}
                {...handlers(entry)}
              >
                <title>{tooltip(entry, editable)}</title>
              </path>
            </g>
          );
        })}
      </svg>

      {gridLabels.map((entry) => {
        const p = entry.points[0];
        const color = siteCategory(entry.category).color;
        return (
          <span
            key={`${entry.id}-label`}
            className="absolute flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 bg-white px-1 text-[9px] font-bold leading-none text-[var(--ink)]"
            style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%`, borderColor: color, transform: `translate(-50%, -50%) scale(${counterScale})`, transition: 'transform 100ms ease-out' }}
          >
            {entry.value}
          </span>
        );
      })}

      {markers.map((entry) => {
        const p = drag?.id === entry.id ? drag.point : entry.points[0];
        const color = siteCategory(entry.category).color;
        const status = siteStatus(entry.status);
        const flagged = entry.status === 'to-verify' || entry.status === 'not-available';
        const selected = entry.id === selectedId;
        return (
          <button
            key={entry.id}
            type="button"
            tabIndex={clickable ? 0 : -1}
            aria-label={entry.label}
            title={tooltip(entry, editable)}
            onPointerDown={(e) => press(entry, e)}
            onPointerMove={move}
            onPointerUp={(e) => release(entry, e)}
            onPointerCancel={(e) => release(entry, e)}
            onClick={(e) => click(entry, e)}
            className={`absolute flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1 text-[10px] font-bold leading-none text-white shadow-md outline-none ${
              clickable ? `pointer-events-auto ${editable ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}` : 'pointer-events-none'
            }`}
            style={{
              left: `${p.x * 100}%`,
              top: `${p.y * 100}%`,
              backgroundColor: color,
              boxShadow: selected ? '0 0 0 2px #fff, 0 0 0 4px var(--accent)' : '0 0 0 2px #fff, 0 1px 4px rgba(0,0,0,0.35)',
              transform: `translate(-50%, -50%) scale(${counterScale})`,
              transition: 'transform 100ms ease-out',
            }}
          >
            {entry.directionDeg != null && (
              <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2 h-0 w-0" style={{ transform: `rotate(${entry.directionDeg}deg)` }}>
                <span
                  className="absolute h-0 w-0 border-x-[5px] border-b-[8px] border-x-transparent"
                  style={{ left: -5, top: -21, borderBottomColor: color }}
                />
              </span>
            )}
            <span className="relative">{entry.code || '•'}</span>
            {flagged && status && (
              <span
                aria-hidden
                className="absolute -right-1 -top-1 h-2 w-2 rounded-full"
                style={{ backgroundColor: status.color, boxShadow: '0 0 0 1.5px #fff' }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
