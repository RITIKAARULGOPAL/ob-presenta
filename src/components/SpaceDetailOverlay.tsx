'use client';

import { useEffect } from 'react';
import type { HotspotGalleryImage, SeatingRow, SpaceDetail } from '@/types/slide';

/** Everything about one space, surfaced on top of the plan instead of
 *  navigating away — the whole point is staying put mid-pitch rather than
 *  flipping back through the deck to find which concept justified this
 *  space. Only sections with actual content render. Closes on Escape,
 *  backdrop click, or the close button, matching Lightbox's own dismissal
 *  conventions. */
export function SpaceDetailOverlay({
  label,
  detail,
  gallery,
  occupancy,
  onOpenGallery,
  onClose,
}: {
  label?: string;
  detail?: SpaceDetail;
  gallery?: HotspotGalleryImage[];
  /** The seating-table row linked to this space, if any — read-only here;
   *  editing it happens on the Seating Capacity table itself, not here, so
   *  there's exactly one place that number lives. */
  occupancy?: SeatingRow;
  onOpenGallery: (index: number) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Capture phase + stopImmediatePropagation: Presenter mode has its own
      // Escape listener on the same `window` target (exits to the editor).
      // Without this, both fire on the same keypress — Escape would close
      // this overlay AND exit Presenter mode in one press.
      e.stopImmediatePropagation();
      onClose();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, [onClose]);

  const hasConcept = !!detail?.concept;
  const hasRenders = !!gallery?.length;
  const hasWalkthrough = !!detail?.walkthroughUrl;
  const hasOccupancy = !!occupancy;
  const hasBoq = !!detail?.boq;
  const hasNote = !!detail?.note;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-6" onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-full w-full max-w-lg overflow-y-auto rounded-[var(--radius-lg)] bg-white p-5 shadow-[var(--shadow-lg)]"
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <span className="text-xs font-bold uppercase tracking-wide text-[var(--ink-3)]">{label || 'This space'}</span>
          <button onClick={onClose} aria-label="Close" className="rounded-full px-2 py-0.5 text-sm text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]">
            ✕
          </button>
        </div>

        {hasConcept && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] p-3">
            {detail!.concept!.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={detail!.concept!.imageUrl} alt="" className="mb-2 h-32 w-full rounded object-cover" />
            )}
            <div className="text-sm font-bold text-[var(--ink)]">{detail!.concept!.title}</div>
            <p className="mt-1 text-[13px] leading-snug text-[var(--ink-2)]">{detail!.concept!.body}</p>
          </div>
        )}

        {hasRenders && (
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Renders</div>
            <div className="flex gap-2 overflow-x-auto">
              {gallery!.map((img, i) => (
                <button key={img.id} onClick={() => onOpenGallery(i)} className="shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.url} alt={img.caption ?? ''} className="h-20 w-28 rounded object-cover" />
                </button>
              ))}
            </div>
          </div>
        )}

        {hasWalkthrough && (
          <div className="mb-4">
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Walkthrough</div>
            <video src={detail!.walkthroughUrl} controls className="w-full rounded-[var(--radius-md)]" />
          </div>
        )}

        {hasOccupancy && (
          <div className="mb-4 flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--line)] px-3 py-2">
            <span className="text-[13px] font-medium text-[var(--ink-2)]">Occupancy</span>
            <span className="text-[13px] font-semibold text-[var(--ink)]">
              {occupancy!.required ? `${occupancy!.required} req. · ${occupancy!.achieved} achieved` : occupancy!.achieved}
            </span>
          </div>
        )}

        {hasBoq && (
          <div className="mb-4 rounded-[var(--radius-md)] border border-dashed border-[var(--line)] px-3 py-2 text-[13px] text-[var(--ink-3)]">
            <span className="font-semibold text-[var(--ink-2)]">BOQ — </span>
            {detail!.boq!.note || 'Coming soon.'}
          </div>
        )}

        {hasNote && <p className="text-[13px] leading-snug text-[var(--ink-2)]">{detail!.note}</p>}

        {!hasConcept && !hasRenders && !hasWalkthrough && !hasOccupancy && !hasBoq && !hasNote && (
          <p className="text-[13px] text-[var(--ink-3)]">Nothing added for this space yet.</p>
        )}
      </div>
    </div>
  );
}
