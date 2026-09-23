'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ScaledStage } from '@/components/ScaledStage';
import type { Slide } from '@/types/slide';

/** Floating live preview shown above a hovered nav dot — the same
 *  SlideRenderer the main stage uses, just scaled way down inside a fixed
 *  1280×720 box (the same reference canvas ScaledStage/export assume), so a
 *  freeform/linked-views slide previews exactly as it'll actually look
 *  rather than a stale static thumbnail. */
function DotPreview({ slide }: { slide: Slide }) {
  const w = 176;
  const h = 99; // 16:9
  const label = slide.fields.title || slide.fields.kickerLabel;
  return (
    <div
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 overflow-hidden rounded-lg border border-white/15 bg-black shadow-2xl"
      style={{ width: w, height: h }}
    >
      <div style={{ width: 1280, height: 720, transform: `scale(${w / 1280})`, transformOrigin: 'top left' }}>
        <SlideRenderer slide={slide} editable={false} />
      </div>
      {label && (
        <div className="absolute inset-x-0 bottom-0 truncate bg-black/75 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
          {label}
        </div>
      )}
    </div>
  );
}

export default function PresenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);
  const setMode = useEditorStore((s) => s.setMode);
  const selectSlide = useEditorStore((s) => s.selectSlide);

  useEffect(() => {
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
        // The store steps over skipped slides only in presenter mode, and the
        // deck may well open on one.
        setMode('presenter');
        const first = p.slides.find((s) => !s.skipped);
        if (first) selectSlide(first.id);
        setReady(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        router.push(`/p/${id}/edit`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, router, id]);

  if (!ready || !project) {
    return <div className="flex h-screen items-center justify-center bg-black text-white/40">Loading…</div>;
  }

  const shown = project.slides.filter((s) => !s.skipped);
  if (shown.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black text-white/50">
        <p>Every slide in this deck is skipped.</p>
        <button onClick={() => router.push(`/p/${id}/edit`)} className="text-sm underline">
          Back to the editor
        </button>
      </div>
    );
  }
  const shownIndex = shown.findIndex((s) => s.id === currentSlide?.id);

  // One group per section — a run of slides starting at a section-starter
  // divider (or the very first slide, which starts the implicit first group
  // even when it isn't one). Purely a visual clustering of the nav dots; it
  // doesn't change navigation order or which slides are "in" a section
  // beyond "everything up to the next divider."
  const groups: { slide: (typeof shown)[number]; index: number }[][] = [];
  shown.forEach((s, i) => {
    if (groups.length === 0 || s.style === 'section-starter') groups.push([]);
    groups[groups.length - 1].push({ slide: s, index: i });
  });

  return (
    <div className="relative h-screen w-screen bg-black">
      {currentSlide && (
        <div className="absolute inset-0">
          {/* Same fixed 1280x720 canvas the editor and export use — without
              this, a layout that positions content by exact pixel/percent
              (e.g. a freeform imported slide) would distort to whatever
              shape the actual browser window happens to be, since nothing
              else here enforces a 16:9 box. */}
          <ScaledStage>
            {/* Keyed on the slide id so each slide gets a fresh mount. Two
                reasons, both bugs without it:

                1. A CSS animation only restarts when `animation-name` changes.
                   Reusing one DOM node across slides meant advancing between
                   two consecutive `fadeUp` slides played nothing at all.
                2. Component state leaked across slides. LinkedViewsExplorer's
                   `viewportZoom`/`viewportPanX/Y` carried straight over, and
                   its reset effect is keyed on `[activeId, activeStageId]` —
                   which doesn't change — so it never fired. The next slide
                   arrived pre-zoomed into a corner of an image it had never
                   shown. Same leak in MaterialCompare's `split`,
                   SiteLocusDiagram's `isRevealed` and MediaBox's `adjusting`.

                Accepted cost: returning to a slide loses whatever you'd
                explored on it, and a <video> restarts from 0. That matches the
                existing precedent for key plans, which already reset per view
                rather than carrying their expanded state over. */}
            <SlideRenderer key={currentSlide.id} slide={currentSlide} editable={false} animate />
          </ScaledStage>
        </div>
      )}

      {/* A translucent dark pill (not the slide-relative white/black tokens SlideRenderer
          uses) so these controls stay visible over both light and dark slide styles. */}
      <button
        onClick={goPrev}
        disabled={shownIndex <= 0}
        className="absolute left-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-20"
      >
        ‹
      </button>
      <button
        onClick={goNext}
        disabled={shownIndex >= shown.length - 1}
        className="absolute right-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-20"
      >
        ›
      </button>

      {/* Keyboard legend — kbd-styled keys rather than plain prose, so it
          reads at a glance for someone who's never presented from this app
          before. */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm">
        <kbd className="rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none">←</kbd>
        <kbd className="rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none">→</kbd>
        <span className="text-white/60">navigate</span>
        <span className="mx-0.5 text-white/25">·</span>
        <kbd className="rounded border border-white/25 bg-white/5 px-1.5 py-0.5 font-sans text-[10px] leading-none">Esc</kbd>
        <span className="text-white/60">exit</span>
      </div>

      {/* Progress rail: step count + a one-line hint, a slim fill bar, and a
          row of clickable dots (grouped by section, hover-previewed) for
          jump-to-slide — the deck's own navigation chrome, not part of any
          one slide's content. */}
      <div className="absolute bottom-6 left-1/2 flex max-w-[70vw] -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex w-full flex-col items-center gap-1.5 rounded-2xl bg-black/40 px-4 py-1.5 shadow-lg backdrop-blur-sm">
          <div className="flex items-center gap-3 text-xs text-white">
            <span className="font-semibold tabular-nums">
              {shownIndex + 1} / {shown.length}
            </span>
            {(currentSlide?.fields.kickerLabel || currentSlide?.fields.title) && (
              <span className="max-w-[40vw] truncate text-white/70">
                {currentSlide?.fields.kickerLabel || currentSlide?.fields.title}
              </span>
            )}
          </div>
          <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-300"
              style={{ width: `${((shownIndex + 1) / shown.length) * 100}%` }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-black/40 px-3 py-2 shadow-lg backdrop-blur-sm">
          {groups.map((group, gi) => (
            <div
              key={group[0]?.slide.id ?? gi}
              className={`flex items-center gap-1.5 ${gi > 0 ? 'ml-1.5 border-l border-white/15 pl-1.5' : ''}`}
            >
              {group.map(({ slide: s, index: i }) => (
                <button
                  key={s.id}
                  onClick={() => selectSlide(s.id)}
                  onMouseEnter={() => setHoveredIndex(i)}
                  onMouseLeave={() => setHoveredIndex((h) => (h === i ? null : h))}
                  aria-label={`Go to slide ${i + 1}${s.fields.title ? `: ${s.fields.title}` : ''}`}
                  aria-current={i === shownIndex}
                  className={`relative h-1.5 rounded-full transition-all duration-200 ${
                    i === shownIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/35 hover:w-2.5 hover:bg-white/70'
                  }`}
                >
                  {hoveredIndex === i && <DotPreview slide={s} />}
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
