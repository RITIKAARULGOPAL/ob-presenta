'use client';

import { useMemo, useState } from 'react';
import { DESIGN_PILLARS, TOTAL_CONCEPTS, type DesignConcept, type DesignPillar } from '@/lib/conceptLibrary';
import {
  conceptSlide,
  designSequenceSlide,
  isConceptSlideEdited,
  keyIdeaSlide,
  pillarSectionSlide,
} from '@/lib/conceptSlides';
import { useEditorStore } from '@/lib/editorStore';

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition ${on ? 'bg-[#0b72c2]' : 'bg-slate-300'}`}
    >
      <span className={`absolute h-3 w-3 rounded-full bg-white transition ${on ? 'left-3.5' : 'left-0.5'}`} />
    </span>
  );
}

/** The concept framework as a live dropdown: flipping a toggle adds or removes
 *  that slide from the deck immediately, rather than batching a selection. */
export function ConceptLibraryDropdown({ onClose }: { onClose: () => void }) {
  const project = useEditorStore((s) => s.project);
  const addConceptSlide = useEditorStore((s) => s.addConceptSlide);
  const removeConceptSlide = useEditorStore((s) => s.removeConceptSlide);
  const addSlides = useEditorStore((s) => s.addSlides);
  const [openPillar, setOpenPillar] = useState<string | null>(DESIGN_PILLARS[0]?.id ?? null);

  const slides = useMemo(() => project?.slides ?? [], [project?.slides]);

  /** Which concepts are already in the deck, by concept id. */
  const live = useMemo(() => {
    const map = new Map<string, string>(); // conceptId → slideId
    for (const s of slides) {
      if (s.conceptOrigin?.conceptId) map.set(s.conceptOrigin.conceptId, s.id);
    }
    return map;
  }, [slides]);

  /** Pillars whose divider slide is present. */
  const liveDividers = useMemo(() => {
    const set = new Set<string>();
    for (const s of slides) {
      if (s.conceptOrigin && !s.conceptOrigin.conceptId) set.add(s.conceptOrigin.pillarId);
    }
    return set;
  }, [slides]);

  const total = live.size;

  function toggleConcept(pillar: DesignPillar, concept: DesignConcept) {
    const existingId = live.get(concept.id);
    if (!existingId) {
      addConceptSlide(conceptSlide(pillar, concept));
      return;
    }
    const existing = slides.find((s) => s.id === existingId);
    // Toggling off an untouched insert is harmless; toggling off something the
    // user has actually written is not, so make them say so.
    if (existing && isConceptSlideEdited(existing, pillar, concept)) {
      const ok = window.confirm(`“${existing.fields.title}” has been edited. Removing it will discard those edits. Remove it?`);
      if (!ok) return;
    }
    removeConceptSlide({ pillarId: pillar.id, conceptId: concept.id });
  }

  function toggleDivider(pillar: DesignPillar) {
    if (liveDividers.has(pillar.id)) removeConceptSlide({ pillarId: pillar.id });
    else addConceptSlide(pillarSectionSlide(pillar));
  }

  return (
    <>
      {/* Click-away, without trapping focus the way a modal would — the deck
          updates behind this, so it stays watchable while toggling. */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-10 z-50 flex max-h-[70vh] w-[380px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-3.5 py-2.5">
          <div className="flex items-baseline justify-between">
            <span className="text-[12px] font-semibold text-slate-800">Office design concepts</span>
            <span className="text-[11px] text-slate-400">{total} of {TOTAL_CONCEPTS} on</span>
          </div>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Toggling one on adds the slide straight away. The text is a scaffold — rewrite it per project.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
          {DESIGN_PILLARS.map((pillar) => {
            const onCount = pillar.concepts.filter((c) => live.has(c.id)).length;
            const isOpen = openPillar === pillar.id;
            return (
              <div key={pillar.id}>
                <button
                  type="button"
                  onClick={() => setOpenPillar(isOpen ? null : pillar.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left hover:bg-slate-50"
                >
                  <span className={`text-[10px] text-slate-400 transition ${isOpen ? 'rotate-90' : ''}`}>▶</span>
                  <span className="font-mono text-[10px] text-slate-400">{pillar.numeral}</span>
                  <span className="flex-1 truncate text-[12px] font-medium text-slate-700">{pillar.title}</span>
                  <span className={`shrink-0 text-[10px] ${onCount ? 'font-semibold text-[#0b72c2]' : 'text-slate-400'}`}>
                    {onCount ? `${onCount}/${pillar.concepts.length}` : pillar.concepts.length}
                  </span>
                </button>

                {isOpen && (
                  <div className="pb-1.5 pl-7 pr-2">
                    <button
                      type="button"
                      onClick={() => toggleDivider(pillar)}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-slate-50"
                    >
                      <Switch on={liveDividers.has(pillar.id)} />
                      <span className="text-[11px] italic text-slate-500">Section divider</span>
                    </button>
                    {pillar.concepts.map((concept) => (
                      <button
                        key={concept.id}
                        type="button"
                        onClick={() => toggleConcept(pillar, concept)}
                        className="flex w-full items-start gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-slate-50"
                      >
                        <span className="mt-0.5">
                          <Switch on={live.has(concept.id)} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium text-slate-700">{concept.title}</span>
                          <span className="block text-[10.5px] leading-snug text-slate-400">{concept.description}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
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
    </>
  );
}
