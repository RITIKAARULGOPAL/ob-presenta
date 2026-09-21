import { create } from 'zustand';
import { cloneSlide, createSlide, createStyledSlide, defaultFieldsForLayout, defaultFieldsForStyle } from './slideDefaults';
import { optionalColumnsMissing, saveProject } from './data';
import { makeId } from './id';
import type { Brand, FontPairing, ImageTransform, Project, Slide, SlideBackground, SlideFields, SlideLayout, SlideStyleKind, TypographySettings } from '@/types/slide';

type Mode = 'editor' | 'presenter';

interface EditorState {
  project: Project | null;
  currentSlideId: string | null;
  mode: Mode;
  /** 'idle' until the first edit of this session — there's nothing to report
   *  about a save that hasn't been attempted yet. */
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';
  saveError?: string;
  logoSaveUnavailable: boolean;
  /** Past/future project snapshots for undo/redo — see commitProject below.
   *  Reset on every loadProject, since this is one global store reused across
   *  whichever project is currently open; carrying another project's history
   *  across a navigation would let undo silently restore the wrong deck. */
  undoStack: Project[];
  redoStack: Project[];
  /** Slide-rail multi-selection — purely a UI concern, never persisted or
   *  pushed onto undo/redo history. `selectionAnchor` is the last
   *  plain/toggle click, used as the fixed end of a shift-click range. */
  selectedSlideIds: string[];
  selectionAnchor: string | null;

  loadProject: (project: Project) => void;
  setMode: (mode: Mode) => void;
  /** 'none' (default) selects just this slide, clearing any multi-selection —
   *  every existing caller (nav dots, linked-slide chips, hotspot jumps) gets
   *  this by just passing an id. 'toggle'/'range' are the slide rail's own
   *  ctrl/shift-click behavior, matching Figma/Slides' filmstrip. */
  selectSlide: (id: string, modifier?: 'none' | 'toggle' | 'range') => void;
  clearSlideSelection: () => void;
  selectAllSlides: () => void;
  goNext: () => void;
  goPrev: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  updateField: <K extends keyof SlideFields>(field: K, value: SlideFields[K]) => void;
  addSlide: (layout?: SlideLayout) => void;
  addSlides: (slides: Slide[]) => void;
  addConceptSlide: (slide: Slide) => void;
  addStyledSlide: (style: SlideStyleKind) => void;
  duplicateSlide: (id: string) => void;
  duplicateSlides: (ids: string[]) => void;
  removeSlide: (id: string) => void;
  removeSlides: (ids: string[]) => void;
  /** Drag-to-reorder. `toIndex` is an insertion point counted against the
   *  slide's *current* (pre-move) order — 0..slides.length, where N possible
   *  insertion points sit before each of the N slides plus one at the very
   *  end (index N). The caller (the slide rail) derives this from which half
   *  of a drop target it's hovering. */
  moveSlide: (id: string, toIndex: number) => void;
  toggleSkip: (id: string) => void;
  toggleSkipMany: (ids: string[]) => void;
  changeLayout: (layout: SlideLayout) => void;
  changeStyle: (style: SlideStyleKind) => void;
  setBrandOverride: (brand: Brand | undefined) => void;
  setClientLogo: (dataUrl: string | undefined) => void;
  setClientLogoTransform: (transform: ImageTransform | undefined) => void;
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
  /** Merges into this slide's own background override (color/image/opacity) —
   *  pass just the key you're changing. */
  setSlideBackground: (patch: Partial<SlideBackground>) => void;
  /** Clears the slide's whole background override, back to the style's usual
   *  white/dark-veil default. */
  resetSlideBackground: () => void;

  addStatItem: () => void;
  removeStatItem: (statId: string) => void;
  addMergeItem: () => void;
  removeMergeItem: (itemId: string) => void;
  addPoint: () => void;
  removePoint: (pointId: string) => void;
  addOrbitNode: () => void;
  removeOrbitNode: (nodeId: string) => void;

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
  // or they keep editing a deck that isn't being written anywhere. Status
  // flips to 'saving' synchronously so the indicator shows immediately, not
  // just once the network round-trip resolves.
  useEditorStore.setState({ saveStatus: 'saving' });
  void saveProject(project)
    .then(() =>
      useEditorStore.setState({ saveStatus: 'saved', saveError: undefined, logoSaveUnavailable: optionalColumnsMissing() }),
    )
    .catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      console.error('saveProject failed:', message);
      useEditorStore.setState({ saveStatus: 'error', saveError: message });
    });
}

const MAX_HISTORY = 50;

