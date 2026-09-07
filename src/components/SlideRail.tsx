'use client';

import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from './SlideRenderer';

export function SlideRail() {
  const project = useEditorStore((s) => s.project);
  const currentSlideId = useEditorStore((s) => s.currentSlideId);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const removeSlide = useEditorStore((s) => s.removeSlide);

  if (!project) return null;

  return (
    <div className="flex w-48 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
      {project.slides.map((slide, i) => (
        <button
          key={slide.id}
          onClick={() => selectSlide(slide.id)}
          className={`group relative aspect-video overflow-hidden rounded-md border-2 text-left transition ${
            slide.id === currentSlideId ? 'border-[#0b72c2]' : 'border-transparent hover:border-slate-300'
          }`}
        >
          <div className="pointer-events-none h-full w-full origin-top-left scale-[0.25]" style={{ width: '400%', height: '400%' }}>
            <SlideRenderer slide={slide} editable={false} />
          </div>
          <span className="absolute bottom-1 left-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-semibold text-white">{i + 1}</span>
          {project.slides.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                removeSlide(slide.id);
              }}
              className="absolute right-1 top-1 hidden h-5 w-5 items-center justify-center rounded bg-black/50 text-xs text-white group-hover:flex hover:bg-red-600"
            >
              ✕
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
