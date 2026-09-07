'use client';

import { useEditorStore } from '@/lib/editorStore';
import { LAYOUT_LABELS, STYLE_LABELS } from '@/lib/slideDefaults';
import type { SlideLayout, SlideStyleKind } from '@/types/slide';

const LAYOUTS = Object.keys(LAYOUT_LABELS) as SlideLayout[];
const STYLES = Object.keys(STYLE_LABELS) as SlideStyleKind[];

export function PropertiesPanel() {
  const slide = useEditorStore((s) => s.currentSlide());
  const changeLayout = useEditorStore((s) => s.changeLayout);
  const changeStyle = useEditorStore((s) => s.changeStyle);

  if (!slide) return null;

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white px-5 py-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#0b72c2]">Slide</div>
      <div className="mb-6 font-display text-base font-bold text-slate-900">Properties</div>

      <div className="mb-6">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Slide Style</h4>
        <div className="flex flex-wrap gap-2">
          {STYLES.map((k) => (
            <button
              key={k}
              onClick={() => changeStyle(k)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                slide.style === k ? 'border-[#0b72c2] bg-[#e8f2fb] text-[#0b72c2]' : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {STYLE_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">A purpose-built preset with its own background.</p>
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Slide Layout</h4>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((k) => (
            <button
              key={k}
              onClick={() => changeLayout(k)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                slide.layout === k && slide.style === 'standard'
                  ? 'border-[#0b72c2] bg-[#e8f2fb] text-[#0b72c2]'
                  : 'border-slate-200 text-slate-600 hover:border-slate-300'
              }`}
            >
              {LAYOUT_LABELS[k]}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">A generic structure — replaces this slide&apos;s content with that layout&apos;s placeholders.</p>
      </div>
    </aside>
  );
}
