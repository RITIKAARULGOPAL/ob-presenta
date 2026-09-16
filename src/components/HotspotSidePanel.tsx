'use client';

import type { ViewHotspot } from '@/types/slide';

/** The list of hotspots that carry a `listEntry`, shown beside a linked
 *  view's image — hovering a row highlights the matching hotspot on the
 *  image, and vice versa (the image side wires the same `hoveredId`/`onHover`
 *  back in LinkedViewsExplorer). Click jumps the same way clicking the
 *  hotspot itself does. Presentational only — no drawing/editing state lives
 *  here, that all stays in LinkedViewsExplorer. */
export function HotspotSidePanel({
  hotspots,
  hoveredId,
  onHover,
  onSelect,
}: {
  hotspots: ViewHotspot[];
  hoveredId: string | null;
  onHover: (id: string | null) => void;
  onSelect: (hotspot: ViewHotspot) => void;
}) {
  if (hotspots.length === 0) return null;

  return (
    <div className="flex w-56 shrink-0 flex-col gap-1.5 overflow-y-auto">
      {hotspots.map((h) => (
        <button
          key={h.id}
          type="button"
          onMouseEnter={() => onHover(h.id)}
          onMouseLeave={() => onHover(null)}
          onClick={() => onSelect(h)}
          className={`rounded-md border px-3 py-2 text-left transition ${
            hoveredId === h.id
              ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
              : 'border-[var(--line)] hover:border-[var(--ink-3)]'
          }`}
        >
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs font-semibold text-[var(--ink)]">{h.listEntry?.label || h.label || 'Untitled'}</span>
            {h.listEntry?.value && <span className="shrink-0 text-[11px] font-medium text-[var(--accent)]">{h.listEntry.value}</span>}
          </div>
          {h.listEntry?.description && <p className="mt-0.5 text-[11px] leading-snug text-[var(--ink-3)]">{h.listEntry.description}</p>}
        </button>
      ))}
    </div>
  );
}
