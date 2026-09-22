'use client';

import { use, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProject, optionalColumnsMissing } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRail } from '@/components/SlideRail';
import { SlideRenderer } from '@/components/SlideRenderer';
import { ScaledStage } from '@/components/ScaledStage';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ConceptLibraryDropdown } from '@/components/ConceptLibraryDropdown';
import { ThemeToggle } from '@/components/ThemeToggle';
import { exportToPdf, exportToPptx } from '@/lib/exportDeck';
import { DESIGN_PILLARS } from '@/lib/conceptLibrary';
import { conceptSlide } from '@/lib/conceptSlides';
import {
  IconBulb, IconTextBlock, IconStar, IconBars, IconLink, IconFile, IconScreen, IconImage,
  IconUndo, IconRedo, IconPlay, IconDownload, IconPlus, IconMinus, IconChevronDown,
  IconCopy, IconEyeOff, IconEye, IconTrash, IconGrid, IconLayers,
} from '@/components/icons';
import { Button, IconButton, ToolbarDivider } from '@/components/ui/Button';
import { Menu, MenuItem, MenuLabel, MenuSeparator, Kbd } from '@/components/ui/Menu';
import { LAYOUT_LABELS, STYLE_LABELS } from '@/lib/slideDefaults';
import type { SlideLayout, SlideStyleKind } from '@/types/slide';
import { clamp } from '@/lib/imageTransform';

