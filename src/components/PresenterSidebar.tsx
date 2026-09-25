'use client';

import { useState } from 'react';
import type { Slide } from '@/types/slide';

export type PresenterSection = {
  /** The section-starter slide that opens this run. */
  startSlide: Slide;
  /** Index (into the deck's shown-slides array) of the first slide in the
   *  section — used to test whether the currently-shown slide falls inside
   *  this section's range. */
  startIndex: number;
  /** Index of the last slide in the section (inclusive). */
  endIndex: number;
};

/** Floating left-hand section jump list for Presenter — reaching a
 *  section-starter slide's own title/kicker for its label. Text-only, no
 *  per-section icon (dropped per feedback — one generic bookmark glyph on
 *  every row added noise without telling sections apart). Sits alongside
 *  the existing keyboard nav and bottom dot-row (finer-grained, unaffected
 *  by this); this is purely a coarser "jump to section" shortcut. Styled as
 *  a floating rounded card — the same warm-near-black translucent/blur/
 *  shadow treatment as every other piece of Presenter chrome (the progress
 *  rail, the keyboard-hint pill) — rather than a flush full-height panel,
 *  since nothing else here reserves dedicated layout space; everything
 *  overlays the slide.
 *
 *  Collapsible, like the seating-capacity panel's own collapse-to-a-narrow-
 *  tab convention: collapsing doesn't lose the list, it shrinks to a small
 *  reopen affordance in the same corner so it's never more than one click
 *  away, without permanently covering the plan/slide underneath. Purely
 *  local, non-persisted state — a viewer convenience, not authored content —
 *  so it resets to expanded on the next mount, same as every other
 *  transient Presenter/viewer toggle in this app. */
export function PresenterSidebar({
  sections,
  currentIndex,
  onSelect,
}: {
  sections: PresenterSection[];
  currentIndex: number;
  onSelect: (slideId: string) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  if (sections.length < 2) return null;

  if (collapsed) {
    return (
      <button
        type="button"
        onClick={() => setCollapsed(false)}
        title="Show sections"
        className="absolute left-6 top-6 z-20 flex h-9 w-9 items-center justify-center rounded-full bg-[#241d16]/40 text-white/70 shadow-lg backdrop-blur-sm transition hover:bg-[#241d16]/60 hover:text-white"
      >
        ›
      </button>
    );
  }

  return (
    <div className="absolute bottom-6 left-6 top-6 z-20 w-52 overflow-y-auto rounded-2xl bg-[#241d16]/40 p-3 shadow-lg backdrop-blur-sm">
      <div className="mb-1 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Sections</span>
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          title="Collapse"
          className="flex h-6 w-6 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          ‹
        </button>
      </div>
      <div className="flex flex-col gap-1">
        {sections.map(({ startSlide, startIndex, endIndex }) => {
          const label = startSlide.fields.kickerLabel || startSlide.fields.title || 'Section';
          const active = currentIndex >= startIndex && currentIndex <= endIndex;
          const count = endIndex - startIndex + 1;
          return (
            <button
              key={startSlide.id}
              type="button"
              onClick={() => onSelect(startSlide.id)}
              aria-current={active}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                active ? 'bg-white/15 text-white' : 'text-white/60 hover:bg-white/5 hover:text-white/90'
              }`}
            >
              <span className="min-w-0 flex-1 truncate text-xs font-semibold">{label}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-white/40">{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
