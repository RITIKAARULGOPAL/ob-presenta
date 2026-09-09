// Turns concept-library entries into slides.
//
// Nothing here touches the database: a template is just a factory returning the
// same { layout, style, fields } shape the editor already understands, and
// slides live in a jsonb column, so the whole feature is schema-free.

import { makeId } from './id';
import { DESIGN_SEQUENCE, KEY_IDEA, type DesignConcept, type DesignPillar } from './conceptLibrary';
import { CONCEPT_DETAIL } from './conceptDetail';
import type { Slide } from '@/types/slide';

const animation = () => ({ entry: 'fadeUp' as const, duration: 600, delay: 0 });

/** The pillar's own divider — reads as a chapter opener in the deck. */
export function pillarSectionSlide(pillar: DesignPillar): Slide {
  return {
    id: makeId('slide'),
    layout: 'title-slide',
    style: 'section-starter',
    fields: {
      numeral: pillar.numeral,
      title: pillar.title,
      subtitle: pillar.question,
    },
    animation: animation(),
    conceptOrigin: { pillarId: pillar.id },
  };
}

/** One concept, one composed slide: a lead line, scannable point cards, and an
 *  empty image slot for the project's own plan or render. Falls back to the
 *  library description when a concept has no authored presentation copy. */
export function conceptSlide(pillar: DesignPillar, concept: DesignConcept): Slide {
  const detail = CONCEPT_DETAIL[concept.id];
  return {
    id: makeId('slide'),
    layout: 'concept',
    style: 'standard',
    fields: {
      kickerEyebrow: pillar.title,
      kickerLabel: pillar.numeral,
      title: concept.title,
      lead: detail?.lead ?? concept.description,
      points: (detail?.points ?? []).map((label) => ({ id: makeId('point'), label })),
      imageUrl: '',
    },
    animation: animation(),
    conceptOrigin: { pillarId: pillar.id, conceptId: concept.id },
  };
}

/** A whole pillar condensed onto one slide. Far more likely than 65 separate
 *  slides to survive into a deck a client actually sees. */
export function pillarDigestSlide(pillar: DesignPillar): Slide {
  return {
    id: makeId('slide'),
    layout: 'title-content',
    style: 'standard',
    fields: {
      kickerEyebrow: pillar.title,
      kickerLabel: pillar.numeral,
      title: pillar.question,
      body: pillar.concepts.map((c) => `${c.title} — ${c.description}`).join('\n\n'),
    },
    animation: animation(),
    conceptOrigin: { pillarId: pillar.id },
  };
}

/** The guide's six-step sequence, as a merge diagram. */
export function designSequenceSlide(): Slide {
  return {
    id: makeId('slide'),
    layout: 'merge-diagram',
    style: 'standard',
    fields: {
      kickerEyebrow: 'Approach',
      kickerLabel: 'Process',
      title: 'A practical design sequence',
      items: DESIGN_SEQUENCE.map((step) => ({
        id: makeId('item'),
        label: `${step.numeral} — ${step.title}`,
      })),
      result: 'A resolved workplace',
    },
    animation: animation(),
  };
}

/** The framework's closing idea, as a full-bleed statement. */
export function keyIdeaSlide(): Slide {
  return {
    id: makeId('slide'),
    layout: 'title-only',
    style: 'section-starter',
    fields: {
      kickerEyebrow: 'Key idea',
      title: KEY_IDEA,
    },
    animation: animation(),
  };
}

export type ConceptSelection = {
  /** Pillar id → the concept ids picked within it. */
  byPillar: Record<string, string[]>;
  /** Insert each pillar's section-starter divider ahead of its concepts. */
  includeSectionSlides: boolean;
  /** Collapse each pillar to a single digest slide instead of one per concept. */
  digest: boolean;
  includeSequence: boolean;
  includeKeyIdea: boolean;
};

export function emptySelection(): ConceptSelection {
  return {
    byPillar: {},
    includeSectionSlides: true,
    digest: false,
    includeSequence: false,
    includeKeyIdea: false,
  };
}

export function countSelectedSlides(selection: ConceptSelection, pillars: DesignPillar[]): number {
  let n = 0;
  for (const pillar of pillars) {
    const picked = selection.byPillar[pillar.id] ?? [];
    if (picked.length === 0) continue;
    if (selection.includeSectionSlides) n += 1;
    n += selection.digest ? 1 : picked.length;
  }
  if (selection.includeSequence) n += 1;
  if (selection.includeKeyIdea) n += 1;
  return n;
}

/** Builds the slides for a selection, in pillar order. */
export function buildConceptSlides(selection: ConceptSelection, pillars: DesignPillar[]): Slide[] {
  const slides: Slide[] = [];
  for (const pillar of pillars) {
    const picked = selection.byPillar[pillar.id] ?? [];
    if (picked.length === 0) continue;

    if (selection.includeSectionSlides) slides.push(pillarSectionSlide(pillar));

    if (selection.digest) {
      // Digest only the concepts actually picked, not the whole pillar.
      slides.push(
        pillarDigestSlide({ ...pillar, concepts: pillar.concepts.filter((c) => picked.includes(c.id)) }),
      );
    } else {
      for (const concept of pillar.concepts) {
        if (picked.includes(concept.id)) slides.push(conceptSlide(pillar, concept));
      }
    }
  }
  if (selection.includeSequence) slides.push(designSequenceSlide());
  if (selection.includeKeyIdea) slides.push(keyIdeaSlide());
  return slides;
}
