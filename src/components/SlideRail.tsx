'use client';

import { useState } from 'react';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from './SlideRenderer';

function modifierFrom(e: React.MouseEvent): 'none' | 'toggle' | 'range' {
  if (e.shiftKey) return 'range';
  if (e.metaKey || e.ctrlKey) return 'toggle';
  return 'none';
}

export function SlideRail() {
  const project = useEditorStore((s) => s.project);
  const currentSlideId = useEditorStore((s) => s.currentSlideId);
  const selectedSlideIds = useEditorStore((s) => s.selectedSlideIds);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const clearSlideSelection = useEditorStore((s) => s.clearSlideSelection);
  const removeSlide = useEditorStore((s) => s.removeSlide);
  const removeSlides = useEditorStore((s) => s.removeSlides);
  const toggleSkip = useEditorStore((s) => s.toggleSkip);
  const toggleSkipMany = useEditorStore((s) => s.toggleSkipMany);
  const duplicateSlide = useEditorStore((s) => s.duplicateSlide);
  const duplicateSlides = useEditorStore((s) => s.duplicateSlides);
  const moveSlide = useEditorStore((s) => s.moveSlide);

  // Drag-to-reorder is transient interaction state, not deck data — kept
  // local rather than in the store, same reasoning as any other in-progress
  // gesture in this codebase (e.g. ImageAdjustOverlay's own drag state).
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ index: number; position: 'before' | 'after' } | null>(null);

  if (!project) return null;

  // Skipped slides keep their place in the rail but don't consume a number —
  // the badge should match the position the audience sees, not the array index.
  let shown = 0;
  const numbers = project.slides.map((slide) => (slide.skipped ? null : ++shown));
  const multiSelected = selectedSlideIds.length > 1;

  return (
    <div className="flex w-48 flex-shrink-0 flex-col overflow-y-auto border-r border-ui-line bg-ui-canvas">
      {multiSelected && (
        <div className="flex flex-shrink-0 items-center justify-between gap-1 border-b border-ui-line bg-ui-surface px-2 py-1.5">
          <span className="text-[11px] font-semibold text-ui-ink-2">{selectedSlideIds.length} selected</span>
          <span className="flex gap-1">
            <button
              onClick={() => toggleSkipMany(selectedSlideIds)}
              title="Skip/include all selected"
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-ui-ink-2 hover:bg-ui-raised-hover"
            >
              ⃠
            </button>
            <button
              onClick={() => duplicateSlides(selectedSlideIds)}
              title="Duplicate all selected (Ctrl/Cmd+D)"
              className="flex h-5 w-5 items-center justify-center rounded text-[10px] text-ui-ink-2 hover:bg-ui-raised-hover"
            >
              ⧉
            </button>
            {project.slides.length > selectedSlideIds.length && (
              <button
                onClick={() => removeSlides(selectedSlideIds)}
                title="Delete all selected (Delete/Backspace)"
                className="flex h-5 w-5 items-center justify-center rounded text-xs text-ui-ink-2 hover:bg-ui-danger-soft hover:text-ui-danger"
              >
                ✕
              </button>
            )}
            <button
              onClick={() => clearSlideSelection()}
              title="Clear selection (Escape)"
              className="flex h-5 w-5 items-center justify-center rounded text-xs text-ui-ink-3 hover:bg-ui-raised-hover"
            >
              ⌫
            </button>
          </span>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-3">
        {project.slides.map((slide, i) => {
          const isSelected = selectedSlideIds.includes(slide.id);
          const isDragging = slide.id === draggedId;
          const showDropLine = dropTarget?.index === i && draggedId !== null && !isDragging;
          // A label only at the start of a run of same-tagged slides — not
          // repeated on every thumbnail in the group, and not shown at all
          // for slides with no option set.
          const option = slide.designOption?.trim();
          const showOptionHeader = !!option && option !== project.slides[i - 1]?.designOption?.trim();
          return (
            // A Fragment, not just the thumbnail div: a group header needs to
            // sit as its own sibling above the thumbnail it introduces, not
            // inside it (the thumbnail is a fixed aspect-video box already
            // full of its own absolutely-positioned overlays).
            <div key={slide.id} className="contents">
              {showOptionHeader && (
                <div className="-mb-1.5 mt-1.5 flex items-center gap-1.5 px-0.5 text-[10px] font-bold uppercase tracking-wide text-ui-ink-3 first:mt-0">
                  <span className="h-1 w-1 rounded-full bg-ui-accent" />
                  {option}
                </div>
              )}
            {/* A div rather than a button: the rendered slide inside can itself contain
                buttons (the Linked Views tabs), and a button can't nest a button. */}
            <div
              role="button"
              tabIndex={0}
              aria-current={slide.id === currentSlideId}
              aria-selected={isSelected}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = 'move';
                setDraggedId(slide.id);
              }}
              onDragEnd={() => {
                setDraggedId(null);
                setDropTarget(null);
              }}
              onDragOver={(e) => {
                if (!draggedId || draggedId === slide.id) return;
                e.preventDefault(); // required for this element to accept a drop at all
                const rect = e.currentTarget.getBoundingClientRect();
                const position = e.clientY - rect.top < rect.height / 2 ? 'before' : 'after';
                setDropTarget((prev) => (prev?.index === i && prev.position === position ? prev : { index: i, position }));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (draggedId && dropTarget?.index === i) {
                  moveSlide(draggedId, dropTarget.position === 'before' ? i : i + 1);
                }
                setDraggedId(null);
                setDropTarget(null);
              }}
              onClick={(e) => selectSlide(slide.id, modifierFrom(e))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  selectSlide(slide.id);
                }
              }}
              className={`group relative aspect-video cursor-pointer overflow-hidden rounded-md border-2 text-left transition ${
                slide.id === currentSlideId ? 'border-ui-accent-line' : 'border-transparent hover:border-ui-line-strong'
              } ${isSelected ? 'ring-2 ring-ui-accent ring-offset-1' : ''} ${isDragging ? 'opacity-40' : ''}`}
            >
              {showDropLine && (
                <span
                  className={`pointer-events-none absolute inset-x-0 z-10 h-0.5 rounded bg-ui-accent ${
                    dropTarget?.position === 'before' ? '-top-[7px]' : '-bottom-[7px]'
                  }`}
                />
              )}

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

              {/* Always visible once anything's selected (not just on hover),
                  so a multi-selection stays legible without hovering each tile;
                  otherwise it's a hover affordance like the other icon buttons. */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  selectSlide(slide.id, 'toggle');
                }}
                aria-label={isSelected ? 'Deselect slide' : 'Select slide'}
                title="Click to multi-select (or Ctrl/Cmd-click the slide, Shift-click for a range, Ctrl/Cmd+A for all)"
                className={`absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] transition ${
                  isSelected
                    ? 'border-ui-accent-line bg-ui-accent text-ui-accent-on opacity-100'
                    : 'border-white/70 bg-black/30 text-transparent opacity-0 group-hover:opacity-100'
                }`}
              >
                ✓
              </button>

              <span className="absolute right-1 top-1 hidden gap-1 group-hover:flex">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleSkip(slide.id);
                  }}
                  aria-label={slide.skipped ? `Include slide in the deck` : `Skip slide ${numbers[i]}`}
                  title={slide.skipped ? 'Include again' : 'Skip in Presenter and export'}
                  className="flex h-5 w-5 items-center justify-center rounded bg-black/50 text-[10px] text-white hover:bg-ui-accent"
                >
                  {slide.skipped ? '↺' : '⃠'}
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    duplicateSlide(slide.id);
                  }}
                  aria-label={`Duplicate slide ${i + 1}`}
                  title="Duplicate slide (Ctrl/Cmd+D)"
                  className="flex h-5 w-5 items-center justify-center rounded bg-black/50 text-[10px] text-white hover:bg-ui-accent"
                >
                  ⧉
                </button>
                {project.slides.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeSlide(slide.id);
                    }}
                    aria-label={`Delete slide ${i + 1}`}
                    title="Delete slide (Delete/Backspace)"
                    className="flex h-5 w-5 items-center justify-center rounded bg-black/50 text-xs text-white hover:bg-red-600"
                  >
                    ✕
                  </button>
                )}
              </span>
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
