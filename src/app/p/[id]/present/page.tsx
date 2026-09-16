'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getProject } from '@/lib/data';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from '@/components/SlideRenderer';

export default function PresenterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [ready, setReady] = useState(false);

  const project = useEditorStore((s) => s.project);
  const loadProject = useEditorStore((s) => s.loadProject);
  const currentSlide = useEditorStore((s) => s.currentSlide());
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);
  const setMode = useEditorStore((s) => s.setMode);
  const selectSlide = useEditorStore((s) => s.selectSlide);

  useEffect(() => {
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
        // The store steps over skipped slides only in presenter mode, and the
        // deck may well open on one.
        setMode('presenter');
        const first = p.slides.find((s) => !s.skipped);
        if (first) selectSlide(first.id);
        setReady(true);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'Escape') {
        router.push(`/p/${id}/edit`);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, router, id]);

  if (!ready || !project) {
    return <div className="flex h-screen items-center justify-center bg-black text-white/40">Loading…</div>;
  }

  const shown = project.slides.filter((s) => !s.skipped);
  if (shown.length === 0) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-black text-white/50">
        <p>Every slide in this deck is skipped.</p>
        <button onClick={() => router.push(`/p/${id}/edit`)} className="text-sm underline">
          Back to the editor
        </button>
      </div>
    );
  }
  const shownIndex = shown.findIndex((s) => s.id === currentSlide?.id);

  return (
    <div className="relative h-screen w-screen bg-black">
      {currentSlide && (
        <div className="absolute inset-0">
          <SlideRenderer slide={currentSlide} editable={false} animate />
        </div>
      )}

      {/* A translucent dark pill (not the slide-relative white/black tokens SlideRenderer
          uses) so these controls stay visible over both light and dark slide styles. */}
      <button
        onClick={goPrev}
        disabled={shownIndex <= 0}
        className="absolute left-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-20"
      >
        ‹
      </button>
      <button
        onClick={goNext}
        disabled={shownIndex >= shown.length - 1}
        className="absolute right-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-lg text-white shadow-lg backdrop-blur-sm transition hover:bg-black/60 disabled:opacity-20"
      >
        ›
      </button>

      <div className="absolute bottom-6 right-6 rounded-full bg-black/40 px-3 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm">
        Press Esc to exit Presenter mode
      </div>

      {/* Progress rail: step count + a one-line hint, and a row of clickable
          dots for jump-to-slide — the deck's own navigation chrome, not part
          of any one slide's content. */}
      <div className="absolute bottom-6 left-1/2 flex max-w-[70vw] -translate-x-1/2 flex-col items-center gap-2">
        <div className="flex items-center gap-3 rounded-full bg-black/40 px-4 py-1.5 text-xs text-white shadow-lg backdrop-blur-sm">
          <span className="font-semibold tabular-nums">
            {shownIndex + 1} / {shown.length}
          </span>
          {(currentSlide?.fields.kickerLabel || currentSlide?.fields.title) && (
            <span className="max-w-[40vw] truncate text-white/70">
              {currentSlide?.fields.kickerLabel || currentSlide?.fields.title}
            </span>
          )}
        </div>
        <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-full bg-black/40 px-3 py-2 shadow-lg backdrop-blur-sm">
          {shown.map((s, i) => (
            <button
              key={s.id}
              onClick={() => selectSlide(s.id)}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === shownIndex}
              className={`h-1.5 rounded-full transition-all ${
                i === shownIndex ? 'w-5 bg-white' : 'w-1.5 bg-white/35 hover:bg-white/60'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
