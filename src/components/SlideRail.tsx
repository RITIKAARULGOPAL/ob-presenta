'use client';

import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from './SlideRenderer';

export function SlideRail() {
  const project = useEditorStore((s) => s.project);
  const currentSlideId = useEditorStore((s) => s.currentSlideId);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const removeSlide = useEditorStore((s) => s.removeSlide);
  const toggleSkip = useEditorStore((s) => s.toggleSkip);

  if (!project) return null;

  // Skipped slides keep their place in the rail but don't consume a number —
  // the badge should match the position the audience sees, not the array index.
  let shown = 0;
  const numbers = project.slides.map((slide) => (slide.skipped ? null : ++shown));

  return (
    <div className="flex w-48 flex-shrink-0 flex-col gap-3 overflow-y-auto border-r border-slate-200 bg-slate-50 p-3">
      {project.slides.map((slide, i) => (
        // A div rather than a button: the rendered slide inside can itself contain
        // buttons (the Linked Views tabs), and a button can't nest a button.
        <div
          key={slide.id}
          role="button"
          tabIndex={0}
          aria-current={slide.id === currentSlideId}
          onClick={() => selectSlide(slide.id)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              selectSlide(slide.id);
            }
          }}
          className={`group relative aspect-video cursor-pointer overflow-hidden rounded-md border-2 text-left transition ${
            slide.id === currentSlideId ? 'border-[#0b72c2]' : 'border-transparent hover:border-slate-300'
          }`}
        >
          <div
            className={`pointer-events-none h-full w-full origin-top-left scale-[0.25] transition ${
              slide.skipped ? 'opacity-35 grayscale' : ''
            }`}
            style={{ width: '400%', height: '400%' }}
          >
            <SlideRenderer slide={slide} editable={false} />
          </div>

          {/* Hatching, so a skipped slide is obvious at a glance and not just
              a slide that happens to be pale. */}
          {slide.skipped && (
            <span
              className="pointer-events-none absolute inset-0"
              style={{
                backgroundImage:
                  'repeating-linear-gradient(45deg, rgba(100,116,139,.16) 0 6px, transparent 6px 12px)',
              }}
            />
          )}

          <span
            className={`absolute bottom-1 left-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold text-white ${
              slide.skipped ? 'bg-slate-500/80' : 'bg-black/50'
            }`}
          >
            {slide.skipped ? 'skipped' : numbers[i]}
          </span>

          <span className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleSkip(slide.id);
              }}
              aria-label={slide.skipped ? `Include slide in the deck` : `Skip slide ${numbers[i]}`}
              title={slide.skipped ? 'Include again' : 'Skip in Presenter and export'}
              className="flex h-5 w-5 items-center justify-center rounded bg-black/50 text-[10px] text-white hover:bg-[#0b72c2]"
            >
              {slide.skipped ? '↺' : '⃠'}
            </button>
            {project.slides.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSlide(slide.id);
                }}
                aria-label={`Delete slide ${i + 1}`}
                className="flex h-5 w-5 items-center justify-center rounded bg-black/50 text-xs text-white hover:bg-red-600"
              >
                ✕
              </button>
            )}
          </span>
        </div>
      ))}
    </div>
  );
}
