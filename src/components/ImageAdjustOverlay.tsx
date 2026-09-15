'use client';

import { useCallback, useEffect, useRef } from 'react';
import { clamp, clampTransform, maxPan, MAX_ZOOM, MIN_ZOOM } from '@/lib/imageTransform';
import type { ImageTransform } from '@/types/slide';

type Point = { x: number; y: number };
type DragKind = 'pan' | 'zoom' | 'rotate';

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** The drag handles and adjustment toolbar shown over a MediaBox frame while
 *  it's in "adjust" mode — corner handles zoom (drag out to crop in tighter,
 *  in to zoom back out), the frame itself pans on drag, and the handle above
 *  it rotates. Rendered as a sibling of the clipped frame, not a child, so
 *  none of this gets cut off by the frame's own overflow-hidden. */
export function ImageAdjustOverlay({
  frameRef,
  transform,
  onChange,
  onDone,
  onReplace,
  onRemove,
}: {
  frameRef: React.RefObject<HTMLDivElement | null>;
  transform?: ImageTransform;
  onChange: (t: ImageTransform) => void;
  onDone: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const t = clampTransform(transform ?? {});
  // Read fresh on every drag start rather than depending on `t` in the
  // pointermove closure, so a fast drag doesn't compound against a stale
  // snapshot from the render that was current when the drag began.
  const liveRef = useRef(t);
  liveRef.current = t;

  const dragRef = useRef<{ kind: DragKind; startX: number; startY: number; startT: typeof t; center: Point } | null>(null);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const frame = frameRef.current;
      if (!drag || !frame) return;
      const rect = frame.getBoundingClientRect();

      if (drag.kind === 'pan') {
        const limit = maxPan(drag.startT.zoom);
        onChange({
          ...drag.startT,
          panX: clamp(drag.startT.panX + (e.clientX - drag.startX) / rect.width, -limit, limit),
          panY: clamp(drag.startT.panY + (e.clientY - drag.startY) / rect.height, -limit, limit),
        });
      } else if (drag.kind === 'zoom') {
        const start = distance(drag.center, { x: drag.startX, y: drag.startY });
        const now = distance(drag.center, { x: e.clientX, y: e.clientY });
        const zoom = clamp(drag.startT.zoom * (start > 0 ? now / start : 1), MIN_ZOOM, MAX_ZOOM);
        const limit = maxPan(zoom);
        onChange({
          ...drag.startT,
          zoom,
          panX: clamp(drag.startT.panX, -limit, limit),
          panY: clamp(drag.startT.panY, -limit, limit),
        });
      } else {
        // Rotate by how far the pointer has swung around the center since the
        // drag started, not by its absolute angle — an absolute angle snaps
        // the image to match the pointer the instant you grab the handle
        // (unless you grabbed it at the exact degree it's currently drawn at),
        // which reads as a jump rather than a smooth turn.
        const startAngle = Math.atan2(drag.startY - drag.center.y, drag.startX - drag.center.x);
        const nowAngle = Math.atan2(e.clientY - drag.center.y, e.clientX - drag.center.x);
        const deltaDeg = ((nowAngle - startAngle) * 180) / Math.PI;
        onChange({ ...drag.startT, rotation: drag.startT.rotation + deltaDeg });
      }
    },
    [frameRef, onChange],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove]);

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  function startDrag(kind: DragKind, e: React.PointerEvent) {
    e.preventDefault();
    e.stopPropagation();
    const frame = frameRef.current;
    if (!frame) return;
    const rect = frame.getBoundingClientRect();
    dragRef.current = {
      kind,
      startX: e.clientX,
      startY: e.clientY,
      startT: liveRef.current,
      center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  const handleClass = 'absolute h-3.5 w-3.5 rounded-sm border-2 border-white bg-[#0b72c2] shadow';

  return (
    <div className="absolute inset-0 z-10" onPointerDown={(e) => e.stopPropagation()}>
      <div className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-[#0b72c2]" />

      {/* Drag anywhere in the frame to reposition the image. */}
      <div className="absolute inset-0 cursor-move" onPointerDown={(e) => startDrag('pan', e)} />

      {[
        { x: 0, y: 0, cursor: 'nwse-resize' },
        { x: 1, y: 0, cursor: 'nesw-resize' },
        { x: 0, y: 1, cursor: 'nesw-resize' },
        { x: 1, y: 1, cursor: 'nwse-resize' },
      ].map((c) => (
        <div
          key={`${c.x}${c.y}`}
          onPointerDown={(e) => startDrag('zoom', e)}
          title="Drag to zoom"
          className={handleClass}
          style={{ left: `calc(${c.x * 100}% - 7px)`, top: `calc(${c.y * 100}% - 7px)`, cursor: c.cursor }}
        />
      ))}

      <div className="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 -translate-y-5 bg-[#0b72c2]" />
      <div
        onPointerDown={(e) => startDrag('rotate', e)}
        title="Drag to rotate"
        className={`${handleClass} left-1/2 top-0 -translate-x-1/2 -translate-y-8 cursor-grab rounded-full`}
      />

      <div className="absolute inset-x-2 bottom-2 flex flex-wrap items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5" onPointerDown={(e) => e.stopPropagation()}>
        <label className="flex items-center gap-1 text-[10px] font-semibold text-white/80">
          Zoom
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={t.zoom}
            onChange={(e) => {
              const zoom = clamp(Number(e.target.value), MIN_ZOOM, MAX_ZOOM);
              const limit = maxPan(zoom);
              onChange({ ...t, zoom, panX: clamp(t.panX, -limit, limit), panY: clamp(t.panY, -limit, limit) });
            }}
            className="w-14 accent-[#0b72c2]"
          />
        </label>
        <label className="flex items-center gap-1 text-[10px] font-semibold text-white/80">
          Opacity
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={t.opacity}
            onChange={(e) => onChange({ ...t, opacity: clamp(Number(e.target.value), 0, 1) })}
            className="w-14 accent-[#0b72c2]"
          />
        </label>
        <button
          type="button"
          onClick={() => onChange({ zoom: 1, panX: 0, panY: 0, rotation: 0, opacity: 1 })}
          className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 hover:border-white/60 hover:text-white"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={onReplace}
          className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-white/80 hover:border-white/60 hover:text-white"
        >
          Replace
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="rounded border border-white/25 px-1.5 py-0.5 text-[10px] font-semibold text-red-300 hover:border-red-300"
        >
          Remove
        </button>
        <button type="button" onClick={onDone} className="ml-auto rounded bg-white px-2 py-0.5 text-[10px] font-semibold text-black">
          Done
        </button>
      </div>
    </div>
  );
}
