'use client';

import { useCallback, useEffect, useRef } from 'react';
import { clamp, clampTransform, MAX_ZOOM, MIN_ZOOM } from '@/lib/imageTransform';
import type { ImageTransform } from '@/types/slide';

type Point = { x: number; y: number };
type DragKind = 'zoom' | 'rotate';

function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** On-canvas resize/rotate handles for a free-floating picture that has no
 * frame of its own to crop within — the client logo, unlike a MediaBox photo.
 * Dragging a corner here resizes the whole picture and dragging the handle
 * above it rotates the whole picture, matching how Google Slides handles a
 * picture object's own selection handles; there's no pan surface, because
 * there's no fixed frame for the picture to pan around inside of.
 *
 * Must be rendered as a sibling of the <img> it adjusts, inside a
 * `position: relative` wrapper sized to that image's own (untransformed) box
 * — this component's own inner wrapper is `absolute inset-0` and carries the
 * same rotate/scale the image does, so its handles and selection ring track
 * the image exactly without needing to measure a rotated bounding box. */
export function LogoAdjustOverlay({
  transform,
  onChange,
  onDone,
  onReplace,
  onRemove,
}: {
  transform?: ImageTransform;
  onChange: (t: ImageTransform) => void;
  onDone: () => void;
  onReplace: () => void;
  onRemove: () => void;
}) {
  const t = clampTransform(transform ?? {});
  const liveRef = useRef(t);
  liveRef.current = t;
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ kind: DragKind; startX: number; startY: number; startT: typeof t; center: Point } | null>(null);

  const onPointerMove = useCallback((e: PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === 'zoom') {
      const start = distance(drag.center, { x: drag.startX, y: drag.startY });
      const now = distance(drag.center, { x: e.clientX, y: e.clientY });
      const zoom = clamp(drag.startT.zoom * (start > 0 ? now / start : 1), MIN_ZOOM, MAX_ZOOM);
      onChange({ ...drag.startT, zoom });
    } else {
      // Rotate by how far the pointer has swung around the center since the
      // drag started, not by its absolute angle — see ImageAdjustOverlay for
      // why: an absolute angle snaps the picture to match the pointer the
      // instant you grab the handle, which reads as a jump, not a turn.
      const startAngle = Math.atan2(drag.startY - drag.center.y, drag.startX - drag.center.x);
      const nowAngle = Math.atan2(e.clientY - drag.center.y, e.clientX - drag.center.x);
      const deltaDeg = ((nowAngle - startAngle) * 180) / Math.PI;
      onChange({ ...drag.startT, rotation: drag.startT.rotation + deltaDeg });
    }
  }, [onChange]);

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
    const wrap = wrapRef.current;
    if (!wrap) return;
    // Rotating a box around its own center never moves that center, so the
    // untransformed rect's midpoint is the right pivot even mid-rotation.
    const rect = wrap.getBoundingClientRect();
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

  const handleClass = 'pointer-events-auto absolute h-3 w-3 rounded-sm border-2 border-white bg-[#0b72c2] shadow';

  return (
    <>
      <div
        ref={wrapRef}
        className="pointer-events-none absolute inset-0"
        style={{
          transform: `rotate(${t.rotation}deg) scale(${t.zoom})`,
          transformOrigin: 'center',
        }}
      >
        <div className="pointer-events-none absolute inset-0 rounded ring-2 ring-[#0b72c2]" />

        {[
          { x: 0, y: 0, cursor: 'nwse-resize' },
          { x: 1, y: 0, cursor: 'nesw-resize' },
          { x: 0, y: 1, cursor: 'nesw-resize' },
          { x: 1, y: 1, cursor: 'nwse-resize' },
        ].map((c) => (
          <div
            key={`${c.x}${c.y}`}
            onPointerDown={(e) => startDrag('zoom', e)}
            title="Drag to resize"
            className={handleClass}
            style={{ left: `calc(${c.x * 100}% - 6px)`, top: `calc(${c.y * 100}% - 6px)`, cursor: c.cursor }}
          />
        ))}

        <div className="pointer-events-none absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 -translate-y-5 bg-[#0b72c2]" />
        <div
          onPointerDown={(e) => startDrag('rotate', e)}
          title="Drag to rotate"
          className={`${handleClass} left-1/2 top-0 -translate-x-1/2 -translate-y-8 cursor-grab rounded-full`}
        />
      </div>

      <div
        className="absolute left-1/2 top-full z-10 mt-2 flex w-56 -translate-x-1/2 flex-wrap items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <label className="flex items-center gap-1 text-[10px] font-semibold text-white/80">
          Size
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.05}
            value={t.zoom}
            onChange={(e) => onChange({ ...t, zoom: clamp(Number(e.target.value), MIN_ZOOM, MAX_ZOOM) })}
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
    </>
  );
}
