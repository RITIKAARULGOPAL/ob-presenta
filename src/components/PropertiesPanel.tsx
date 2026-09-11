'use client';

import { useEditorStore } from '@/lib/editorStore';
import { AccentPicker } from './AccentPicker';
import { LAYOUT_LABELS, STYLE_LABELS } from '@/lib/slideDefaults';
import { IconLayers, IconGrid, IconImage, IconLink, IconDroplet } from './icons';
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
  const setLinkedSlideIds = useEditorStore((s) => s.setLinkedSlideIds);

  const linkedIds = slide?.fields.linkedSlideIds ?? [];
  // Plans, renders and design slides are what a concept wants to point at —
  // linking one body-copy slide to another isn't the useful case.
  const linkTargets = (project?.slides ?? []).filter(
    (s) => s.id !== slide?.id && (s.layout === 'linked-views' || s.style === 'design'),
  );

  if (!slide) return null;

  return (
    <aside className="flex w-72 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white px-5 py-6">
      <div className="mb-1 text-xs font-bold uppercase tracking-wider text-[#0b72c2]">Slide</div>
      <div className="mb-6 font-display text-base font-bold text-slate-900">Properties</div>

      <div className="mb-6">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <IconLayers className="h-3.5 w-3.5" /> Slide Style
        </h4>
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
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <IconGrid className="h-3.5 w-3.5" /> Slide Layout
        </h4>
        <div className="flex flex-wrap gap-2">
          {LAYOUTS.map((k) => (
            <button
              key={k}
              onClick={() => changeLayout(k)}
              title="Clears this slide's fields to match"
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
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <IconImage className="h-3.5 w-3.5" /> Logo &amp; Copyright
        </h4>
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
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <IconLink className="h-3.5 w-3.5" /> Linked Slides
        </h4>
        {linkTargets.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-slate-400">
            Add a Linked Views or Design slide to link one here.
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {linkTargets.map((target) => {
              const on = linkedIds.includes(target.id);
              return (
                <label
                  key={target.id}
                  className="flex cursor-pointer items-center gap-2"
                  title="Shows as a chip on this slide — click it in Presenter to jump there"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      setLinkedSlideIds(on ? linkedIds.filter((id) => id !== target.id) : [...linkedIds, target.id])
                    }
                    className="accent-[#0b72c2]"
                  />
                  <span className="truncate text-[12px] text-slate-600">{target.fields.title || 'Untitled slide'}</span>
                  <span className="ml-auto shrink-0 text-[10px] uppercase text-slate-400">
                    {target.layout === 'linked-views' ? 'views' : target.style === 'design' ? 'design' : 'slide'}
                  </span>
                </label>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-2 border-t border-slate-100 pt-6">
        <h4 className="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-400">
          <IconDroplet className="h-3.5 w-3.5" /> Accent Colour
        </h4>
        <AccentPicker logo={project?.clientLogo} value={project?.accentColor} onChange={setAccentColor} tone="panel" />
      </div>
    </aside>
  );
}
