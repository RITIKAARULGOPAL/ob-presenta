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
  const currentIndex = useEditorStore((s) => s.currentIndex());
  const goNext = useEditorStore((s) => s.goNext);
  const goPrev = useEditorStore((s) => s.goPrev);

  useEffect(() => {
    getProject(id).then((p) => {
      if (p) {
        loadProject(p);
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

  return (
    <div className="relative h-screen w-screen bg-black">
      {currentSlide && (
        <div className="absolute inset-0">
          <SlideRenderer slide={currentSlide} editable={false} />
        </div>
      )}

      <button
        onClick={goPrev}
        disabled={currentIndex <= 0}
        className="absolute left-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:bg-white/15 disabled:opacity-20"
      >
        ‹
      </button>
      <button
        onClick={goNext}
        disabled={!project || currentIndex >= project.slides.length - 1}
        className="absolute right-6 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition hover:bg-white/15 disabled:opacity-20"
      >
        ›
      </button>

      <div className="absolute bottom-6 right-6 text-xs text-white/35">Press Esc to exit Presenter mode</div>
    </div>
  );
}