const ECOM_PILLAR = DESIGN_PILLARS.find((p) => p.id === 'ecom-express');
const ZOOM_MIN = 0.5;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;
const ZOOM_DEFAULT = 1;

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [showConceptPicker, setShowConceptPicker] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [zoomFactor, setZoomFactor] = useState(ZOOM_DEFAULT);
  const stageAreaRef = useRef<HTMLDivElement>(null);

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const addSlide = useEditorStore((s) => s.addSlide);
  const addSlides = useEditorStore((s) => s.addSlides);
  const undo = useEditorStore((s) => s.undo);
  const redo = useEditorStore((s) => s.redo);
  const canUndo = useEditorStore((s) => s.canUndo());
  const canRedo = useEditorStore((s) => s.canRedo());
  const selectedSlideIds = useEditorStore((s) => s.selectedSlideIds);
  const clearSlideSelection = useEditorStore((s) => s.clearSlideSelection);
  const selectAllSlides = useEditorStore((s) => s.selectAllSlides);
  const removeSlide = useEditorStore((s) => s.removeSlide);
  const removeSlides = useEditorStore((s) => s.removeSlides);
  const duplicateSlide = useEditorStore((s) => s.duplicateSlide);
  const duplicateSlides = useEditorStore((s) => s.duplicateSlides);
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);
  const saveError = useEditorStore((s) => s.saveError);
  const saveStatus = useEditorStore((s) => s.saveStatus);
  const logoSaveUnavailable = useEditorStore((s) => s.logoSaveUnavailable);
  const changeLayout = useEditorStore((s) => s.changeLayout);
  const changeStyle = useEditorStore((s) => s.changeStyle);
  const toggleSkip = useEditorStore((s) => s.toggleSkip);

  useEffect(() => {
    // The home page preloads a just-created project straight into the store
    // (see page.tsx) so its logo/accent survive even if the database is
    // missing the optional columns for them — re-fetching here would
    // overwrite that in-memory copy with the (possibly stripped) saved row.
    if (useEditorStore.getState().project?.id === id) {
      useEditorStore.setState({ logoSaveUnavailable: optionalColumnsMissing() });
      return;
    }
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
        useEditorStore.setState({ logoSaveUnavailable: optionalColumnsMissing() });
      } else setNotFound(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    // A native listener, not React's own onWheel — React's is passive and
    // can't preventDefault, so Ctrl+wheel would zoom the whole browser page
    // (native pinch-zoom) at the same time it zoomed the canvas. Registered
    // once with empty deps; setZoomFactor's functional form means it never
    // needs to close over the latest zoomFactor.
    const el = stageAreaRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!(e.ctrlKey || e.metaKey)) return; // plain wheel/trackpad scrolls (pans) the canvas natively
      e.preventDefault();
      setZoomFactor((z) => clamp(z + (e.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP), ZOOM_MIN, ZOOM_MAX));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Escape clears a multi-selection even mid-edit (harmless either way),
      // but every other shortcut below is deck-level, not text editing — a
      // field mid-edit has its own native handling for Z/Delete/arrows/etc.
      // (e.g. Ctrl+Z there reverts keystrokes in that one field, which is
      // right: the deck-level undo below only has snapshots at blur-time,
      // see EditableText, so hijacking it here would feel like "did nothing"
      // while the caret's still in a field).
      if (e.key === 'Escape') {
        if (selectedSlideIds.length > 1) clearSlideSelection();
        return;
      }

      const active = document.activeElement;
      const isEditingText =
        active instanceof HTMLElement && (active.isContentEditable || active.tagName === 'INPUT' || active.tagName === 'TEXTAREA');
      if (isEditingText) return;

      const currentSlideId = currentSlide?.id;
      const mod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedSlideIds.length > 1) removeSlides(selectedSlideIds);
        else if (currentSlideId) removeSlide(currentSlideId);
        return;
      }

      if (mod && !e.shiftKey && key === 'z') {
        e.preventDefault();
        undo();
        return;
      }
      if (mod && (key === 'y' || (e.shiftKey && key === 'z'))) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && key === 'd') {
        e.preventDefault();
        if (selectedSlideIds.length > 1) duplicateSlides(selectedSlideIds);
        else if (currentSlideId) duplicateSlide(currentSlideId);
        return;
      }
      if (mod && key === 'a') {
        e.preventDefault();
        selectAllSlides();
        return;
      }
      if (mod && (key === '=' || key === '+')) {
        e.preventDefault();
        setZoomFactor((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
        return;
      }
      if (mod && key === '-') {
        e.preventDefault();
        setZoomFactor((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX));
        return;
      }
      if (mod && key === '0') {
        e.preventDefault();
        setZoomFactor(ZOOM_DEFAULT);
        return;
      }
      if (!mod && !e.shiftKey && !e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        if (e.key === 'ArrowUp') goPrev();
        else goNext();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    undo,
    redo,
    selectedSlideIds,
    clearSlideSelection,
    selectAllSlides,
    removeSlide,
    removeSlides,
    duplicateSlide,
    duplicateSlides,
    goNext,
    goPrev,
    currentSlide,
  ]);

  async function handleExport(kind: 'pdf' | 'pptx') {
    if (!project) return;
    try {
      const run = kind === 'pdf' ? exportToPdf : exportToPptx;
      await run(project, (current, total) => setExportStatus(`Rendering slide ${current} of ${total}…`));
    } catch (err) {
      console.error(`Export to ${kind} failed:`, err);
      setExportStatus(`Export failed — see console for details.`);
      setTimeout(() => setExportStatus(''), 4000);
      return;
    }
    setExportStatus('');
  }

  if (notFound) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-ui-ink-2">
        <p>Couldn&apos;t find that project.</p>
        <Link href="/" className="text-ui-accent underline">Back to Presenta</Link>
      </div>
    );
  }

  if (!project || project.id !== id) {
    return <div className="flex h-screen items-center justify-center text-ui-ink-3">Loading…</div>;
  }

  const saveBanner = saveError ? (
    <div className="shrink-0 bg-ui-danger-soft px-4 py-2 text-[12px] text-ui-danger-ink">
      <strong className="font-semibold">Changes aren&apos;t being saved.</strong> {saveError}
    </div>
  ) : logoSaveUnavailable ? (
    <div className="shrink-0 bg-ui-warn-soft px-4 py-2 text-[12px] text-ui-warn-ink">
      <strong className="font-semibold">Slides are saving, but the client logo, accent colour, font choice and deck-wide typography defaults aren&apos;t.</strong>{' '}
      The database is missing those columns — run migrations 0003_add_client_logo.sql, 0004_add_font_family.sql and 0005_add_typography.sql to enable them.
    </div>
  ) : null;

  // Idle (no edit yet this session) shows nothing — there's nothing to
  // report about a save that hasn't been attempted. Once one has, this
  // stays visible so the indicator doesn't disappear the moment a save
  // finishes, matching the always-present status text in Docs/Slides.
  const saveStatusLabel =
    saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? 'Saved' : saveStatus === 'error' ? 'Save failed' : null;

  const layouts = Object.keys(LAYOUT_LABELS) as SlideLayout[];
  const styles = Object.keys(STYLE_LABELS) as SlideStyleKind[];
  const shownIndex = project.slides.filter((sl) => !sl.skipped).findIndex((sl) => sl.id === currentSlide?.id);

  return (
    <div className="flex h-screen flex-col bg-ui-bg">
      {saveBanner}

      {/* Row 1 — the deck: what this file is, and what you do with the whole
          of it. Nothing here changes a slide. */}
      <header className="flex h-12 flex-shrink-0 items-center gap-2 border-b border-ui-line bg-ui-surface px-3">
        <Link
          href="/"
          aria-label="All presentations"
          title="All presentations"
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-ui-sm bg-ui-accent font-display text-label font-extrabold text-ui-accent-on"
        >
          P
        </Link>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-ctl font-semibold tracking-[-0.01em] text-ui-ink">{project.name}</span>
          <span className="hidden shrink-0 text-micro text-ui-ink-3 sm:inline">by {project.preparedBy}</span>
        </div>
        {saveStatusLabel && (
          <span
            className={`flex shrink-0 items-center gap-1.5 text-micro font-medium ${
              saveStatus === 'error' ? 'text-ui-danger' : 'text-ui-ink-3'
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                saveStatus === 'saving'
                  ? 'animate-pulse bg-amber-400'
                  : saveStatus === 'error'
                    ? 'bg-ui-danger'
                    : 'bg-emerald-500'
              }`}
            />
            {saveStatusLabel}
          </span>
        )}

        <span className="flex-1" />

        <IconButton label="Undo" title="Undo (Ctrl/⌘+Z)" icon={<IconUndo className="h-[15px] w-[15px]" />} onClick={() => undo()} disabled={!canUndo} />
        <IconButton label="Redo" title="Redo (Ctrl/⌘+Y)" icon={<IconRedo className="h-[15px] w-[15px]" />} onClick={() => redo()} disabled={!canRedo} />
        <ToolbarDivider />
        <ThemeToggle />
        <ToolbarDivider />

        <Menu
          width="w-60"
          trigger={({ onClick, ...a11y }) => (
            <Button variant="ghost" icon={<IconPlus className="h-[15px] w-[15px]" />} trailing={<IconChevronDown className="h-3 w-3 opacity-60" />} onClick={onClick} {...a11y}>
              Add slide
            </Button>
          )}
        >
          <MenuItem icon={<IconBulb className="h-[15px] w-[15px]" />} tone="accent" onClick={() => setShowConceptPicker(true)}>
            Concept library…
          </MenuItem>
          <MenuSeparator />
          <MenuItem icon={<IconTextBlock className="h-[15px] w-[15px]" />} onClick={() => addSlide('title-content')}>Title + Content</MenuItem>
          <MenuItem icon={<IconStar className="h-[15px] w-[15px]" />} onClick={() => addSlide('merge-diagram')}>Merge Diagram</MenuItem>
          <MenuItem icon={<IconBars className="h-[15px] w-[15px]" />} onClick={() => addSlide('stat-hero')}>Stat Hero</MenuItem>
          <MenuItem icon={<IconLink className="h-[15px] w-[15px]" />} onClick={() => addSlide('linked-views')}>Linked Views</MenuItem>
          {ECOM_PILLAR && (
            <>
              <MenuSeparator />
              <MenuLabel>{ECOM_PILLAR.title}</MenuLabel>
              {ECOM_PILLAR.concepts.map((concept) => (
                <MenuItem key={concept.id} icon={<IconImage className="h-[15px] w-[15px]" />} onClick={() => addSlides([conceptSlide(ECOM_PILLAR, concept)])}>
                  {concept.title}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>

        <Menu
          width="w-48"
          trigger={({ onClick, ...a11y }) => (
            <Button variant="ghost" icon={<IconDownload className="h-[15px] w-[15px]" />} trailing={<IconChevronDown className="h-3 w-3 opacity-60" />} onClick={onClick} disabled={!!exportStatus} {...a11y}>
              {exportStatus || 'Export'}
            </Button>
          )}
        >
          <MenuItem icon={<IconFile className="h-[15px] w-[15px]" />} onClick={() => handleExport('pdf')}>Export as PDF</MenuItem>
          <MenuItem icon={<IconScreen className="h-[15px] w-[15px]" />} onClick={() => handleExport('pptx')}>Export as PPTX</MenuItem>
          {project.slides.some((s) => s.layout === 'linked-views') && (
            <p className="border-t border-ui-line-soft px-2.5 pb-1 pt-2 text-micro leading-snug text-ui-ink-3">
              Linked Views slides export only their first view/stage — other tabs and stages won&apos;t appear in the file.
            </p>
          )}
        </Menu>

        <Button variant="primary" icon={<IconPlay className="h-3 w-3" />} onClick={() => router.push(`/p/${project.id}/present`)}>
          Present
        </Button>
      </header>

      {/* Row 2 — the current slide. Layout and Style used to be 18 pills in
          the right panel, always expanded whether or not you were changing
          them; as menu triggers they take one line and say what is set. */}
      <div className="flex h-11 flex-shrink-0 items-center gap-1.5 border-b border-ui-line bg-ui-surface px-3">
        {currentSlide && (
          <>
            <Menu
              align="start"
              width="w-56"
              trigger={({ onClick, ...a11y }) => (
                <Button variant="raised" icon={<IconGrid className="h-[15px] w-[15px]" />} trailing={<IconChevronDown className="h-3 w-3 opacity-60" />} onClick={onClick} {...a11y}>
                  {LAYOUT_LABELS[currentSlide.layout]}
                </Button>
              )}
            >
              <MenuLabel>Slide layout</MenuLabel>
              {layouts.map((k) => (
                <MenuItem
                  key={k}
                  selected={currentSlide.layout === k && currentSlide.style === 'standard'}
                  onClick={() => changeLayout(k)}
                >
                  {LAYOUT_LABELS[k]}
                </MenuItem>
              ))}
            </Menu>

            <Menu
              align="start"
              width="w-52"
              trigger={({ onClick, ...a11y }) => (
                <Button variant="raised" icon={<IconLayers className="h-[15px] w-[15px]" />} trailing={<IconChevronDown className="h-3 w-3 opacity-60" />} onClick={onClick} {...a11y}>
                  {STYLE_LABELS[currentSlide.style]}
                </Button>
              )}
            >
              <MenuLabel>Slide style</MenuLabel>
              {styles.map((k) => (
                <MenuItem key={k} selected={currentSlide.style === k} onClick={() => changeStyle(k)}>
                  {STYLE_LABELS[k]}
                </MenuItem>
              ))}
            </Menu>

            <ToolbarDivider />

            <IconButton label="Duplicate slide" title="Duplicate slide (Ctrl/⌘+D)" icon={<IconCopy className="h-[15px] w-[15px]" />} onClick={() => duplicateSlide(currentSlide.id)} />
            <IconButton
              label={currentSlide.skipped ? 'Include slide again' : 'Skip slide'}
              title={currentSlide.skipped ? 'Include in Presenter and export' : 'Skip in Presenter and export'}
              icon={currentSlide.skipped ? <IconEye className="h-[15px] w-[15px]" /> : <IconEyeOff className="h-[15px] w-[15px]" />}
              active={currentSlide.skipped}
              onClick={() => toggleSkip(currentSlide.id)}
            />
            {project.slides.length > 1 && (
              <IconButton variant="danger" label="Delete slide" title="Delete slide (Delete)" icon={<IconTrash className="h-[15px] w-[15px]" />} onClick={() => removeSlide(currentSlide.id)} />
            )}
          </>
        )}

        <span className="flex-1" />

        <span className="shrink-0 text-micro text-ui-ink-3">
          {currentSlide?.skipped
            ? 'Skipped · not in Presenter or export'
            : `Slide ${shownIndex + 1} of ${project.slides.filter((sl) => !sl.skipped).length}`}
        </span>
      </div>

      <div className="flex min-h-0 flex-1">
        <SlideRail />
        {/* min-w-0 matters: ScaledStage lays its slide out at a literal 1280px and
            only shrinks it visually with transform: scale(), and a transform does
            not change layout size. Without this, a flex item refuses to shrink
            below that 1280px min-content width and the whole editor overflows
            sideways, pushing the properties panel off-screen. The stage has its
            own overflow-auto, so it scrolls internally instead. */}
        <main ref={stageAreaRef} className="relative min-h-0 min-w-0 flex-1 bg-ui-canvas p-8">
          <ScaledStage
            pannable
            zoomFactor={zoomFactor}
            // The slide keeps its own white ground in both themes — it is the page that
            // gets exported, not part of the chrome. Only the frame follows the theme.
            stageClassName="overflow-hidden rounded-lg bg-white shadow-float ring-1 ring-ui-line"
          >
            {currentSlide && <SlideRenderer slide={currentSlide} editable animate />}
          </ScaledStage>

          {/* Zoom belongs to the canvas, so it floats on it rather than living
              in a full-width footer bar the rest of the app had to pay for. */}
          <div className="absolute bottom-4 right-5 flex items-center gap-0.5 rounded-ui-md border border-ui-line bg-ui-surface p-1 shadow-float">
            <IconButton
              size="sm"
              label="Zoom out"
              title="Zoom out (Ctrl/⌘+-)"
              icon={<IconMinus className="h-3.5 w-3.5" />}
              onClick={() => setZoomFactor((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            />
            <button
              type="button"
              onClick={() => setZoomFactor(ZOOM_DEFAULT)}
              title="Reset zoom (Ctrl/⌘+0)"
              className="h-7 w-12 rounded-ui-sm text-label font-semibold text-ui-ink-2 transition-colors duration-150 ease-ui hover:bg-ui-raised hover:text-ui-ink"
            >
              {Math.round(zoomFactor * 100)}%
            </button>
            <IconButton
              size="sm"
              label="Zoom in"
              title="Zoom in (Ctrl/⌘+=)"
              icon={<IconPlus className="h-3.5 w-3.5" />}
              onClick={() => setZoomFactor((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            />
          </div>
        </main>
        <PropertiesPanel />
      </div>

      {showConceptPicker && <ConceptLibraryDropdown onClose={() => setShowConceptPicker(false)} />}

      {/* The shortcuts still need somewhere to be discoverable. This goes when
          the command palette lands and can carry them properly. */}
      <div className="flex h-7 flex-shrink-0 items-center justify-center gap-3 border-t border-ui-line bg-ui-surface px-3 text-micro text-ui-ink-3">
        <span>Click any headline or field to edit it</span>
        <span className="text-ui-line-strong">·</span>
        <span className="flex items-center gap-1"><Kbd>↑</Kbd><Kbd>↓</Kbd> change slide</span>
        <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>D</Kbd> duplicate</span>
        <span className="flex items-center gap-1"><Kbd>⌘</Kbd><Kbd>Z</Kbd> undo</span>
      </div>
    </div>
  );
}
