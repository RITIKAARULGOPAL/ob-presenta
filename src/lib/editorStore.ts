import { create } from 'zustand';
import { createSlide, createStyledSlide, defaultFieldsForLayout, defaultFieldsForStyle } from './slideDefaults';
import { optionalColumnsMissing, saveProject } from './data';
import { makeId } from './id';
import type { Brand, FontPairing, Project, Slide, SlideFields, SlideLayout, SlideStyleKind, TypographySettings } from '@/types/slide';

type Mode = 'editor' | 'presenter';

interface EditorState {
  project: Project | null;
  currentSlideId: string | null;
  mode: Mode;
  saving: boolean;
  saveError?: string;
  logoSaveUnavailable: boolean;

  loadProject: (project: Project) => void;
  setMode: (mode: Mode) => void;
  selectSlide: (id: string) => void;
  goNext: () => void;
  goPrev: () => void;

  updateField: <K extends keyof SlideFields>(field: K, value: SlideFields[K]) => void;
  addSlide: (layout?: SlideLayout) => void;
  addSlides: (slides: Slide[]) => void;
  addConceptSlide: (slide: Slide) => void;
  addStyledSlide: (style: SlideStyleKind) => void;
  removeSlide: (id: string) => void;
  toggleSkip: (id: string) => void;
  changeLayout: (layout: SlideLayout) => void;
  changeStyle: (style: SlideStyleKind) => void;
  setBrandOverride: (brand: Brand | undefined) => void;
  setClientLogo: (dataUrl: string | undefined) => void;
  setAccentColor: (hex: string | undefined) => void;
  setFontFamily: (font: FontPairing | undefined) => void;
  /** Merges into the project's deck-wide typography defaults — pass just the
   *  axis (or axes) you're changing; the rest are left as they were.
   *  Passing `undefined` for a key clears that one axis back to built-in. */
  setTypography: (patch: TypographySettings) => void;
  /** Same merge, but for one slide's override over the project default.
   *  Passing `undefined` for a key clears that one axis back to inheriting
   *  the project's setting, not all the way to built-in. */
  setSlideTypographyOverride: (patch: TypographySettings) => void;
  setLinkedSlideIds: (ids: string[]) => void;

  addStatItem: () => void;
  removeStatItem: (statId: string) => void;
  addMergeItem: () => void;
  removeMergeItem: (itemId: string) => void;
  addPoint: () => void;
  removePoint: (pointId: string) => void;

  currentSlide: () => Slide | null;
  currentIndex: () => number;
}

/** Removes every reference to a deleted slide — both the chip links on a slide
 *  and any linked-view hotspot that pointed at it. */
function dropLinksTo(slide: Slide, deletedId: string): Slide {
  const linked = slide.fields.linkedSlideIds?.filter((id) => id !== deletedId);
  const views = slide.fields.views?.map((v) =>
    v.hotspots?.some((h) => h.targetSlideId === deletedId)
      ? { ...v, hotspots: v.hotspots.filter((h) => h.targetSlideId !== deletedId) }
      : v,
  );

  const linkedChanged = (linked?.length ?? 0) !== (slide.fields.linkedSlideIds?.length ?? 0);
  const viewsChanged = views !== undefined && views.some((v, i) => v !== slide.fields.views?.[i]);
  if (!linkedChanged && !viewsChanged) return slide;

  return {
    ...slide,
    fields: {
      ...slide.fields,
      ...(linkedChanged ? { linkedSlideIds: linked && linked.length ? linked : undefined } : {}),
      ...(viewsChanged ? { views } : {}),
    },
  };
}

/** The next slide in a direction, passing over skipped ones when presenting.
 *  The editor still walks every slide — you have to be able to reach a skipped
 *  slide in order to edit it or un-skip it. */
function step(slides: Slide[], from: number, dir: 1 | -1, skipSkipped: boolean): Slide | undefined {
  for (let i = from + dir; i >= 0 && i < slides.length; i += dir) {
    if (!skipSkipped || !slides[i].skipped) return slides[i];
  }
  return undefined;
}

