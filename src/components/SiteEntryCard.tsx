'use client';

import { useEffect, useRef } from 'react';
import { siteCategory, siteItem, siteStatus } from '@/lib/siteChecklist';
import type { PlanAnnotation } from '@/types/slide';

/** The card a Site analysis entry opens in Presenter (S2): its name, layer,
 *  value, status and note. The plan positions it beside the entry, inside the
 *  frame. Esc closes it without leaving Presenter. */
export function SiteEntryCard({ entry, style, onClose }: { entry: PlanAnnotation; style: React.CSSProperties; onClose: () => void }) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      // Capture phase, like Lightbox: Presenter leaves on Esc, and one press
      // should only close this card.
      e.preventDefault();
      e.stopImmediatePropagation();
      closeRef.current();
    }
    window.addEventListener('keydown', onKey, { capture: true });
    return () => window.removeEventListener('keydown', onKey, { capture: true });
  }, []);

  const category = siteCategory(entry.category);
  const status = siteStatus(entry.status);
  const item = siteItem(entry.itemKey);
  // The checklist's own wording, when this entry's name was changed from it.
  const itemLabel = item && item.label !== entry.label ? item.label : undefined;

  return (
    <div
      role="dialog"
      aria-label={entry.label}
      onPointerDown={(e) => e.stopPropagation()}
      style={style}
      className="absolute z-30 w-56 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--line)] bg-white p-3 text-[var(--ink)] shadow-xl"
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold leading-snug">{entry.label}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-[var(--ink-3)]">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
            {category.label}
            {itemLabel && <span className="truncate">· {itemLabel}</span>}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-1 -mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] text-[var(--ink-3)] hover:bg-[var(--surface-2)] hover:text-[var(--ink)]"
        >
          ✕
        </button>
      </div>
      {entry.value && <div className="mt-2 text-[12px] font-semibold">{entry.value}</div>}
      {status && (
        <span
          className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ backgroundColor: `${status.color}1f`, color: status.color }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: status.color }} />
          {status.label}
        </span>
      )}
      {entry.note && <p className="mt-2 whitespace-pre-line text-[11px] leading-snug text-[var(--ink-2)]">{entry.note}</p>}
    </div>
  );
}
