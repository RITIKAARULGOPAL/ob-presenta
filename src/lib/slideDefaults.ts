import { makeId } from './id';
import type { Slide, SlideLayout, SlideStyleKind, StatItem, MergeItem, OrbitNode, LinkedView } from '@/types/slide';

const defaultAnimation = () => ({ entry: 'none' as const, duration: 600, delay: 0 });

function makeStat(): StatItem {
  return { id: makeId('stat'), value: '', label: '' };
}
function makeItem(): MergeItem {
  return { id: makeId('item'), label: '' };
}
export function makeOrbitNode(): OrbitNode {
  return { id: makeId('orbit'), label: '' };
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
      return { kickerEyebrow: '', title: '', subtitle: '', heroVideoUrl: '' };
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
    case 'site-locus':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        imageUrl: '',
        revealImageUrl: '',
        revealLabel: '',
        address: '',
        compassImageUrl: '',
      };
    case 'material-compare':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        compareBeforeUrl: '',
        compareBeforeLabel: '',
        compareAfterUrl: '',
        compareAfterLabel: '',
      };
    case 'orbit':
      return {
        kickerEyebrow: '',
        kickerLabel: '',
        title: '',
        orbitCoreTitle: '',
        orbitCoreBody: '',
        orbitNodes: [makeOrbitNode(), makeOrbitNode(), makeOrbitNode()],
      };
    case 'freeform':
      return { elements: [] };
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

/** A real duplicate — carries over every field's actual content, unlike
 *  addSlide/addStyledSlide above which always start from an empty template.
 *  Every nested array item gets a fresh id (stats/items/points/orbitNodes/
 *  views/hotspots/stages/seatingZones/rows/gallery images/elements), not
 *  just the slide itself — a naive `{ ...slide, id: makeId('slide') }` would
 *  leave the clone's hotspots, stages, and seating rows sharing ids with the
 *  original, which is fine until either copy is edited, at which point two
 *  unrelated hotspots on two different slides answer to the same id.
 *
 *  Same-slide cross-references (a hotspot's stageIds, a seating row's
 *  hotspotIds, a hotspot's targetViewId) are rewritten to the clone's own
 *  new ids so they still resolve correctly inside the clone. A hotspot's
 *  targetSlideId is left untouched — it points at another slide entirely,
 *  and still means the same destination after duplication. */
export function cloneSlide(slide: Slide): Slide {
  const views = slide.fields.views;
  let clonedViews: LinkedView[] | undefined;

  if (views) {
    // Two passes: mint every new id first, then rewrite same-slide pointers
    // through the resulting maps — a hotspot's stageIds needs the *other*
    // stage's new id, which doesn't exist until that stage's been visited.
    const viewIdMap = new Map(views.map((v) => [v.id, makeId('view')]));
    const stageIdMap = new Map(views.flatMap((v) => v.stages ?? []).map((s) => [s.id, makeId('stage')]));
    const hotspotIdMap = new Map(views.flatMap((v) => v.hotspots ?? []).map((h) => [h.id, makeId('hotspot')]));

    clonedViews = views.map((v) => ({
      ...v,
      id: viewIdMap.get(v.id)!,
      stages: v.stages?.map((s) => ({ ...s, id: stageIdMap.get(s.id)! })),
      hotspots: v.hotspots?.map((h) => ({
        ...h,
        id: hotspotIdMap.get(h.id)!,
        targetViewId: h.targetViewId ? (viewIdMap.get(h.targetViewId) ?? h.targetViewId) : undefined,
        stageIds: h.stageIds?.map((id) => stageIdMap.get(id) ?? id),
        listEntry: h.listEntry ? { ...h.listEntry, id: makeId('list') } : undefined,
        gallery: h.gallery?.map((g) => ({ ...g, id: makeId('gal') })),
      })),
      seatingZones: v.seatingZones?.map((z) => ({
        ...z,
        id: makeId('szone'),
        rows: z.rows.map((r) => ({
          ...r,
          id: makeId('srow'),
          hotspotIds: r.hotspotIds?.map((id) => hotspotIdMap.get(id) ?? id),
        })),
      })),
    }));
  }

  return {
    ...slide,
    id: makeId('slide'),
    fields: {
      ...slide.fields,
      stats: slide.fields.stats?.map((s) => ({ ...s, id: makeId('stat') })),
      items: slide.fields.items?.map((it) => ({ ...it, id: makeId('item') })),
      points: slide.fields.points?.map((pt) => ({ ...pt, id: makeId('point') })),
      orbitNodes: slide.fields.orbitNodes?.map((n) => ({ ...n, id: makeId('orbit') })),
      views: clonedViews,
      elements: slide.fields.elements?.map((el) => ({ ...el, id: makeId('elem') })),
    },
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
  'site-locus': 'Site Location',
  'material-compare': 'Materials Compare',
  orbit: 'Orbit Diagram',
  freeform: 'Freeform (Imported)',
};

export const STYLE_LABELS: Record<SlideStyleKind, string> = {
  standard: 'Standard',
  'section-starter': 'Section Starter',
  company: 'Company / About Us',
  design: 'Design',
};