function persist(project: Project) {
  // Fire-and-forget, but not silent: a save that fails has to reach the user,
  // or they keep editing a deck that isn't being written anywhere.
  void saveProject(project)
    .then(() => useEditorStore.setState({ saveError: undefined, logoSaveUnavailable: optionalColumnsMissing() }))
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('saveProject failed:', message);
      useEditorStore.setState({ saveError: message });
    });
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  currentSlideId: null,
  mode: 'editor',
  saving: false,
  saveError: undefined,
  logoSaveUnavailable: false,

  loadProject: (project) => set({ project, currentSlideId: project.slides[0]?.id ?? null, mode: 'editor' }),

  setMode: (mode) => set({ mode }),

  selectSlide: (id) => set({ currentSlideId: id }),

  goNext: () => {
    const { project, currentSlideId, mode } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const next = step(project.slides, idx, 1, mode === 'presenter');
    if (next) set({ currentSlideId: next.id });
  },

  goPrev: () => {
    const { project, currentSlideId, mode } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const prev = step(project.slides, idx, -1, mode === 'presenter');
    if (prev) set({ currentSlideId: prev.id });
  },

  toggleSkip: (id) => {
    const { project } = get();
    if (!project) return;
    const slides = project.slides.map((s) => (s.id === id ? { ...s, skipped: !s.skipped || undefined } : s));
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  updateField: (field, value) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, fields: { ...s.fields, [field]: value } } : s
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  addSlide: (layout: SlideLayout = 'title-content') => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const slide = createSlide(layout);
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, slide);
    const next = { ...project, slides };
    set({ project: next, currentSlideId: slide.id });
    persist(next);
  },

  addSlides: (incoming: Slide[]) => {
    const { project, currentSlideId } = get();
    if (!project || incoming.length === 0) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, ...incoming);
    const next = { ...project, slides };
    // Land on the first inserted slide, so a bulk insert is visibly where it went.
    set({ project: next, currentSlideId: incoming[0].id });
    persist(next);
  },

  addConceptSlide: (slide: Slide) => {
    const { project } = get();
    if (!project) return;
    const pillarId = slide.conceptOrigin?.pillarId;
    const slides = [...project.slides];

    // Land next to the pillar it belongs to, so toggling concepts on in any
    // order still builds a coherent section rather than scattering them.
    let at = slides.length;
    if (pillarId) {
      const last = slides.map((s, i) => (s.conceptOrigin?.pillarId === pillarId ? i : -1)).filter((i) => i >= 0).pop();
      if (last !== undefined) at = last + 1;
    }
    slides.splice(at, 0, slide);

    const next = { ...project, slides };
    set({ project: next, currentSlideId: slide.id });
    persist(next);
  },

  addStyledSlide: (style: SlideStyleKind) => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const slide = createStyledSlide(style);
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, slide);
    const next = { ...project, slides };
    set({ project: next, currentSlideId: slide.id });
    persist(next);
  },

  removeSlide: (id) => {
    const { project } = get();
    if (!project || project.slides.length <= 1) return;
    const idx = project.slides.findIndex((s) => s.id === id);
    // Links hold slide ids, so deleting a target would otherwise leave chips and
    // hotspots pointing nowhere — silently doing nothing when clicked.
    const slides = project.slides.filter((s) => s.id !== id).map((s) => dropLinksTo(s, id));
    const next = { ...project, slides };
    const fallback = slides[Math.max(0, idx - 1)]?.id ?? slides[0]?.id ?? null;
    set((state) => ({ project: next, currentSlideId: state.currentSlideId === id ? fallback : state.currentSlideId }));
    persist(next);
  },

  changeLayout: (layout) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, layout, style: 'standard' as const, fields: defaultFieldsForLayout(layout) } : s
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  changeStyle: (style) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId
        ? {
            ...s,
            style,
            layout: (style === 'section-starter' ? 'title-slide' : 'title-content') as SlideLayout,
            fields: defaultFieldsForStyle(style),
          }
        : s
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  setBrandOverride: (brand) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => (s.id === currentSlideId ? { ...s, brandOverride: brand } : s));
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  setClientLogo: (dataUrl) => {
    const { project } = get();
    if (!project) return;
    const next = { ...project, clientLogo: dataUrl };
    set({ project: next });
    persist(next);
  },

  setAccentColor: (hex) => {
    const { project } = get();
    if (!project) return;
    const next = { ...project, accentColor: hex };
    set({ project: next });
    persist(next);
  },

  setFontFamily: (font) => {
    const { project } = get();
    if (!project) return;
    const next = { ...project, fontFamily: font };
    set({ project: next });
    persist(next);
  },

  setTypography: (patch) => {
    const { project } = get();
    if (!project) return;
    const next = { ...project, typography: { ...project.typography, ...patch } };
    set({ project: next });
    persist(next);
  },

  setSlideTypographyOverride: (patch) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, typographyOverride: { ...s.typographyOverride, ...patch } } : s
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  setLinkedSlideIds: (ids) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId
        ? { ...s, fields: { ...s.fields, linkedSlideIds: ids.length ? ids : undefined } }
        : s,
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  addStatItem: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const stats = [...(s.fields.stats ?? [])];
      const last = stats[stats.length - 1];
      stats.push({ id: makeId('stat'), value: last?.value ?? '0', label: last?.label ?? 'New stat' });
      return { ...s, fields: { ...s.fields, stats } };
    });
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  removeStatItem: (statId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const stats = (s.fields.stats ?? []).filter((st) => st.id !== statId);
      return stats.length ? { ...s, fields: { ...s.fields, stats } } : s;
    });
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  addMergeItem: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const items = [...(s.fields.items ?? [])];
      items.push({ id: makeId('item'), label: 'New item' });
      return { ...s, fields: { ...s.fields, items } };
    });
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  removeMergeItem: (itemId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const items = (s.fields.items ?? []).filter((it) => it.id !== itemId);
      return items.length ? { ...s, fields: { ...s.fields, items } } : s;
    });
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  addPoint: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, points: [...(sl.fields.points ?? []), { id: makeId('point'), label: 'New point' }] } }
        : sl,
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  removePoint: (pointId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, points: (sl.fields.points ?? []).filter((pt) => pt.id !== pointId) } }
        : sl,
    );
    const next = { ...project, slides };
    set({ project: next });
    persist(next);
  },

  currentSlide: () => {
    const { project, currentSlideId } = get();
    return project?.slides.find((s) => s.id === currentSlideId) ?? null;
  },

  currentIndex: () => {
    const { project, currentSlideId } = get();
    if (!project) return -1;
    return project.slides.findIndex((s) => s.id === currentSlideId);
  },
}));
