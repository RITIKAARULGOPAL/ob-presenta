'use client';

import { useMemo, useState } from 'react';
import { DESIGN_PILLARS, TOTAL_CONCEPTS } from '@/lib/conceptLibrary';
import { buildConceptSlides, countSelectedSlides, emptySelection, type ConceptSelection } from '@/lib/conceptSlides';
import type { Slide } from '@/types/slide';

/** Browse the generic office-design framework and insert picked concepts as
 *  slides. Deliberately has no "select everything" button — 65 slides of
 *  framework language would read as boilerplate in front of a client. */
export function ConceptLibraryPicker({ onCancel, onInsert }: { onCancel: () => void; onInsert: (slides: Slide[]) => void }) {
  const [selection, setSelection] = useState<ConceptSelection>(emptySelection);
  const [openPillar, setOpenPillar] = useState<string | null>(DESIGN_PILLARS[0]?.id ?? null);

  const slideCount = useMemo(() => countSelectedSlides(selection, DESIGN_PILLARS), [selection]);
  const conceptCount = useMemo(
    () => Object.values(selection.byPillar).reduce((n, ids) => n + ids.length, 0),
    [selection],
  );

  function toggleConcept(pillarId: string, conceptId: string) {
    setSelection((prev) => {
      const picked = prev.byPillar[pillarId] ?? [];
      const next = picked.includes(conceptId) ? picked.filter((id) => id !== conceptId) : [...picked, conceptId];
      const byPillar = { ...prev.byPillar };
      if (next.length) byPillar[pillarId] = next;
      else delete byPillar[pillarId];
      return { ...prev, byPillar };
    });
  }

  function togglePillar(pillarId: string, conceptIds: string[]) {
    setSelection((prev) => {
      const picked = prev.byPillar[pillarId] ?? [];
      const byPillar = { ...prev.byPillar };
      if (picked.length === conceptIds.length) delete byPillar[pillarId];
      else byPillar[pillarId] = [...conceptIds];
      return { ...prev, byPillar };
    });
  }

  const optionRow = (
    label: string,
    key: 'includeSectionSlides' | 'digest' | 'includeSequence' | 'includeKeyIdea',
    hint: string,
  ) => (
    <label className="flex cursor-pointer items-start gap-2">
      <input
        type="checkbox"
        checked={selection[key]}
        onChange={(e) => setSelection((prev) => ({ ...prev, [key]: e.target.checked }))}
        className="mt-0.5 accent-[#0b72c2]"
      />
      <span>
        <span className="block text-[12px] font-medium text-slate-700">{label}</span>
        <span className="block text-[11px] leading-snug text-slate-500">{hint}</span>
      </span>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4" onClick={onCancel}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="shrink-0 border-b border-slate-200 px-5 py-4">
          <h2 className="text-[15px] font-semibold text-slate-800">Office design concepts</h2>
          <p className="mt-1 text-[12px] leading-relaxed text-slate-500">
            {TOTAL_CONCEPTS} concepts across {DESIGN_PILLARS.length} pillars. These are a design lens, not client
            copy — treat the inserted text as a scaffold to rewrite for this project.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {DESIGN_PILLARS.map((pillar) => {
            const picked = selection.byPillar[pillar.id] ?? [];
            const allPicked = picked.length === pillar.concepts.length;
            const isOpen = openPillar === pillar.id;
            return (
              <div key={pillar.id} className="border-b border-slate-100 last:border-0">
                <div className="flex items-center gap-2 py-2.5">
                  <input
                    type="checkbox"
                    checked={allPicked}
                    ref={(el) => {
                      if (el) el.indeterminate = picked.length > 0 && !allPicked;
                    }}
                    onChange={() => togglePillar(pillar.id, pillar.concepts.map((c) => c.id))}
                    className="accent-[#0b72c2]"
                    aria-label={`Select all in ${pillar.title}`}
                  />
                  <button
                    type="button"
                    onClick={() => setOpenPillar(isOpen ? null : pillar.id)}
                    className="flex flex-1 items-baseline gap-2 text-left"
                  >
                    <span className="font-mono text-[11px] text-slate-400">{pillar.numeral}</span>
                    <span className="text-[13px] font-medium text-slate-800">{pillar.title}</span>
                    <span className="text-[11px] text-slate-400">{pillar.question}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-slate-400">
                      {picked.length ? `${picked.length}/${pillar.concepts.length}` : pillar.concepts.length}
                    </span>
                  </button>
                </div>

                {isOpen && (
                  <div className="pb-3 pl-6">
                    {pillar.concepts.map((concept) => (
                      <label key={concept.id} className="flex cursor-pointer items-start gap-2 py-1.5">
                        <input
                          type="checkbox"
                          checked={picked.includes(concept.id)}
                          onChange={() => toggleConcept(pillar.id, concept.id)}
                          className="mt-1 accent-[#0b72c2]"
                        />
                        <span>
                          <span className="block text-[12px] font-medium text-slate-700">{concept.title}</span>
                          <span className="block text-[11px] leading-snug text-slate-500">{concept.description}</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-slate-50 px-5 py-3">
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            {optionRow('Add a divider per pillar', 'includeSectionSlides', 'A section-starter slide before each pillar’s concepts.')}
            {optionRow('One slide per pillar', 'digest', 'Collapse the picked concepts into a single slide instead of one each.')}
            {optionRow('Add the design sequence', 'includeSequence', 'The six-step Understand → Resolve process, as a diagram.')}
            {optionRow('Add the closing idea', 'includeKeyIdea', 'The framework’s “a system, not a collection of rooms” statement.')}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-[12px] text-slate-500">
              {conceptCount === 0
                ? 'Nothing picked yet'
                : `${conceptCount} concept${conceptCount === 1 ? '' : 's'} → ${slideCount} slide${slideCount === 1 ? '' : 's'}`}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md px-3 py-1.5 text-[12px] font-medium text-slate-600 hover:bg-slate-200"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={slideCount === 0}
                onClick={() => onInsert(buildConceptSlides(selection, DESIGN_PILLARS))}
                className="rounded-md bg-[#0b72c2] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-40"
              >
                Add {slideCount || ''} slide{slideCount === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
