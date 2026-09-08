'use client';

import { useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { makeId } from '@/lib/id';
import type { LinkedView, Slide, ViewHotspot } from '@/types/slide';

interface SlideRendererProps {
  slide: Slide;
  editable: boolean;
}

const ARROW = '→';

/** Image or video box with an inline "paste a URL" affordance when editable —
 * used for Design-style slides and each Linked-Views tab. No upload/storage
 * involved on purpose; pasting a hosted URL is the whole workaround. */
function MediaBox({
  url,
  kind,
  editable,
  onChangeUrl,
  className,
  mediaRef,
}: {
  url: string;
  kind: 'image' | 'video';
  editable: boolean;
  onChangeUrl: (url: string) => void;
  className?: string;
  mediaRef?: React.Ref<HTMLVideoElement>;
}) {
  return (
    <div className={`relative overflow-hidden rounded-lg bg-black/30 ${className ?? ''}`}>
      {url ? (
        kind === 'video' ? (
          <video ref={mediaRef} src={url} controls className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-white/40">No {kind} yet</div>
      )}
      {editable && (
        <input
          value={url}
          onChange={(e) => onChangeUrl(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          placeholder={`Paste ${kind} URL…`}
          className="absolute inset-x-2 bottom-2 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white outline-none placeholder:text-white/40"
        />
      )}
    </div>
  );
}

type Point = { x: number; y: number };

/** A region drawn as a polygon on a source image. Editable mode: click to place
 * vertices, Finish once there are 3+, then pick the target view (+ optional video
 * timestamp); click a finished region to delete it. Non-editable (Presenter): click
 * a region to jump to its target, seeking the target video if a timestamp was set. */
function LinkedViewsExplorer({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const views = slide.fields.views ?? [];
  const [activeId, setActiveId] = useState<string | undefined>(views[0]?.id);
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [pendingTarget, setPendingTarget] = useState('');
  const [pendingTime, setPendingTime] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = views.find((v) => v.id === activeId) ?? views[0];

  function setView(id: string, patch: Partial<LinkedView>) {
    updateField('views', views.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  if (!active) return null;

  const otherViews = views.filter((v) => v.id !== active.id);
  const hotspots = active.hotspots ?? [];
  const targetView = otherViews.find((v) => v.id === pendingTarget);

  function handleMediaClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || !active.url || active.kind === 'walkthrough' || pickingTarget) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const point = { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height };
    setDrawingPoints((prev) => (prev ? [...prev, point] : [point]));
  }

  function undoPoint() {
    setDrawingPoints((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : null));
  }

  function cancelDrawing() {
    setDrawingPoints(null);
    setPickingTarget(false);
  }

  function startPickingTarget() {
    if (!drawingPoints || drawingPoints.length < 3) return;
    setPendingTarget(otherViews[0]?.id ?? '');
    setPendingTime('');
    setPickingTarget(true);
  }

  function confirmRegion() {
    if (!drawingPoints || drawingPoints.length < 3 || !pendingTarget) return;
    const time = pendingTime.trim() ? Number(pendingTime) : undefined;
    const hotspot: ViewHotspot = { id: makeId('hotspot'), points: drawingPoints, targetViewId: pendingTarget, targetTime: time };
    setView(active.id, { hotspots: [...hotspots, hotspot] });
    cancelDrawing();
  }

  function removeHotspot(id: string) {
    setView(active.id, { hotspots: hotspots.filter((h) => h.id !== id) });
  }

  function jumpTo(hotspot: ViewHotspot) {
    setActiveId(hotspot.targetViewId);
    if (hotspot.targetTime != null) {
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.currentTime = hotspot.targetTime!;
      });
    }
  }

  const centroid: Point | null = drawingPoints
    ? {
        x: drawingPoints.reduce((s, p) => s + p.x, 0) / drawingPoints.length,
        y: drawingPoints.reduce((s, p) => s + p.y, 0) / drawingPoints.length,
      }
    : null;

  return (
    <div className="mt-6 flex flex-col">
      <div className="mb-3 flex flex-wrap gap-2">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveId(v.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              v.id === active.id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
      <div className="relative aspect-video w-full" onClick={handleMediaClick}>
        <MediaBox
          url={active.url}
          kind={active.kind === 'walkthrough' ? 'video' : 'image'}
          editable={editable}
          onChangeUrl={(url) => setView(active.id, { url })}
          className="h-full w-full"
          mediaRef={active.kind === 'walkthrough' ? videoRef : undefined}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {hotspots.filter((h) => h.points && h.points.length >= 3).map((h) => (
            <polygon
              key={h.id}
              points={h.points.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
              vectorEffect="non-scaling-stroke"
              className={`fill-[var(--accent)]/25 stroke-[var(--accent)] ${drawingPoints ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer hover:fill-[var(--accent)]/40'}`}
              strokeWidth={1.5}
              onClick={(e) => {
                e.stopPropagation();
                if (editable) removeHotspot(h.id);
                else jumpTo(h);
              }}
            >
              <title>{editable ? 'Click to remove' : views.find((v) => v.id === h.targetViewId)?.label}</title>
            </polygon>
          ))}
          {drawingPoints && (
            <>
              <polyline
                points={drawingPoints.map((p) => `${p.x * 100},${p.y * 100}`).join(' ')}
                vectorEffect="non-scaling-stroke"
                className="fill-none stroke-[var(--accent)]"
                strokeWidth={1.5}
                strokeDasharray="4,3"
              />
              {drawingPoints.map((p, i) => (
                <circle key={i} cx={p.x * 100} cy={p.y * 100} r={0.9} vectorEffect="non-scaling-stroke" className="fill-white stroke-[var(--accent)]" strokeWidth={1.5} />
              ))}
            </>
          )}
        </svg>

        {drawingPoints && !pickingTarget && (
          <div onClick={(e) => e.stopPropagation()} className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white">
            <span>
              {drawingPoints.length} point{drawingPoints.length === 1 ? '' : 's'}
            </span>
            <button onClick={undoPoint} className="underline decoration-white/50 hover:decoration-white">
              Undo
            </button>
            <button
              onClick={startPickingTarget}
              disabled={drawingPoints.length < 3}
              className="rounded bg-[var(--accent)] px-2 py-0.5 font-semibold disabled:opacity-40"
            >
              {drawingPoints.length < 3 ? `Finish (${3 - drawingPoints.length} more)` : 'Finish'}
            </button>
            <button onClick={cancelDrawing} className="underline decoration-white/50 hover:decoration-white">
              Cancel
            </button>
          </div>
        )}

        {pickingTarget && centroid && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ left: `${centroid.x * 100}%`, top: `${centroid.y * 100}%` }}
            className="absolute z-20 w-52 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--line)] bg-white p-3 shadow-xl"
          >
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">Jump to</div>
            <select
              value={pendingTarget}
              onChange={(e) => setPendingTarget(e.target.value)}
              className="mb-2 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
            >
              {otherViews.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.label}
                </option>
              ))}
            </select>
            {targetView?.kind === 'walkthrough' && (
              <input
                value={pendingTime}
                onChange={(e) => setPendingTime(e.target.value)}
                placeholder="Start at (seconds, optional)"
                type="number"
                className="mb-2 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
              />
            )}
            <div className="flex gap-2">
              <button onClick={confirmRegion} className="flex-1 rounded-md bg-[var(--accent)] px-2 py-1.5 text-xs font-semibold text-white">
                Add region
              </button>
              <button onClick={cancelDrawing} className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium text-[var(--ink-2)]">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {editable && active.url && active.kind !== 'walkthrough' && !drawingPoints && (
        <p className="mt-2 text-[11px] text-[var(--ink-3)]">Click to place points around a region, then Finish to link it to another view.</p>
      )}
    </div>
  );
}

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
          {slide.layout === 'linked-views' && <LinkedViewsExplorer slide={slide} editable={editable} />}
          {slide.style === 'design' && (
            <MediaBox
              url={slide.fields.imageUrl ?? ''}
              kind="image"
              editable={editable}
              onChangeUrl={(url) => updateField('imageUrl', url)}
              className="mt-6 aspect-video w-full max-w-xl"
            />
          )}
        </>
      )}
    </div>
  );

  return base;
}
