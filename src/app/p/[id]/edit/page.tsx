'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { getProject, optionalColumnsMissing } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRail } from '@/components/SlideRail';
import { SlideRenderer } from '@/components/SlideRenderer';
import { PropertiesPanel } from '@/components/PropertiesPanel';
import { ConceptLibraryDropdown } from '@/components/ConceptLibraryDropdown';
import { exportToPdf, exportToPptx } from '@/lib/exportDeck';
import { IconBulb, IconTextBlock, IconStar, IconBars, IconLink, IconFile, IconScreen } from '@/components/icons';

export default function EditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [notFound, setNotFound] = useState(false);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [showConceptPicker, setShowConceptPicker] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const addSlide = useEditorStore((s) => s.addSlide);
  const saveError = useEditorStore((s) => s.saveError);
  const logoSaveUnavailable = useEditorStore((s) => s.logoSaveUnavailable);

  useEffect(() => {
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
        useEditorStore.setState({ logoSaveUnavailable: optionalColumnsMissing() });
      } else setNotFound(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

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

  return (
    <div className="flex h-screen flex-col bg-slate-100">
      {saveBanner}
      <header className="flex flex-shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-full bg-slate-800 px-3.5 py-1.5 text-xs font-semibold text-white">
          <span className="h-1.5 w-1.5 rounded-full bg-[#5fa8e8]" />
          {project.name}
          <span className="font-normal text-white/60">· by {project.preparedBy}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/" className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200">
            ⌂ Home
          </Link>
          <div className="relative">
            <button
              onClick={() => setShowAddMenu((v) => !v)}
              className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200"
            >
              + Add slide
            </button>
            {showConceptPicker && <ConceptLibraryDropdown onClose={() => setShowConceptPicker(false)} />}
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
        <main className="flex min-h-0 flex-1 items-center justify-center overflow-auto p-8">
          <div className="aspect-video max-h-full w-full max-w-5xl overflow-y-auto rounded-lg bg-white shadow-lg ring-1 ring-slate-200">
            {currentSlide && <SlideRenderer slide={currentSlide} editable animate />}
          </div>
        </main>
        <PropertiesPanel />
      </div>

      <div className="flex-shrink-0 border-t border-slate-200 bg-white px-4 py-1.5 text-center text-[11px] text-slate-400">
        Editor mode — click any headline or field to edit it
      </div>
    </div>
  );
}
