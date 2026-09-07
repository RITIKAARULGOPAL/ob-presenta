'use client';

import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import type { Slide } from '@/types/slide';

interface SlideRendererProps {
  slide: Slide;
  editable: boolean;
}

const ARROW = '→';

function Kicker({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  if (!slide.fields.kickerEyebrow && !editable) return null;
  return (
    <div className="mb-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
      <EditableText
        editable={editable}
        value={slide.fields.kickerEyebrow ?? ''}
        onChange={(v) => updateField('kickerEyebrow', v)}
        as="span"
        className="text-[var(--accent)] outline-none"
      />
      {slide.fields.kickerLabel !== undefined && (
        <>
          <span className="h-px w-6 bg-[var(--line)]" />
          <EditableText
            editable={editable}
            value={slide.fields.kickerLabel ?? ''}
            onChange={(v) => updateField('kickerLabel', v)}
            as="span"
            className="outline-none"
          />
        </>
      )}
    </div>
  );
}

function Title({ slide, editable, dark }: SlideRendererProps & { dark?: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  return (
    <EditableText
      editable={editable}
      value={slide.fields.title ?? ''}
      onChange={(v) => updateField('title', v)}
      as="h2"
      className={`font-display text-3xl font-extrabold leading-tight tracking-tight outline-none ${
        dark ? 'text-white' : 'text-[var(--accent)]'
      }`}
    />
  );
}

function Body({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  return (
    <EditableText
      editable={editable}
      value={slide.fields.body ?? ''}
      onChange={(v) => updateField('body', v)}
      as="p"
      className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--ink-2)] outline-none"
    />
  );
}

function StatsRow({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const addStatItem = useEditorStore((s) => s.addStatItem);
  const removeStatItem = useEditorStore((s) => s.removeStatItem);
  const stats = slide.fields.stats ?? [];

  function setStat(id: string, patch: Partial<{ value: string; label: string }>) {
    updateField(
      'stats',
      stats.map((st) => (st.id === id ? { ...st, ...patch } : st))
    );
  }

  return (
    <div className="mt-8">
      <div className="grid gap-px overflow-hidden rounded-lg border border-[var(--line)] bg-[var(--line)]" style={{ gridTemplateColumns: `repeat(${Math.min(stats.length, 4) || 1}, 1fr)` }}>
        {stats.map((st) => (
          <div key={st.id} className="bg-white p-5">
            <EditableText
              editable={editable}
              value={st.value}
              onChange={(v) => setStat(st.id, { value: v })}
              as="div"
              className="font-display text-3xl font-extrabold text-[var(--accent)] outline-none"
            />
            <EditableText
              editable={editable}
              value={st.label}
              onChange={(v) => setStat(st.id, { label: v })}
              as="div"
              className="mt-1 text-sm text-[var(--ink-2)] outline-none"
            />
          </div>
        ))}
      </div>
      {editable && (
        <div className="mt-3 flex gap-2">
          <button onClick={addStatItem} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--ink-3)]">
            + Add stat
          </button>
          {stats.length > 1 && (
            <button onClick={() => removeStatItem(stats[stats.length - 1].id)} className="rounded-md border border-[var(--line)] px-3 py-1.5 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--ink-3)]">
              − Remove
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function MergeDiagram({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const addMergeItem = useEditorStore((s) => s.addMergeItem);
  const removeMergeItem = useEditorStore((s) => s.removeMergeItem);
  const items = slide.fields.items ?? [];

  return (
    <div className="mt-6 flex flex-wrap items-center gap-8">
      <div className="flex flex-col gap-4">
        {items.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ink-3)]" />
            </span>
            <EditableText
              editable={editable}
              value={it.label}
              onChange={(v) => updateField('items', items.map((i) => (i.id === it.id ? { ...i, label: v } : i)))}
              as="span"
              className="text-sm font-semibold text-[var(--ink)] outline-none"
            />
          </div>
        ))}
        {editable && (
          <div className="flex gap-2 pl-1 pt-1">
            <button onClick={addMergeItem} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--ink-3)]">
              + Add
            </button>
            {items.length > 1 && (
              <button onClick={() => removeMergeItem(items[items.length - 1].id)} className="rounded-md border border-[var(--line)] px-2.5 py-1 text-xs font-medium text-[var(--ink-2)] hover:border-[var(--ink-3)]">
                − Remove
              </button>
            )}
          </div>
        )}
      </div>
      <span className="text-2xl text-[var(--ink-3)]">{ARROW}</span>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl border border-[var(--accent-soft-line)] bg-[var(--accent-soft)]">
          <svg viewBox="0 0 24 24" className="h-8 w-8 stroke-[var(--accent)]" fill="none" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2l2.6 6.2 6.7.6-5.1 4.4 1.6 6.6L12 16.3 6.2 19.8l1.6-6.6L2.7 8.8l6.7-.6z" />
          </svg>
        </span>
        <EditableText
          editable={editable}
          value={slide.fields.result ?? ''}
          onChange={(v) => updateField('result', v)}
          as="span"
          className="text-sm font-semibold text-[var(--ink)] outline-none"
        />
      </div>
    </div>
  );
}

function StatHero({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  return (
    <div className="mt-6">
      <EditableText
        editable={editable}
        value={slide.fields.statValue ?? ''}
        onChange={(v) => updateField('statValue', v)}
        as="div"
        className="font-display text-8xl font-extrabold leading-none text-[var(--accent)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.statLabel ?? ''}
        onChange={(v) => updateField('statLabel', v)}
        as="div"
        className="mt-3 text-sm font-semibold uppercase tracking-wide text-[var(--ink-3)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.caption ?? ''}
        onChange={(v) => updateField('caption', v)}
        as="p"
        className="mt-5 max-w-xl text-base text-[var(--ink-2)] outline-none"
      />
    </div>
  );
}

function TwoContent({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  return (
    <div className="mt-6 flex gap-10">
      <EditableText
        editable={editable}
        value={slide.fields.leftColumn ?? ''}
        onChange={(v) => updateField('leftColumn', v)}
        as="p"
        className="flex-1 text-base leading-relaxed text-[var(--ink-2)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.rightColumn ?? ''}
        onChange={(v) => updateField('rightColumn', v)}
        as="p"
        className="flex-1 text-base leading-relaxed text-[var(--ink-2)] outline-none"
      />
    </div>
  );
}

export function SlideRenderer({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const dark = slide.style === 'section-starter' || slide.style === 'design';

  const base = (
    <div
      className={`flex min-h-full w-full flex-col justify-center px-16 py-10 ${dark ? 'bg-[var(--ink)]' : 'bg-white'}`}
      style={
        {
          '--accent': '#0b72c2',
          '--accent-soft': '#e8f2fb',
          '--accent-soft-line': '#c9e2f6',
          '--ink': '#141a2b',
          '--ink-2': '#525a72',
          '--ink-3': '#848da6',
          '--line': '#e2e5ec',
          '--surface-2': '#f0f2f6',
        } as React.CSSProperties
      }
    >
      {slide.style === 'section-starter' ? (
        <div className="text-center">
          <EditableText
            editable={editable}
            value={slide.fields.numeral ?? ''}
            onChange={(v) => updateField('numeral', v)}
            as="div"
            className="font-display text-8xl font-extrabold leading-none text-white/15 outline-none"
          />
          <EditableText
            editable={editable}
            value={slide.fields.title ?? ''}
            onChange={(v) => updateField('title', v)}
            as="h1"
            className="mt-2 font-display text-4xl font-extrabold text-white outline-none"
          />
          <EditableText
            editable={editable}
            value={slide.fields.subtitle ?? ''}
            onChange={(v) => updateField('subtitle', v)}
            as="p"
            className="mx-auto mt-4 max-w-lg text-white/65 outline-none"
          />
        </div>
      ) : slide.layout === 'title-slide' ? (
        <div className="text-center">
          <Kicker slide={slide} editable={editable} />
          <EditableText
            editable={editable}
            value={slide.fields.title ?? ''}
            onChange={(v) => updateField('title', v)}
            as="h1"
            className="font-display text-5xl font-extrabold text-[var(--accent)] outline-none"
          />
          <EditableText
            editable={editable}
            value={slide.fields.subtitle ?? ''}
            onChange={(v) => updateField('subtitle', v)}
            as="p"
            className="mx-auto mt-4 max-w-lg text-[var(--ink-2)] outline-none"
          />
        </div>
      ) : slide.layout === 'blank' ? null : (
        <>
          <Kicker slide={slide} editable={editable} />
          <Title slide={slide} editable={editable} dark={dark} />
          {slide.layout === 'title-content' && <Body slide={slide} editable={editable} />}
          {(slide.layout === 'title-stats' || slide.style === 'company') && (
            <>
              {slide.fields.body && <Body slide={slide} editable={editable} />}
              <StatsRow slide={slide} editable={editable} />
            </>
          )}
          {slide.layout === 'two-content' && <TwoContent slide={slide} editable={editable} />}
          {slide.layout === 'merge-diagram' && <MergeDiagram slide={slide} editable={editable} />}
          {slide.layout === 'stat-hero' && <StatHero slide={slide} editable={editable} />}
          {slide.style === 'design' && (
            <div className="mt-6 aspect-video w-full max-w-xl overflow-hidden rounded-lg bg-black/30">
              {slide.fields.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={slide.fields.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-white/40">No image yet</div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  return base;
}
