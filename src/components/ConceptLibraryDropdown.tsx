'use client';

import { useMemo, useState } from 'react';
import { DESIGN_PILLARS, TOTAL_CONCEPTS, type DesignConcept, type DesignPillar } from '@/lib/conceptLibrary';
import { conceptSlide, designSequenceSlide, keyIdeaSlide, pillarSectionSlide } from '@/lib/conceptSlides';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from './SlideRenderer';
import type { Slide } from '@/types/slide';

/** A real miniature of the slide, rendered through the same renderer the deck
 *  uses, so the preview shows the actual composition and diagram rather than a
 *  stylised icon. Same trick as the slide rail: scale down an oversized copy. */
function Thumb({ slide }: { slide: Slide }) {
  return (
    <div className="pointer-events-none aspect-video w-full overflow-hidden rounded border border-slate-200 bg-white">
      <div className="h-full w-full origin-top-left scale-[0.18]" style={{ width: '555%', height: '555%' }}>
        <SlideRenderer slide={slide} editable={false} />
      </div>
    </div>
  );
}

function GalleryItem({
  slide,
  label,
  inDeck,
  onPick,
}: {
  slide: Slide;
  label: string;
  inDeck: boolean;
  onPick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      title={inDeck ? `${label} — already in the deck, go to it` : `Add “${label}”`}
      className={`group flex flex-col gap-1 rounded-md border p-1.5 text-left transition ${
        inDeck ? 'border-[#0b72c2] bg-[#eff6fd]' : 'border-transparent hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      <Thumb slide={slide} />
      <span className="flex items-center gap-1 px-0.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-slate-700">{label}</span>
        {inDeck && <span className="shrink-0 text-[9px] font-bold uppercase text-[#0b72c2]">in deck</span>}
      </span>
    </button>
  );
}

/** The concept framework as a layout gallery: pick a pillar on the left, then
 *  click a thumbnail to add that one slide. Nothing is added until clicked —
 *  the previous toggle-per-concept version filled the rail with dozens of
 *  slides before anyone had chosen anything. */
export function ConceptLibraryDropdown({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((s) => s.project);
  const addConceptSlide = useEditorStore((s) => s.addConceptSlide);
  const addSlides = useEditorStore((s) => s.addSlides);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const [pillarId, setPillarId] = useState<string>(DESIGN_PILLARS[0]?.id ?? '');

  const pillar = DESIGN_PILLARS.find((p) => p.id === pillarId) ?? DESIGN_PILLARS[0];
  const slides = useMemo(() => project?.slides ?? [], [project?.slides]);

  /** conceptId → the slide already representing it, so a second click goes to
   *  it instead of adding a duplicate. */
  const inDeck = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of slides) if (s.conceptOrigin?.conceptId) map.set(s.conceptOrigin.conceptId, s.id);
    return map;
  }, [slides]);

  const dividerSlideId = useMemo(
    () => slides.find((s) => s.conceptOrigin?.pillarId === pillar.id && !s.conceptOrigin.conceptId)?.id,
    [slides, pillar.id],
  );

  // Previews are the expensive part, so only the open pillar's are built.
  const previews = useMemo(
    () => pillar.concepts.map((c) => ({ concept: c, slide: conceptSlide(pillar, c) })),
    [pillar],
  );
  const dividerPreview = useMemo(() => pillarSectionSlide(pillar), [pillar]);

  function pick(concept: DesignConcept) {
    const existing = inDeck.get(concept.id);
    if (existing) {
      selectSlide(existing);
      return;
    }
    addConceptSlide(conceptSlide(pillar, concept));
  }

  function pickDivider(p: DesignPillar) {
    if (dividerSlideId) {
      selectSlide(dividerSlideId);
      return;
    }
    addConceptSlide(pillarSectionSlide(p));
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-10 z-50 flex max-h-[74vh] w-[620px] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        {/* Pillars */}
        <div className="w-[168px] shrink-0 overflow-y-auto border-r border-slate-100 bg-slate-50 py-1">
          {DESIGN_PILLARS.map((p) => {
            const count = p.concepts.filter((c) => inDeck.has(c.id)).length;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPillarId(p.id)}
                className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left transition ${
                  p.id === pillar.id ? 'bg-white font-semibold text-[#0b72c2]' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="font-mono text-[9px] text-slate-400">{p.numeral}</span>
                <span className="min-w-0 flex-1 truncate text-[11px]">{p.title}</span>
                {count > 0 && <span className="shrink-0 text-[9px] font-bold text-[#0b72c2]">{count}</span>}
              </button>
            );
          })}
        </div>

        {/* Thumbnails for the selected pillar */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="shrink-0 border-b border-slate-100 px-3.5 py-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[12px] font-semibold text-slate-800">{pillar.title}</span>
              <span className="shrink-0 text-[10px] text-slate-400">
                {inDeck.size} of {TOTAL_CONCEPTS} added
              </span>
            </div>
            <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
              {pillar.question} Click a layout to add it — the text is a scaffold to rewrite.
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            <div className="grid grid-cols-3 gap-1.5">
              <GalleryItem
                slide={dividerPreview}
                label="Section divider"
                inDeck={!!dividerSlideId}
                onPick={() => pickDivider(pillar)}
              />
              {previews.map(({ concept, slide }) => (
                <GalleryItem
                  key={concept.id}
                  slide={slide}
                  label={concept.title}
                  inDeck={inDeck.has(concept.id)}
                  onPick={() => pick(concept)}
                />
              ))}
            </div>
          </div>

          <div className="flex shrink-0 gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2">
            <button
              type="button"
              onClick={() => addSlides([designSequenceSlide()])}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:border-slate-300"
            >
              + Design sequence
            </button>
            <button
              type="button"
              onClick={() => addSlides([keyIdeaSlide()])}
              className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:border-slate-300"
            >
              + Closing idea
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
