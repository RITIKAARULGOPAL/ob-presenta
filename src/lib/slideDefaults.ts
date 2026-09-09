import { makeId } from './id';
import type { Slide, SlideLayout, SlideStyleKind, StatItem, MergeItem, LinkedView } from '@/types/slide';

const defaultAnimation = () => ({ entry: 'none' as const, duration: 600, delay: 0 });

function makeStat(label: string, value = '0'): StatItem {
  return { id: makeId('stat'), value, label };
}
function makeItem(label: string): MergeItem {
  return { id: makeId('item'), label };
}
function makeLinkedViews(): LinkedView[] {
  return [
    { id: makeId('view'), kind: 'layout', label: 'Layout', url: '' },
    { id: makeId('view'), kind: 'render', label: 'Render', url: '' },
    { id: makeId('view'), kind: 'walkthrough', label: 'Walkthrough', url: '' },
    { id: makeId('view'), kind: 'axo', label: 'Axo', url: '' },
  ];
}

/** One factory per layout — the fields a fresh slide of that layout starts with.
 *  Mirrors the POC's SLIDE_LAYOUTS.build() functions, just returning data instead
 *  of an HTML string. */
export function defaultFieldsForLayout(layout: SlideLayout) {
  switch (layout) {
    case 'blank':
      return {};
    case 'title-only':
      return { kickerEyebrow: 'New Section', kickerLabel: 'Untitled', title: 'Slide title' };
    case 'title-content':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        body: 'Click to edit this placeholder copy.',
      };
    case 'title-stats':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        stats: [makeStat('Stat one'), makeStat('Stat two'), makeStat('Stat three')],
      };
    case 'two-content':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        leftColumn: 'Left column placeholder copy.',
        rightColumn: 'Right column placeholder copy.',
      };
    case 'title-slide':
      return { kickerEyebrow: 'New Section', title: 'Slide title', subtitle: 'Subtitle placeholder' };
    case 'merge-diagram':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        items: [makeItem('Item one'), makeItem('Item two'), makeItem('Item three')],
        result: 'Result',
      };
    case 'stat-hero':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        statValue: '123',
        statLabel: 'Stat description',
        caption: 'Supporting caption text.',
      };
    case 'concept':
      return {
        kickerEyebrow: 'Design Concept',
        kickerLabel: 'Principle',
        title: 'Concept title',
        lead: 'One line describing the principle.',
        points: [makeItem('Point one'), makeItem('Point two'), makeItem('Point three')],
        imageUrl: '',
      };
    case 'linked-views':
      return {
        kickerEyebrow: 'New Section',
        kickerLabel: 'Untitled',
        title: 'Slide title',
        views: makeLinkedViews(),
      };
    default:
      return {};
  }
}

export function defaultFieldsForStyle(style: SlideStyleKind) {
  switch (style) {
    case 'section-starter':
      return { numeral: '01', title: 'Section title', subtitle: 'Chapter subtitle' };
    case 'company':
      return {
        kickerEyebrow: 'Company Profile',
        kickerLabel: 'Overview',
        title: 'About us',
        body: 'A short introduction to who we are and what we do.',
        stats: [makeStat('Stat one'), makeStat('Stat two'), makeStat('Stat three')],
      };
    case 'design':
      return {
        kickerEyebrow: 'Design Thinking',
        kickerLabel: 'Visual Direction',
        title: 'Design title',
        imageUrl: '',
      };
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