/** Every mutating action funnels its new project through here instead of
 *  calling `set`/`persist` directly — this is the one choke point that makes
 *  undo/redo possible without instrumenting every action's own undo logic.
 *  Pushing the *previous* project onto undoStack (not the new one) is what
 *  makes undo just "pop and restore" rather than needing an inverse for every
 *  kind of edit. Any new edit clears the redo branch — standard semantics,
 *  you can't redo past a point where you've since made a different change.
 *  Capped so a long session doesn't grow history unboundedly; each entry is
 *  a reference to a past Project, not a deep clone, since every action here
 *  already builds `next` immutably — see slide.ts's own header comment, this
 *  is exactly the "undo/redo without a diff engine" it was written for. */
function commitProject(next: Project, extra?: Partial<Pick<EditorState, 'currentSlideId'>>) {
  const { project, undoStack } = useEditorStore.getState();
  useEditorStore.setState({
    project: next,
    undoStack: project ? [...undoStack, project].slice(-MAX_HISTORY) : undoStack,
    redoStack: [],
    ...extra,
  });
  persist(next);
}

export const useEditorStore = create<EditorState>((set, get) => ({
  project: null,
  currentSlideId: null,
  mode: 'editor',
  saveStatus: 'idle',
  saveError: undefined,
  logoSaveUnavailable: false,
  undoStack: [],
  redoStack: [],
  selectedSlideIds: [],
  selectionAnchor: null,

  loadProject: (project) =>
    set({
      project,
      currentSlideId: project.slides[0]?.id ?? null,
      mode: 'editor',
      undoStack: [],
      redoStack: [],
      selectedSlideIds: [],
      selectionAnchor: null,
    }),

  setMode: (mode) => set({ mode }),

  selectSlide: (id, modifier = 'none') => {
    const { project, selectedSlideIds, selectionAnchor } = get();

    if (modifier === 'toggle') {
      const has = selectedSlideIds.includes(id);
      set({
        currentSlideId: id,
        selectedSlideIds: has ? selectedSlideIds.filter((x) => x !== id) : [...selectedSlideIds, id],
        selectionAnchor: id,
      });
      return;
    }

    if (modifier === 'range' && project) {
      const ids = project.slides.map((s) => s.id);
      const anchorIdx = ids.indexOf(selectionAnchor ?? id);
      const clickedIdx = ids.indexOf(id);
      if (anchorIdx !== -1 && clickedIdx !== -1) {
        const [lo, hi] = anchorIdx < clickedIdx ? [anchorIdx, clickedIdx] : [clickedIdx, anchorIdx];
        set({ currentSlideId: id, selectedSlideIds: ids.slice(lo, hi + 1) });
        return;
      }
    }

    set({ currentSlideId: id, selectedSlideIds: [id], selectionAnchor: id });
  },

  clearSlideSelection: () => set({ selectedSlideIds: [], selectionAnchor: null }),

  selectAllSlides: () => {
    const { project } = get();
    if (!project) return;
    set({ selectedSlideIds: project.slides.map((s) => s.id) });
  },

  goNext: () => {
    const { project, currentSlideId, mode } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const next = step(project.slides, idx, 1, mode === 'presenter');
    if (next) set({ currentSlideId: next.id, selectedSlideIds: [next.id], selectionAnchor: next.id });
  },

  goPrev: () => {
    const { project, currentSlideId, mode } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const prev = step(project.slides, idx, -1, mode === 'presenter');
    if (prev) set({ currentSlideId: prev.id, selectedSlideIds: [prev.id], selectionAnchor: prev.id });
  },

  undo: () => {
    const { project, currentSlideId, undoStack, redoStack } = get();
    if (!project || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    // If the selected slide didn't survive the trip back, fall back to the
    // first slide rather than leaving the canvas blank on a stale id.
    const stillSelected = previous.slides.some((s) => s.id === currentSlideId);
    set({
      project: previous,
      currentSlideId: stillSelected ? currentSlideId : (previous.slides[0]?.id ?? null),
      undoStack: undoStack.slice(0, -1),
      redoStack: [...redoStack, project].slice(-MAX_HISTORY),
    });
    persist(previous);
  },

  redo: () => {
    const { project, currentSlideId, undoStack, redoStack } = get();
    if (!project || redoStack.length === 0) return;
    const nextProject = redoStack[redoStack.length - 1];
    const stillSelected = nextProject.slides.some((s) => s.id === currentSlideId);
    set({
      project: nextProject,
      currentSlideId: stillSelected ? currentSlideId : (nextProject.slides[0]?.id ?? null),
      undoStack: [...undoStack, project].slice(-MAX_HISTORY),
      redoStack: redoStack.slice(0, -1),
    });
    persist(nextProject);
  },

  canUndo: () => get().undoStack.length > 0,
  canRedo: () => get().redoStack.length > 0,

  toggleSkip: (id) => {
    const { project } = get();
    if (!project) return;
    const slides = project.slides.map((s) => (s.id === id ? { ...s, skipped: !s.skipped || undefined } : s));
    commitProject({ ...project, slides });
  },

  toggleSkipMany: (ids) => {
    const { project } = get();
    if (!project || ids.length === 0) return;
    const idSet = new Set(ids);
    // Mixed-state selection resolves the same way a tri-state checkbox does:
    // only flip everyone to "included" once every selected slide is already
    // skipped, otherwise skip whichever aren't yet.
    const allSkipped = project.slides.filter((s) => idSet.has(s.id)).every((s) => s.skipped);
    const slides = project.slides.map((s) => (idSet.has(s.id) ? { ...s, skipped: allSkipped ? undefined : true } : s));
    commitProject({ ...project, slides });
  },

  updateField: (field, value) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slide = project.slides.find((s) => s.id === currentSlideId);
    // EditableText fires onBlur unconditionally, even when the field's text
    // never actually changed (e.g. clicking straight from one field to a
    // toolbar button blurs the first field with its own unchanged value) —
    // without this guard, that harmless blur still pushed a no-op entry onto
    // undoStack, so the *first* Undo after finishing an edit silently undid
    // nothing visible instead of the real change.
    if (!slide || slide.fields[field] === value) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, fields: { ...s.fields, [field]: value } } : s
    );
    commitProject({ ...project, slides });
  },

  addSlide: (layout: SlideLayout = 'title-content') => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const slide = createSlide(layout);
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, slide);
    commitProject({ ...project, slides }, { currentSlideId: slide.id });
  },

  addSlides: (incoming: Slide[]) => {
    const { project, currentSlideId } = get();
    if (!project || incoming.length === 0) return;
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, ...incoming);
    // Land on the first inserted slide, so a bulk insert is visibly where it went.
    commitProject({ ...project, slides }, { currentSlideId: incoming[0].id });
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

    commitProject({ ...project, slides }, { currentSlideId: slide.id });
  },

  addStyledSlide: (style: SlideStyleKind) => {
    const { project, currentSlideId } = get();
    if (!project) return;
    const slide = createStyledSlide(style);
    const idx = project.slides.findIndex((s) => s.id === currentSlideId);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, slide);
    commitProject({ ...project, slides }, { currentSlideId: slide.id });
  },

  duplicateSlide: (id) => {
    const { project } = get();
    if (!project) return;
    const idx = project.slides.findIndex((s) => s.id === id);
    if (idx === -1) return;
    const clone = cloneSlide(project.slides[idx]);
    const slides = [...project.slides];
    slides.splice(idx + 1, 0, clone);
    commitProject({ ...project, slides }, { currentSlideId: clone.id });
  },

  duplicateSlides: (ids) => {
    const { project } = get();
    if (!project || ids.length === 0) return;
    const idSet = new Set(ids);
    // Land the clones together right after the last selected slide, keeping
    // their relative order — same "land next to where you were" convention
    // as every other bulk-insert action in this store.
    const insertAfter = project.slides.reduce((last, s, i) => (idSet.has(s.id) ? i : last), -1);
    const clones = project.slides.filter((s) => idSet.has(s.id)).map(cloneSlide);
    if (clones.length === 0) return;
    const slides = [...project.slides];
    slides.splice(insertAfter + 1, 0, ...clones);
    commitProject({ ...project, slides }, { currentSlideId: clones[0].id });
    set({ selectedSlideIds: clones.map((c) => c.id), selectionAnchor: clones[0].id });
  },

  moveSlide: (id, toIndex) => {
    const { project } = get();
    if (!project) return;
    const fromIdx = project.slides.findIndex((s) => s.id === id);
    if (fromIdx === -1) return;
    // Removing the dragged slide shifts every later index back by one, so an
    // insertion point counted against the *original* order needs adjusting
    // before it's used against the post-removal array.
    const adjusted = toIndex > fromIdx ? toIndex - 1 : toIndex;
    const insertAt = Math.max(0, Math.min(adjusted, project.slides.length - 1));
    if (insertAt === fromIdx) return; // dropped back where it started
    const slides = [...project.slides];
    const [moved] = slides.splice(fromIdx, 1);
    slides.splice(insertAt, 0, moved);
    commitProject({ ...project, slides });
  },

  removeSlide: (id) => {
    const { project, currentSlideId } = get();
    if (!project || project.slides.length <= 1) return;
    const idx = project.slides.findIndex((s) => s.id === id);
    // Links hold slide ids, so deleting a target would otherwise leave chips and
    // hotspots pointing nowhere — silently doing nothing when clicked.
    const slides = project.slides.filter((s) => s.id !== id).map((s) => dropLinksTo(s, id));
    const fallback = slides[Math.max(0, idx - 1)]?.id ?? slides[0]?.id ?? null;
    commitProject({ ...project, slides }, { currentSlideId: currentSlideId === id ? fallback : currentSlideId });
  },

  removeSlides: (ids) => {
    const { project, currentSlideId, selectedSlideIds } = get();
    if (!project || ids.length === 0) return;
    const idSet = new Set(ids);
    if (project.slides.length - idSet.size < 1) return; // must keep at least one slide
    const firstRemovedIdx = project.slides.findIndex((s) => idSet.has(s.id));
    const slides = project.slides
      .filter((s) => !idSet.has(s.id))
      .map((s) => ids.reduce((acc, removedId) => dropLinksTo(acc, removedId), s));
    const fallback = slides[Math.max(0, firstRemovedIdx - 1)]?.id ?? slides[0]?.id ?? null;
    commitProject(
      { ...project, slides },
      { currentSlideId: idSet.has(currentSlideId ?? '') ? fallback : currentSlideId },
    );
    set({ selectedSlideIds: selectedSlideIds.filter((id) => !idSet.has(id)), selectionAnchor: null });
  },

  changeLayout: (layout) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, layout, style: 'standard' as const, fields: defaultFieldsForLayout(layout) } : s
    );
    commitProject({ ...project, slides });
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
    commitProject({ ...project, slides });
  },

  setBrandOverride: (brand) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => (s.id === currentSlideId ? { ...s, brandOverride: brand } : s));
    commitProject({ ...project, slides });
  },

  setClientLogo: (dataUrl) => {
    const { project } = get();
    if (!project) return;
    // A new logo very likely has a different shape than the old one, so a
    // rotation/zoom picked for the previous file is more likely to look wrong
    // than right on the replacement.
    commitProject({ ...project, clientLogo: dataUrl, clientLogoTransform: undefined });
  },

  setClientLogoTransform: (transform) => {
    const { project } = get();
    if (!project) return;
    commitProject({ ...project, clientLogoTransform: transform });
  },

  setAccentColor: (hex) => {
    const { project } = get();
    if (!project) return;
    commitProject({ ...project, accentColor: hex });
  },

  setFontFamily: (font) => {
    const { project } = get();
    if (!project) return;
    commitProject({ ...project, fontFamily: font });
  },

  setTypography: (patch) => {
    const { project } = get();
    if (!project) return;
    commitProject({ ...project, typography: { ...project.typography, ...patch } });
  },

  setSlideTypographyOverride: (patch) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, typographyOverride: { ...s.typographyOverride, ...patch } } : s
    );
    commitProject({ ...project, slides });
  },

  setSlideBackground: (patch) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId ? { ...s, background: { ...s.background, ...patch } } : s,
    );
    commitProject({ ...project, slides });
  },

  resetSlideBackground: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => (s.id === currentSlideId ? { ...s, background: undefined } : s));
    commitProject({ ...project, slides });
  },

  setLinkedSlideIds: (ids) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) =>
      s.id === currentSlideId
        ? { ...s, fields: { ...s.fields, linkedSlideIds: ids.length ? ids : undefined } }
        : s,
    );
    commitProject({ ...project, slides });
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
    commitProject({ ...project, slides });
  },

  removeStatItem: (statId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const stats = (s.fields.stats ?? []).filter((st) => st.id !== statId);
      return stats.length ? { ...s, fields: { ...s.fields, stats } } : s;
    });
    commitProject({ ...project, slides });
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
    commitProject({ ...project, slides });
  },

  removeMergeItem: (itemId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((s) => {
      if (s.id !== currentSlideId) return s;
      const items = (s.fields.items ?? []).filter((it) => it.id !== itemId);
      return items.length ? { ...s, fields: { ...s.fields, items } } : s;
    });
    commitProject({ ...project, slides });
  },

  addPoint: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, points: [...(sl.fields.points ?? []), { id: makeId('point'), label: 'New point' }] } }
        : sl,
    );
    commitProject({ ...project, slides });
  },

  removePoint: (pointId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, points: (sl.fields.points ?? []).filter((pt) => pt.id !== pointId) } }
        : sl,
    );
    commitProject({ ...project, slides });
  },

  addOrbitNode: () => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, orbitNodes: [...(sl.fields.orbitNodes ?? []), { id: makeId('orbit'), label: 'New node' }] } }
        : sl,
    );
    commitProject({ ...project, slides });
  },

  removeOrbitNode: (nodeId) => {
    const { project, currentSlideId } = get();
    if (!project || !currentSlideId) return;
    const slides = project.slides.map((sl) =>
      sl.id === currentSlideId
        ? { ...sl, fields: { ...sl.fields, orbitNodes: (sl.fields.orbitNodes ?? []).filter((n) => n.id !== nodeId) } }
        : sl,
    );
    commitProject({ ...project, slides });
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
