'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ScaledStage } from '@/components/ScaledStage';
import { PresenterSidebar, type PresenterSection } from '@/components/PresenterSidebar';
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
      className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-3 -translate-x-1/2 overflow-hidden rounded-lg border border-white/15 bg-[#171310] shadow-2xl"
      style={{ width: w, height: h }}
    >
      <div style={{ width: 1280, height: 720, transform: `scale(${w / 1280})`, transformOrigin: 'top left' }}>
        <SlideRenderer slide={slide} editable={false} />
      </div>
      {label && (
        <div className="absolute inset-x-0 bottom-0 truncate bg-[#241d16]/75 px-1.5 py-0.5 text-[9px] font-medium text-white/90">
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
    return <div className="flex h-screen items-center justify-center bg-[#171310] text-white/40">Loading…</div>;
  }

  const shown = project.slides.filter((s) => !s.skipped);
  if (shown.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-[#171310] text-white/50">
        <p>Every slide in this deck is skipped.</p>
        <button onClick={() => router.push(`/p/${id}/edit`)} className="text-sm underline">
          Back to the editor
        </button>
      </div>
    );
  }
  const shownIndex = shown.findIndex((s) => s.id === currentSlide?.id);

  // One group per section — a run of slides starting at a section-starter
  // divider, or wherever a design-option tag changes (e.g. into or out of
  // "Option 1"), or the very first slide, which starts the implicit first
  // group even when it isn't one of the above. Purely a visual clustering of
  // the nav dots; it doesn't change navigation order or which slides are "in"
  // a group beyond "everything up to the next divider." A deck that never
  // sets designOption behaves exactly as before — every comparison below is
  // undefined !== undefined, which is false, so nothing new ever splits it.
  const groups: { slide: (typeof shown)[number]; index: number }[][] = [];
  shown.forEach((s, i) => {
    const optionChanged = (s.designOption?.trim() || undefined) !== (shown[i - 1]?.designOption?.trim() || undefined);
    if (groups.length === 0 || s.style === 'section-starter' || optionChanged) groups.push([]);
    groups[groups.length - 1].push({ slide: s, index: i });
  });

  // A second, coarser grouping for the sidebar — section-starter slides
  // only, ignoring designOption changes (unlike `groups` above, which stays
  // exactly as it was for the dot-row). Hidden entirely (see
  // PresenterSidebar) when this produces fewer than 2 sections, so a deck
  // that never authors a section-starter slide shows no sidebar at all.
  const sections: PresenterSection[] = [];
  shown.forEach((s, i) => {
    if (sections.length === 0 || s.style === 'section-starter') {
      sections.push({ startSlide: s, startIndex: i, endIndex: i });
    } else {
      sections[sections.length - 1].endIndex = i;
    }
  });

  return (
    <div className="relative h-screen w-screen bg-[#171310]">
      {currentSlide && (
        <div className="absolute inset-0">
          {/* Same fixed 1280x720 canvas the editor and export use — without
              this, a layout that positions content by exact pixel/percent
              (e.g. a freeform imported slide) would distort to whatever
              shape the actual browser window happens to be, since nothing
              else here enforces a 16:9 box. fit="cover": Presenter fills the
              physical screen completely (cropping whichever axis overflows
              on a non-16:9 screen) rather than letterboxing — the one place
              that matters more than showing the entire frame at all times,
              unlike the editor's own ScaledStage usage. */}
          <ScaledStage fit="cover">
            <SlideRenderer slide={currentSlide} editable={false} animate />
          </ScaledStage>
        </div>
      )}

      {/* Floats over the slide, left edge, the same rounded/translucent
          treatment as every other piece of chrome below — not a layout
          sibling that reserves its own width. */}
      <PresenterSidebar sections={sections} currentIndex={shownIndex} onSelect={selectSlide} />

      {/* Keyboard legend — kbd-styled keys rather than plain prose, so it
          reads at a glance for someone who's never presented from this app
          before. */}
      <div className="absolute bottom-6 right-6 flex items-center gap-1.5 rounded-full bg-[#241d16]/40 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm">
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
        <div className="flex w-full flex-col items-center gap-1.5 rounded-2xl bg-[#241d16]/40 px-4 py-1.5 shadow-lg backdrop-blur-sm">
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
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-[#241d16]/40 px-3 py-2 shadow-lg backdrop-blur-sm">
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
