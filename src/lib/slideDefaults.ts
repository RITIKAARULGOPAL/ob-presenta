import { makeId } from './id';
import type { Slide, SlideLayout, SlideStyleKind, StatItem, MergeItem, LinkedView } from '@/types/slide';

const defaultAnimation = () => ({ entry: 'none' as const, duration: 600, delay: 0 });

function makeStat(): StatItem {
  return { id: makeId('stat'), value: '', label: '' };
}
function makeItem(): MergeItem {
  return { id: makeId('item'), label: '' };
}
function makeLinkedViews(): LinkedView[] {
  // The labels here name the kind of view a slot holds, so they're structure
  // rather than filler — the URL is what the project supplies.
  return [
    { id: makeId('view'), kind: 'layout', label: 'Layout', url: '' },
    { id: makeId('view'), kind: 'render', label: 'Render', url: '' },
    { id: makeId('view'), kind: 'walkthrough', label: 'Walkthrough', url: '' },
    { id: makeId('view'), kind: 'axo', label: 'Axo', url: '' },
  ];
}

/** One factory per layout — the fields a fresh slide of that layout starts with.
 *
 *  Every text field starts EMPTY on purpose. A new slide should carry this
 *  project's words and nobody else's, and copy that was never written is copy
 *  that can end up in front of a client. The keys stay here so the layout still
 *  renders its full structure — three stat slots, the kicker's divider rule —
 *  and SlideRenderer shows each empty field's name as an editor-only hint, so a
 *  blank slide still reads as a shape you fill in rather than a void.
 *
 *  Written copy arrives exactly one way: picking an entry from the concept
 *  library, which composes its own fields in conceptSlides.ts and never routes
 *  through here. */
export function defaultFieldsForLayout(layout: SlideLayout) {
  switch (layout) {
    case 'blank':
      return {};
    case 'title-only':
      return { kickerEyebrow: '', kickerLabel: '', title: '' };
    case 'title-content':
      return { kickerEyebrow: '', kickerLabel: '', title: '', body: '' };
    case 'title-stats':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        stats: [makeStat(), makeStat(), makeStat()],
      };
    case 'two-content':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        leftColumn: '',
        rightColumn: '',
      };
    case 'title-slide':
      return { kickerEyebrow: '', title: '', subtitle: '' };
    case 'merge-diagram':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        items: [makeItem(), makeItem(), makeItem()],
        result: '',
      };
    case 'stat-hero':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        statValue: '',
        statLabel: '',
        caption: '',
      };
    case 'concept':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        lead: '',
        points: [makeItem(), makeItem(), makeItem()],
        imageUrl: '',
      };
    case 'linked-views':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        views: makeLinkedViews(),
      };
    default:
      return {};
  }
}

export function defaultFieldsForStyle(style: SlideStyleKind) {
  switch (style) {
    case 'section-starter':
      return { numeral: '', title: '', subtitle: '' };
    case 'company':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        body: '',
        stats: [makeStat(), makeStat(), makeStat()],
      };
    case 'design':
      return { kickerEyebrow: '', kickerLabel: '', title: '', imageUrl: '' };
    default:
      return defaultFieldsForLayout('title-content');
  }
}

export function createSlide(layout: SlideLayout = 'title-content'): Slide {
  return {
    id: makeId('slide'),
    layout,
    style: 'standard',
    fields: defaultFieldsForLayout(layout),
    animation: defaultAnimation(),
  };
}

export function createStyledSlide(style: SlideStyleKind): Slide {
  return {
    id: makeId('slide'),
    layout: style === 'section-starter' ? 'title-slide' : 'title-content',
    style,
    fields: defaultFieldsForStyle(style),
    animation: defaultAnimation(),
  };
}

export const LAYOUT_LABELS: Record<SlideLayout, string> = {
  blank: 'Blank',
  'title-only': 'Title Only',
  'title-content': 'Title + Content',
  'title-stats': 'Title + Stats',
  'two-content': 'Two Content',
  'title-slide': 'Title Slide',
  'merge-diagram': 'Merge Diagram',
  'stat-hero': 'Stat Hero',
  concept: 'Concept',
  'linked-views': 'Linked Views',
};

export const STYLE_LABELS: Record<SlideStyleKind, string> = {
  standard: 'Standard',
  'section-starter': 'Section Starter',
  company: 'Company / About Us',
  design: 'Design',
};
