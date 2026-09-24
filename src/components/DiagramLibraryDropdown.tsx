'use client';

import { DIAGRAM_PRESETS, diagramSlide, type DiagramPreset } from '@/lib/diagramLibrary';
import { useEditorStore } from '@/lib/editorStore';
import { SlideRenderer } from './SlideRenderer';

/** A real miniature of the slide, through the same renderer the deck uses —
 *  the thumbnail shows the actual diagram, not a stand-in icon. Same trick
 *  as ConceptLibraryDropdown's own Thumb. */
function Thumb({ preset }: { preset: DiagramPreset }) {
  return (
    <div className="pointer-events-none aspect-video w-full overflow-hidden rounded border border-slate-200 bg-white">
      <div className="h-full w-full origin-top-left scale-[0.18]" style={{ width: '555%', height: '555%' }}>
        <SlideRenderer slide={diagramSlide(preset)} editable={false} />
      </div>
    </div>
  );
}

/** The diagram library as a gallery: click a thumbnail, it's added as a new
 *  slide, every box and label on it independently editable from there. One
 *  preset today (Zoning); more of docs/template-system's 18 diagrams land
 *  here the same way as they're converted — this is deliberately just a flat
 *  grid rather than ConceptLibraryDropdown's pillar sidebar, since a left
 *  rail earns its keep once there are enough presets to need grouping by
 *  section, not before. */
export function DiagramLibraryDropdown({ onClose }: { onClose: () => void }) {
  const addSlides = useEditorStore((s) => s.addSlides);

  function pick(preset: DiagramPreset) {
    addSlides([diagramSlide(preset)]);
    onClose();
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed right-3 top-14 z-50 flex max-h-[74vh] w-[420px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="shrink-0 border-b border-slate-100 px-3.5 py-2.5">
          <span className="text-[12px] font-semibold text-slate-800">Diagram library</span>
          <p className="mt-0.5 text-[11px] leading-snug text-slate-500">
            Real floor-plan diagrams, every box and label editable. Click one to add it.
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          <div className="grid gap-1.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
            {DIAGRAM_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => pick(preset)}
                title={`Add “${preset.title}”`}
                className="group flex flex-col gap-1 rounded-md border border-transparent p-1.5 text-left transition hover:border-slate-300 hover:bg-slate-50"
              >
                <Thumb preset={preset} />
                <span className="px-0.5 text-[11px] font-medium text-slate-700">{preset.title}</span>
                <span className="px-0.5 text-[10px] leading-snug text-slate-400">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
