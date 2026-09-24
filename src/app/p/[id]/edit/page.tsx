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
import { DiagramLibraryDropdown } from '@/components/DiagramLibraryDropdown';
import { exportToPdf, exportToPptx } from '@/lib/exportDeck';
import { DESIGN_PILLARS } from '@/lib/conceptLibrary';
import { conceptSlide } from '@/lib/conceptSlides';
import { IconBulb, IconTextBlock, IconStar, IconBars, IconLink, IconFile, IconScreen, IconImage, IconGrid } from '@/components/icons';
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
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showConceptPicker, setShowConceptPicker] = useState(false);
  const [showDiagramPicker, setShowDiagramPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
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
    setShowExportMenu(false);
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
      <div className="flex h-screen flex-col items-center justify-center gap-4 text-slate-600">
        <p>Couldn&apos;t find that project.</p>
        <Link href="/" className="text-[#0b72c2] underline">Back to Presenta</Link>
      </div>
    );
  }

  if (!project || project.id !== id) {
    return <div className="flex h-screen items-center justify-center text-slate-400">Loading…</div>;
  }

  const saveBanner = saveError ? (
    <div className="shrink-0 bg-red-50 px-4 py-2 text-[12px] text-red-700">
      <strong className="font-semibold">Changes aren&apos;t being saved.</strong> {saveError}
    </div>
  ) : logoSaveUnavailable ? (
    <div className="shrink-0 bg-amber-50 px-4 py-2 text-[12px] text-amber-800">
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

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {saveBanner}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5fa8e8]" />
            {project.name}
            <span className="font-normal text-white/60">· by {project.preparedBy}</span>
          </div>
          {saveStatusLabel && (
            <span
              className={`flex items-center gap-1.5 text-[11px] font-medium ${
                saveStatus === 'error' ? 'text-red-500' : 'text-slate-500'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  saveStatus === 'saving' ? 'animate-pulse bg-amber-400' : saveStatus === 'error' ? 'bg-red-500' : 'bg-emerald-500'
                }`}
              />
              {saveStatusLabel}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            ⌂ Home
          </Link>
          <div className="flex items-center overflow-hidden rounded-full bg-slate-100">
            <button
              onClick={() => undo()}
              disabled={!canUndo}
              title="Undo (Ctrl+Z)"
              aria-label="Undo"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ↶
            </button>
            <span className="h-4 w-px bg-slate-300" />
            <button
              onClick={() => redo()}
              disabled={!canRedo}
              title="Redo (Ctrl+Y)"
              aria-label="Redo"
              className="px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              ↷
            </button>
          </div>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              + Add slide
            </button>
            {showConceptPicker && <ConceptLibraryDropdown onClose={() => setShowConceptPicker(false)} />}
            {showDiagramPicker && <DiagramLibraryDropdown onClose={() => setShowDiagramPicker(false)} />}
            {showAddMenu && (
              <div className="absolute right-0 top-10 z-10 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                <button
                  onClick={() => {
                    setShowConceptPicker(true);
                    setShowAddMenu(false);
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-md border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold text-[#0b72c2] hover:bg-slate-50"
                >
                  <IconBulb className="h-3.5 w-3.5 flex-shrink-0" /> Concept library…
                </button>
                <button
                  onClick={() => {
                    setShowDiagramPicker(true);
                    setShowAddMenu(false);
                  }}
                  className="mb-1 flex w-full items-center gap-2 rounded-md border-b border-slate-100 px-3 py-2 text-left text-xs font-semibold text-[#0b72c2] hover:bg-slate-50"
                >
                  <IconGrid className="h-3.5 w-3.5 flex-shrink-0" /> Diagram library…
                </button>
                <button
                  onClick={() => {
                    addSlide('title-content');
                    setShowAddMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconTextBlock className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Title + Content
                </button>
                <button
                  onClick={() => {
                    addSlide('merge-diagram');
                    setShowAddMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconStar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Merge Diagram
                </button>
                <button
                  onClick={() => {
                    addSlide('stat-hero');
                    setShowAddMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconBars className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Stat Hero
                </button>
                <button
                  onClick={() => {
                    addSlide('linked-views');
                    setShowAddMenu(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconLink className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Linked Views
                </button>
                {ECOM_PILLAR && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    {ECOM_PILLAR.concepts.map((concept) => (
                      <button
                        key={concept.id}
                        onClick={() => {
                          addSlides([conceptSlide(ECOM_PILLAR, concept)]);
                          setShowAddMenu(false);
                        }}
                        className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                      >
                        <IconImage className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> {concept.title}
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
          <div className="relative">
            <button
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={!!exportStatus}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-50"
            >
              {exportStatus ? exportStatus : '⬇ Export'}
            </button>
            {showExportMenu && !exportStatus && (
              <div className="absolute right-0 top-10 z-10 w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconFile className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Export as PDF
                </button>
                <button
                  onClick={() => handleExport('pptx')}
                  className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <IconScreen className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" /> Export as PPTX
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => router.push(`/p/${project.id}/present`)}
            className="rounded-full bg-[#0b72c2] px-4 py-2 text-xs font-semibold text-white hover:bg-[#095f9f]"
          >
            ▷ Presenter
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <SlideRail />
        <main ref={stageAreaRef} className="min-h-0 flex-1 p-8">
          <ScaledStage
            pannable
            zoomFactor={zoomFactor}
            stageClassName="overflow-hidden rounded-lg bg-white shadow-lg ring-1 ring-slate-200"
          >
            {currentSlide && <SlideRenderer slide={currentSlide} editable animate />}
          </ScaledStage>
        </main>
        <PropertiesPanel />
      </div>

      <div className="flex flex-shrink-0 items-center justify-between border-t border-slate-200 bg-white px-4 py-1.5 text-[11px] text-slate-400">
        <span className="flex-1" />
        <span className="text-center">
          Editor mode — click any headline or field to edit it · ↑↓ change slide · Ctrl/⌘+D duplicate · Ctrl/⌘+Z undo
        </span>
        <span className="flex flex-1 items-center justify-end gap-1">
          <button
            onClick={() => setZoomFactor((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            title="Zoom out (Ctrl/⌘+-)"
            aria-label="Zoom out"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          >
            −
          </button>
          <button
            onClick={() => setZoomFactor(ZOOM_DEFAULT)}
            title="Reset zoom (Ctrl/⌘+0)"
            className="w-10 rounded text-slate-500 hover:bg-slate-100"
          >
            {Math.round(zoomFactor * 100)}%
          </button>
          <button
            onClick={() => setZoomFactor((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX))}
            title="Zoom in (Ctrl/⌘+=)"
            aria-label="Zoom in"
            className="flex h-5 w-5 items-center justify-center rounded text-slate-500 hover:bg-slate-100"
          >
            +
          </button>
        </span>
      </div>
    </div>
  );
}
