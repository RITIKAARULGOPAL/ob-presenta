'use client';

import { useEditorStore } from '@/lib/editorStore';
import { AccentPicker } from './AccentPicker';
import { LAYOUT_LABELS, STYLE_LABELS } from '@/lib/slideDefaults';
import type { Brand, SlideLayout, SlideStyleKind } from '@/types/slide';

const LAYOUTS = Object.keys(LAYOUT_LABELS) as SlideLayout[];
const STYLES = Object.keys(STYLE_LABELS) as SlideStyleKind[];

const BRAND_OPTIONS: { key: Brand | 'default'; label: string }[] = [
  { key: 'default', label: 'Project default' },
  { key: 'skv', label: 'SKV' },
  { key: 'ob', label: 'OB' },
  { key: 'both', label: 'Both' },
];

export function PropertiesPanel() {
  const slide = useEditorStore((s) => s.currentSlide());
  const project = useEditorStore((s) => s.project);
  const changeLayout = useEditorStore((s) => s.changeLayout);
  const changeStyle = useEditorStore((s) => s.changeStyle);
  const setBrandOverride = useEditorStore((s) => s.setBrandOverride);
  const setAccentColor = useEditorStore((s) => s.setAccentColor);

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

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Logo &amp; Copyright</h4>
        <div className="flex flex-wrap gap-2">
          {BRAND_OPTIONS.map((o) => {
            const selected = o.key === 'default' ? slide.brandOverride === undefined : slide.brandOverride === o.key;
            return (
              <button
                key={o.key}
                onClick={() => setBrandOverride(o.key === 'default' ? undefined : o.key)}
                className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition ${
                  selected ? 'border-[#0b72c2] bg-[#e8f2fb] text-[#0b72c2]' : 'border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                {o.label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          This project defaults to <span className="font-semibold text-slate-500">{project?.brand === 'both' ? 'Both' : project?.brand?.toUpperCase() ?? 'OB'}</span> — override it for just this slide if needed.
        </p>
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wide text-slate-400">Accent Colour</h4>
        <AccentPicker logo={project?.clientLogo} value={project?.accentColor} onChange={setAccentColor} tone="panel" />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Applies to the whole deck, not just this slide.</p>
      </div>
    </aside>
  );
}
