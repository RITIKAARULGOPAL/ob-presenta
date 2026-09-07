import { create } from 'zustand';
import { createSlide, createStyledSlide, defaultFieldsForLayout, defaultFieldsForStyle } from './slideDefaults';
import { saveProject } from './data';
import { makeId } from './id';
import type { Project, Slide, SlideFields, SlideLayout, SlideStyleKind } from '@/types/slide';

type Mode = 'editor' | 'presenter';

interface EditorState {
  project: Project | null;
  currentSlideId: string | null;
  mode: Mode;
  saving: boolean;

  loadProject: (project: Project) => void;
  setMode: (mode: Mode) => void;
  selectSlide: (id: string) => void;
  goNext: () => void;
  goPrev: () => void;

  updateField: <K extends keyof SlideFields>(field: K, value: SlideFields[K]) => void;
  addSlide: (layout?: SlideLayout) => void;
  addStyledSlide: (style: SlideStyleKind) => void;
  removeSlide: (id: string) => void;
  changeLayout: (layout: SlideLayout) => void;
  changeStyle: (style: SlideStyleKind) => void;

  addStatItem: () => void;
  removeStatItem: (statId: string) => void;
  addMergeItem: () => void;
  removeMergeItem: (itemId: string) => void;

  currentSlide: () => Slide | null;
  currentIndex: () => number;
}

function persist(project: Project) {
  // fire-and-forget; the data layer is the single place this becomes a real
  // network call once Supabase is wired in.
  void saveProject(project);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  currentSlideId: null,
  mode: 'editor',
  saving: false,

  loadProject: (project) => set({ project, currentSlideId: project.slides[0]?.id ?? null, mode: 'editor' }),

  setMode: (mode) => set({ mode }),

  selectSlide: (id) => set({ currentSlideId: id }),

  goNext: () => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const next = project.slides[idx + 1];
    if (next) set({ currentSlideId: next.id });
  },

  goPrev: () => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const prev = project.slides[idx - 1];
    if (prev) set({ currentSlideId: prev.id });
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
    const slides = project.slides.filter((s) => s.id !== id);
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
