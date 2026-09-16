'use client';

import { useEffect, useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { clamp } from '@/lib/imageTransform';
import { imageStyle } from '@/lib/imageTransform';
import type { Slide } from '@/types/slide';

/** Cubic ease-out — a sweep should decelerate into place, not arrive linearly. */
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** A draggable before/after image comparison. The reference deck's own
 *  version turned out (on inspection) to not be a live drag at all — just a
 *  button-triggered eased sweep between two named mood-board images, with no
 *  audio-reactive behavior despite the evocative "resonance"/"pulse" names.
 *  This adds a real drag handle (more useful for an author than a fixed
 *  sweep) and keeps a "Play sweep" button for parity with the reference. */
export function MaterialCompare({ slide, editable }: { slide: Slide; editable: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  const frameRef = useRef<HTMLDivElement>(null);
  const [split, setSplit] = useState(50);
  const [playing, setPlaying] = useState(false);
  const f = slide.fields;

  function splitFromClientX(clientX: number): number {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return split;
    return clamp(((clientX - rect.left) / rect.width) * 100, 0, 100);
  }

  function startDrag(e: React.PointerEvent) {
    e.preventDefault();
    setPlaying(false);
    const move = (ev: PointerEvent) => setSplit(splitFromClientX(ev.clientX));
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  }

  function playSweep() {
    setPlaying(true);
    const from = split;
    const to = split > 50 ? 0 : 100;
    const duration = 1800;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      setSplit(from + (to - from) * easeOutCubic(t));
      if (t < 1) requestAnimationFrame(tick);
      else setPlaying(false);
    }
    requestAnimationFrame(tick);
  }

  // Respect prefers-reduced-motion for the auto-sweep specifically — the drag
  // itself is user-initiated, so it's left alone.
  useEffect(() => {
    if (!playing) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) setPlaying(false);
  }, [playing]);

  function urlInput(value: string | undefined, placeholder: string, onChange: (v: string) => void) {
    if (!editable) return null;
    return (
      <input
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        placeholder={placeholder}
        className="w-full rounded-md border border-white/20 bg-black/60 px-2 py-1 text-[10px] text-white outline-none placeholder:text-white/40"
      />
    );
  }

  return (
    <div className="mt-6">
      <div ref={frameRef} className="relative aspect-video w-full overflow-hidden rounded-lg bg-black/30 select-none">
        {f.compareAfterUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={f.compareAfterUrl} alt="" style={imageStyle(f.compareAfterTransform)} className="absolute inset-0 h-full w-full object-cover" />
        )}
        {f.compareBeforeUrl && (
          <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={f.compareBeforeUrl} alt="" style={imageStyle(f.compareBeforeTransform)} className="h-full w-full object-cover" />
          </div>
        )}

        {(f.compareBeforeLabel || editable) && (
          <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            {f.compareBeforeLabel || (editable ? 'Before label' : '')}
          </span>
        )}
        {(f.compareAfterLabel || editable) && (
          <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
            {f.compareAfterLabel || (editable ? 'After label' : '')}
          </span>
        )}

        {/* Handle */}
        <div className="pointer-events-none absolute inset-y-0 w-px bg-white/80" style={{ left: `${split}%` }} />
        <div
          onPointerDown={startDrag}
          className="absolute top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-[var(--accent)] text-xs text-white shadow-lg"
          style={{ left: `${split}%` }}
        >
          ↔
        </div>

        {editable && (
          <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1" onPointerDown={(e) => e.stopPropagation()}>
            <div className="flex gap-1">
              {urlInput(f.compareBeforeUrl, 'Paste "before" image URL…', (v) => updateField('compareBeforeUrl', v))}
              {urlInput(f.compareAfterUrl, 'Paste "after" image URL…', (v) => updateField('compareAfterUrl', v))}
            </div>
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        {editable ? (
          <div className="flex flex-1 gap-3">
            <EditableText
              editable
              value={f.compareBeforeLabel ?? ''}
              onChange={(v) => updateField('compareBeforeLabel', v)}
              as="span"
              placeholder="Before label"
              className="text-xs font-semibold text-[var(--ink-2)] outline-none"
            />
            <EditableText
              editable
              value={f.compareAfterLabel ?? ''}
              onChange={(v) => updateField('compareAfterLabel', v)}
              as="span"
              placeholder="After label"
              className="text-xs font-semibold text-[var(--ink-2)] outline-none"
            />
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={playSweep}
          disabled={playing}
          className="shrink-0 rounded-full border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs font-semibold text-[var(--accent)] hover:border-[var(--accent)] disabled:opacity-50"
        >
          {playing ? 'Playing…' : '▶ Play sweep'}
        </button>
      </div>
    </div>
  );
}
