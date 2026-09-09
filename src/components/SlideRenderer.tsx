'use client';

import { useEffect, useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { tintWithWhite } from '@/lib/color';
import { dataUrlBytes, fileToDataUrl, fileToSlideImage } from '@/lib/imageFile';
import {
  centroidOf,
  clamp01,
  distance,
  isTooClose,
  previewPath,
  rectPoints,
  shapePath,
  simplify,
  snapAngle,
  squareFrom,
  type ShapeKind,
} from '@/lib/hotspotShape';
import { ConceptDiagram } from './ConceptDiagram';
import { makeId } from '@/lib/id';
import type { Brand, LinkedView, Slide, ViewHotspot } from '@/types/slide';
import type { Point } from '@/lib/hotspotShape';

interface SlideRendererProps {
  slide: Slide;
  editable: boolean;
  /** Play entry motion. Off for rail thumbnails, which re-mount constantly and
   *  would otherwise re-animate every time the deck changes; on for the live
   *  canvas and for Presenter — editable is the wrong signal, since Presenter
   *  is not editable but is exactly where the motion matters. */
  animate?: boolean;
}

const ARROW = '→';

/** Image or video box. Images can be picked from disk or dropped on the box;
 * pasting a URL still works, and is the only option for video — a walkthrough
 * clip as base64 would be tens of megabytes in the row, re-fetched on every
 * deck load. Used for Design slides, Linked-Views tabs and the concept slot. */
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
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const canUpload = editable && kind === 'image';

  async function accept(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setNote('That file is not an image.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      const dataUrl = await fileToSlideImage(file);
      onChangeUrl(dataUrl);
      const kb = Math.round(dataUrlBytes(dataUrl) / 1024);
      // Worth saying out loud: this lands in the project row, not a bucket.
      setNote(kb > 700 ? `Added — ${kb}KB, which is heavy for one slide.` : `Added — ${kb}KB.`);
    } catch (err) {
      console.error('Could not read that image:', err);
      setNote('Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`relative overflow-hidden rounded-lg bg-black/30 ${dragging ? 'ring-2 ring-[var(--accent)]' : ''} ${className ?? ''}`}
      onDragOver={canUpload ? (e) => { e.preventDefault(); setDragging(true); } : undefined}
      onDragLeave={canUpload ? () => setDragging(false) : undefined}
      onDrop={
        canUpload
          ? (e) => {
              // Without preventDefault the browser navigates away to the file.
              e.preventDefault();
              setDragging(false);
              void accept(e.dataTransfer.files?.[0]);
            }
          : undefined
      }
    >
      {url ? (
        kind === 'video' ? (
          <video ref={mediaRef} src={url} controls className="h-full w-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="h-full w-full object-cover" />
        )
      ) : (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-sm text-white/40">
          {canUpload ? (
            <>
              <span>{dragging ? 'Drop to add' : busy ? 'Reading image…' : 'Drag an image here'}</span>
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                className="rounded-md border border-dashed border-white/30 px-2.5 py-1 text-xs font-semibold text-white/70 hover:border-white/60 hover:text-white"
              >
                Choose a file
              </button>
            </>
          ) : (
            <span>No {kind} yet</span>
          )}
        </div>
      )}

      {canUpload && (
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            void accept(file);
          }}
        />
      )}

      {editable && (
        <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
          {note && <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-white/80">{note}</span>}
          <div className="flex gap-1">
            <input
              value={url.startsWith('data:') ? '' : url}
              onChange={(e) => onChangeUrl(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              placeholder={url.startsWith('data:') ? 'Uploaded image' : `Paste ${kind} URL…`}
              className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white outline-none placeholder:text-white/40"
            />
            {canUpload && (
              <button
                onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}
                disabled={busy}
                className="shrink-0 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs font-semibold text-white/80 hover:border-white/50 hover:text-white disabled:opacity-50"
              >
                {busy ? '…' : 'Upload'}
              </button>
            )}
            {url && (
              <button
                onClick={(e) => { e.stopPropagation(); onChangeUrl(''); setNote(''); }}
                aria-label={`Remove ${kind}`}
                className="shrink-0 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white/70 hover:border-red-400 hover:text-red-300"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const DEFAULT_ACCENT = '#0b72c2';

const DEFAULT_FILL = '#0b72c2';
const DEFAULT_FILL_OPACITY = 0.25;
const DEFAULT_STROKE = '#0b72c2';
const DEFAULT_STROKE_WIDTH = 1.5;

const LEGAL_NAMES: Record<Brand, string> = {
  skv: 'Studiokon Ventures Private Limited',
  ob: 'Officebanao',
  both: 'Studiokon Ventures Private Limited & Officebanao',
};

/** Renders a company logo from /public/logos, falling back to a text wordmark
 * if the file isn't there yet — so the footer works before the real assets land.
 *
 * Officebanao ships black and white versions, so dark slides get the reversed
 * one directly. SKV is a single black-and-yellow mark, so on dark slides it sits
 * on a small white chip instead — swap in a reversed skv-white.png the same way
 * as OB if one ever exists. */
function BrandMark({ brand, dark }: { brand: 'skv' | 'ob'; dark: boolean }) {
  const [failed, setFailed] = useState(false);
  const label = brand === 'skv' ? 'SKV' : 'Officebanao';
  const src = brand === 'ob' && dark ? '/logos/ob-white.png' : `/logos/${brand}.png`;
  const needsChip = brand === 'skv' && dark;

  if (failed) {
    return (
      <span className={`font-display text-[10px] font-bold uppercase tracking-wider ${dark ? 'text-white/70' : 'text-[var(--ink-3)]'}`}>
        {label}
      </span>
    );
  }
  return (
    <span className={`inline-flex items-center rounded ${needsChip ? 'bg-white/90 px-1.5 py-1' : ''}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={label} onError={() => setFailed(true)} className="h-4 w-auto object-contain" />
    </span>
  );
}

/** The client's logo on the title slide. In the editor it doubles as its own
 * upload control — click to pick a file, matching how every other bit of media
 * in this app is set inline rather than through a settings screen. */
function ClientLogo({ editable, dark }: { editable: boolean; dark: boolean }) {
  const project = useEditorStore((s) => s.project);
  const setClientLogo = useEditorStore((s) => s.setClientLogo);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const logo = project?.clientLogo;

  async function handlePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      setClientLogo(await fileToDataUrl(file));
    } catch (err) {
      console.error('Could not read that logo file:', err);
    }
    setBusy(false);
  }

  if (!logo && !editable) return null;

  return (
    <div className="mt-10 flex flex-col items-center gap-2">
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logo} alt={project?.client ? `${project.client} logo` : 'Client logo'} className="h-10 w-auto object-contain" />
      ) : null}
      {editable && (
        <>
          <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} className="hidden" />
          <button
            onClick={() => inputRef.current?.click()}
            className={`rounded-md border border-dashed px-2.5 py-1 text-[10px] font-semibold transition ${
              dark ? 'border-white/30 text-white/60 hover:border-white/60' : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
            }`}
          >
            {busy ? 'Reading…' : logo ? 'Replace client logo' : '+ Add client logo'}
          </button>
        </>
      )}
    </div>
  );
}

/** A concept slide's links to the plans and renders that demonstrate it.
 *  Targets can vanish if a slide is deleted mid-session, so misses are skipped
 *  rather than rendered as dead chips. */
function LinkedSlideChips({ slide, dark }: { slide: Slide; dark: boolean }) {
  const project = useEditorStore((s) => s.project);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const ids = slide.fields.linkedSlideIds ?? [];
  if (ids.length === 0) return null;

  const targets = ids
    .map((id) => project?.slides.find((s) => s.id === id))
    .filter((s): s is Slide => Boolean(s));
  if (targets.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <span className={`text-[10px] font-semibold uppercase tracking-wide ${dark ? 'text-white/40' : 'text-[var(--ink-3)]'}`}>
        See
      </span>
      {targets.map((target) => (
        <button
          key={target.id}
          type="button"
          onClick={() => selectSlide(target.id)}
          className={`rounded-full border px-3 py-1 text-[11px] font-medium transition ${
            dark
              ? 'border-white/25 text-white/75 hover:border-white/60 hover:text-white'
              : 'border-[var(--accent-soft-line)] bg-[var(--accent-soft)] text-[var(--accent)] hover:border-[var(--accent)]'
          }`}
        >
          {target.fields.title || 'Untitled slide'} {ARROW}
        </button>
      ))}
    </div>
  );
}

function BrandFooter({ slide, dark }: { slide: Slide; dark: boolean }) {
  const project = useEditorStore((s) => s.project);
  const brand: Brand = slide.brandOverride ?? project?.brand ?? 'ob';
  const year = project ? new Date(project.createdAt).getFullYear() : new Date().getFullYear();
  const marks: ('skv' | 'ob')[] = brand === 'both' ? ['skv', 'ob'] : [brand];

  return (
    <div className="pointer-events-none absolute inset-x-6 bottom-3 flex items-end justify-between gap-4">
      <span className="flex items-center gap-2">
        {marks.map((m) => (
          <BrandMark key={m} brand={m} dark={dark} />
        ))}
      </span>
      <span className="flex items-center gap-3">
        <span className={`text-[9px] leading-tight ${dark ? 'text-white/50' : 'text-[var(--ink-3)]'}`}>
          © Copyright {year}, {LEGAL_NAMES[brand]}. All rights reserved.
        </span>
        {project?.clientLogo && (
          // The client's mark travels on every slide, not just the cover — a
          // white chip on dark styles for the same reason SKV needs one.
          <span className={`inline-flex items-center rounded ${dark ? 'bg-white/90 px-1.5 py-1' : ''}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={project.clientLogo} alt={project.client ? `${project.client} logo` : 'Client logo'} className="h-4 w-auto object-contain" />
          </span>
        )}
      </span>
    </div>
  );
}

type DrawTool = 'rect' | 'polygon' | 'pen';

const TOOLS: { key: DrawTool; label: string; hint: string }[] = [
  { key: 'rect', label: '▭ Rectangle', hint: 'Drag a box over the area. Shift for a square.' },
  { key: 'polygon', label: '⬡ Polygon', hint: 'Click each corner. Shift locks to 45°. Click the first point, or Enter, to close.' },
  { key: 'pen', label: '✎ Curve', hint: 'Hold and trace the edge — it smooths into a curve.' },
];

/** Regions the pen tool draws are curved; the others are straight-edged. */
function shapeForTool(tool: DrawTool): ShapeKind {
  return tool === 'pen' ? 'spline' : 'polygon';
}

/** A region drawn as a polygon on a source image. Editable mode: click to place
 * vertices, Finish once there are 3+, then pick the target view (+ optional video
 * timestamp); click a finished region to delete it. Non-editable (Presenter): click
 * a region to jump to its target, seeking the target video if a timestamp was set. */
function LinkedViewsExplorer({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const views = slide.fields.views ?? [];
  const [activeId, setActiveId] = useState<string | undefined>(views[0]?.id);
  const project = useEditorStore((s) => s.project);
  const selectSlide = useEditorStore((s) => s.selectSlide);
  const [tool, setTool] = useState<DrawTool | null>(null);
  const [drawingPoints, setDrawingPoints] = useState<Point[] | null>(null);
  /** Where the cursor is, for the rubber-band edge and the close-snap hint. */
  const [cursor, setCursor] = useState<Point | null>(null);
  /** True while a rect drag or a pen stroke is in progress. */
  const [dragging, setDragging] = useState(false);
  /** Shift held, read off the pointer event rather than tracked separately —
   *  a separate keydown listener can drift out of step with the pointer and
   *  then the preview and the committed point disagree. */
  const [ortho, setOrtho] = useState(false);
  const [pickingTarget, setPickingTarget] = useState(false);
  const [pendingTarget, setPendingTarget] = useState('');
  const [pendingTime, setPendingTime] = useState('');
  const [pendingFill, setPendingFill] = useState(DEFAULT_FILL);
  const [pendingFillOpacity, setPendingFillOpacity] = useState(DEFAULT_FILL_OPACITY);
  const [pendingStroke, setPendingStroke] = useState(DEFAULT_STROKE);
  const [pendingStrokeWidth, setPendingStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = views.find((v) => v.id === activeId) ?? views[0];

  function setView(id: string, patch: Partial<LinkedView>) {
    updateField('views', views.map((v) => (v.id === id ? { ...v, ...patch } : v)));
  }

  // Declared before the early return below so the hook order never changes.
  useEffect(() => {
    if (tool === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setDrawingPoints(null);
        setPickingTarget(false);
        setTool(null);
        setCursor(null);
        setDragging(false);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        setDrawingPoints((pts) => {
          if (pts && pts.length >= 3) setPickingTarget(true);
          return pts;
        });
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setDrawingPoints((pts) => (pts && pts.length > 1 ? pts.slice(0, -1) : null));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tool]);

  if (!active) return null;

  const otherViews = views.filter((v) => v.id !== active.id);
  const hotspots = active.hotspots ?? [];
  const targetView = otherViews.find((v) => `view:${v.id}` === pendingTarget);
  // Concept and design slides are the meaningful cross-slide destinations: a
  // zone on a plan should be able to point at the principle behind it.
  const linkableSlides = (project?.slides ?? []).filter(
    (s) => s.id !== slide.id && (s.conceptOrigin || s.style === 'design' || s.layout === 'linked-views'),
  );

  const drawing = tool !== null;
  /** Cursor is within snapping distance of the first vertex, so a click closes
   *  the shape rather than adding another point. */
  const canClose =
    tool === 'polygon' && !!drawingPoints && drawingPoints.length >= 3 && !!cursor && distance(cursor, drawingPoints[0]) < 0.02;

  function pointAt(e: React.PointerEvent<HTMLDivElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = clamp01({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    if (!e.shiftKey) return raw;

    const aspect = rect.width / rect.height;
    if (tool === 'rect') {
      // Anchored to the corner the drag started from.
      return drawingPoints?.[0] ? squareFrom(drawingPoints[0], raw, aspect) : raw;
    }
    if (tool === 'polygon') {
      const from = drawingPoints?.[drawingPoints.length - 1];
      return from ? snapAngle(from, raw, aspect) : raw;
    }
    // Freehand is freehand — constraining a traced curve would fight the hand.
    return raw;
  }

  function drawable(): boolean {
    return drawing && editable && !!active.url && active.kind !== 'walkthrough' && !pickingTarget;
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable()) return;
    setOrtho(e.shiftKey);
    const point = pointAt(e);

    if (tool === 'polygon') {
      if (canClose) {
        finishShape(drawingPoints!);
        return;
      }
      setDrawingPoints((prev) => {
        if (!prev) return [point];
        // A stray double-click used to leave a duplicate vertex and a kink.
        return isTooClose(prev, point) ? prev : [...prev, point];
      });
      return;
    }

    // Rect and pen are both drags, so capture the pointer to keep receiving
    // moves even if it leaves the box. Capture is an optimisation, not a
    // requirement — if it fails the drag must still start.
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // No active pointer to capture; pointermove on the box still works.
    }
    setDragging(true);
    setDrawingPoints([point]);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable()) return;
    setOrtho(e.shiftKey);
    const point = pointAt(e);
    setCursor(point);
    if (!dragging) return;

    if (tool === 'rect') {
      setDrawingPoints((prev) => (prev ? [prev[0], point] : [point]));
    } else if (tool === 'pen') {
      setDrawingPoints((prev) => {
        if (!prev) return [point];
        // Sample by distance, not by event — pointermove fires far denser than
        // the shape needs, and the stroke gets simplified again on finish.
        return isTooClose(prev, point, 0.004) ? prev : [...prev, point];
      });
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable() || !dragging) return;
    setOrtho(e.shiftKey);
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone; nothing to release.
    }
    const pts = drawingPoints;
    if (!pts) return;

    if (tool === 'rect' && pts.length === 2) {
      // pts[1] already carries the square constraint from pointAt.
      // Ignore an accidental click that produced no area.
      if (distance(pts[0], pts[1]) < 0.02) {
        setDrawingPoints(null);
        return;
      }
      finishShape(rectPoints(pts[0], pts[1]));
    } else if (tool === 'pen') {
      const thinned = simplify(pts);
      if (thinned.length < 3) {
        setDrawingPoints(null);
        return;
      }
      finishShape(thinned);
    }
  }

  /** Hands a completed outline to the target picker. */
  function finishShape(points: Point[]) {
    setDrawingPoints(points);
    startPickingTarget(points);
  }

  function undoPoint() {
    setDrawingPoints((prev) => (prev && prev.length > 1 ? prev.slice(0, -1) : null));
  }

  function cancelDrawing() {
    setDrawingPoints(null);
    setPickingTarget(false);
    setTool(null);
    setCursor(null);
    setDragging(false);
    setOrtho(false);
  }

  function selectView(id: string) {
    setActiveId(id);
    cancelDrawing();
  }

  function startPickingTarget(points: Point[] = drawingPoints ?? []) {
    if (points.length < 3) return;
    setPendingTarget(otherViews[0] ? `view:${otherViews[0].id}` : (linkableSlides[0] ? `slide:${linkableSlides[0].id}` : ''));
    setPendingTime('');
    setPendingFill(DEFAULT_FILL);
    setPendingFillOpacity(DEFAULT_FILL_OPACITY);
    setPendingStroke(DEFAULT_STROKE);
    setPendingStrokeWidth(DEFAULT_STROKE_WIDTH);
    setPickingTarget(true);
  }

  function confirmRegion() {
    if (!drawingPoints || drawingPoints.length < 3 || !pendingTarget) return;
    const time = pendingTime.trim() ? Number(pendingTime) : undefined;
    const [kind, targetId] = pendingTarget.split(':');
    const hotspot: ViewHotspot = {
      id: makeId('hotspot'),
      points: drawingPoints,
      shape: tool ? shapeForTool(tool) : 'polygon',
      ...(kind === 'slide' ? { targetSlideId: targetId } : { targetViewId: targetId }),
      targetTime: time,
      fillColor: pendingFill,
      fillOpacity: pendingFillOpacity,
      strokeColor: pendingStroke,
      strokeWidth: pendingStrokeWidth,
    };
    setView(active.id, { hotspots: [...hotspots, hotspot] });
    cancelDrawing();
  }

  function removeHotspot(id: string) {
    setView(active.id, { hotspots: hotspots.filter((h) => h.id !== id) });
  }

  function jumpTo(hotspot: ViewHotspot) {
    if (hotspot.targetSlideId) {
      selectSlide(hotspot.targetSlideId);
      return;
    }
    if (!hotspot.targetViewId) return;
    setActiveId(hotspot.targetViewId);
    if (hotspot.targetTime != null) {
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.currentTime = hotspot.targetTime!;
      });
    }
  }

  const centroid: Point | null = drawingPoints ? centroidOf(drawingPoints) : null;

  return (
    <div className="mt-6 flex flex-col">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {views.map((v) => (
          <button
            key={v.id}
            onClick={() => selectView(v.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
              v.id === active.id
                ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                : 'border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--ink-3)]'
            }`}
          >
            {v.label}
          </button>
        ))}
        {editable && active.url && active.kind !== 'walkthrough' && (
          <div className="ml-auto flex items-center gap-1.5">
            {TOOLS.map((t) => (
              <button
                key={t.key}
                onClick={() => {
                  setDrawingPoints(null);
                  setPickingTarget(false);
                  setTool(tool === t.key ? null : t.key);
                }}
                title={t.hint}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  tool === t.key
                    ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                    : 'border-dashed border-[var(--line)] text-[var(--ink-2)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className={`relative aspect-video w-full select-none ${drawing ? 'cursor-crosshair' : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setCursor(null)}
      >
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
            <path
              key={h.id}
              d={shapePath(h.points, h.shape)}
              vectorEffect="non-scaling-stroke"
              fill={h.fillColor ?? DEFAULT_FILL}
              fillOpacity={h.fillOpacity ?? DEFAULT_FILL_OPACITY}
              stroke={h.strokeColor ?? DEFAULT_STROKE}
              strokeWidth={h.strokeWidth ?? DEFAULT_STROKE_WIDTH}
              className={drawing ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer'}
              onClick={(e) => {
                e.stopPropagation();
                if (editable) removeHotspot(h.id);
                else jumpTo(h);
              }}
            >
              <title>
                {editable
                  ? 'Click to remove'
                  : h.targetSlideId
                    ? (project?.slides.find((s) => s.id === h.targetSlideId)?.fields.title ?? 'Linked slide')
                    : views.find((v) => v.id === h.targetViewId)?.label}
              </title>
            </path>
          ))}
          {drawingPoints && (
            <>
              {/* Rect previews as its filled box; the others as an open outline
                  so it's obvious the shape isn't closed yet. */}
              {tool === 'rect' && drawingPoints.length === 2 ? (
                <path
                  d={shapePath(rectPoints(drawingPoints[0], drawingPoints[1]))}
                  vectorEffect="non-scaling-stroke"
                  fill={DEFAULT_FILL}
                  fillOpacity={0.18}
                  className="stroke-[var(--accent)]"
                  strokeWidth={1.5}
                  strokeDasharray="4,3"
                />
              ) : (
                <path
                  d={previewPath(drawingPoints, tool ? shapeForTool(tool) : undefined)}
                  vectorEffect="non-scaling-stroke"
                  className="fill-none stroke-[var(--accent)]"
                  strokeWidth={1.5}
                  strokeDasharray={tool === 'pen' ? undefined : '4,3'}
                />
              )}

              {/* Rubber band from the last vertex to the cursor, so a polygon
                  shows the edge you're about to commit. */}
              {tool === 'polygon' && cursor && !pickingTarget && (
                <>
                  {/* Guide through the anchor, extended past the cursor, so a
                      locked direction reads as a direction and not just a
                      shorter rubber band. */}
                  {ortho && (
                    <line
                      x1={drawingPoints[drawingPoints.length - 1].x * 100}
                      y1={drawingPoints[drawingPoints.length - 1].y * 100}
                      x2={(drawingPoints[drawingPoints.length - 1].x + (cursor.x - drawingPoints[drawingPoints.length - 1].x) * 6) * 100}
                      y2={(drawingPoints[drawingPoints.length - 1].y + (cursor.y - drawingPoints[drawingPoints.length - 1].y) * 6) * 100}
                      vectorEffect="non-scaling-stroke"
                      className="stroke-[var(--accent)]"
                      strokeWidth={0.75}
                      strokeDasharray="1,4"
                      opacity={0.5}
                    />
                  )}
                  <line
                    x1={drawingPoints[drawingPoints.length - 1].x * 100}
                    y1={drawingPoints[drawingPoints.length - 1].y * 100}
                    x2={cursor.x * 100}
                    y2={cursor.y * 100}
                    vectorEffect="non-scaling-stroke"
                    className="stroke-[var(--accent)]"
                    strokeWidth={ortho ? 1.75 : 1}
                    strokeDasharray={ortho ? undefined : '2,3'}
                    opacity={ortho ? 1 : 0.7}
                  />
                </>
              )}

              {tool !== 'pen' &&
                drawingPoints.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x * 100}
                    cy={p.y * 100}
                    r={i === 0 && canClose ? 1.8 : 0.9}
                    vectorEffect="non-scaling-stroke"
                    className={i === 0 && canClose ? 'fill-[var(--accent)] stroke-white' : 'fill-white stroke-[var(--accent)]'}
                    strokeWidth={1.5}
                  />
                ))}
            </>
          )}
        </svg>

        {drawing && !pickingTarget && (
          <div onPointerDown={(e) => e.stopPropagation()} className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white">
            {tool === 'polygon' && drawingPoints ? (
              <>
                <span>
                  {drawingPoints.length} point{drawingPoints.length === 1 ? '' : 's'}
                </span>
                <button onClick={undoPoint} className="underline decoration-white/50 hover:decoration-white">
                  Undo
                </button>
                <button
                  onClick={() => startPickingTarget()}
                  disabled={drawingPoints.length < 3}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 font-semibold disabled:opacity-40"
                >
                  {drawingPoints.length < 3 ? `Finish (${3 - drawingPoints.length} more)` : canClose ? 'Click first point' : 'Finish'}
                </button>
              </>
            ) : (
              <span>{TOOLS.find((t) => t.key === tool)?.hint}</span>
            )}
            {tool !== 'pen' && (
              <span className={ortho ? 'font-semibold text-[#7fd1ff]' : 'text-white/50'}>
                {ortho ? (tool === 'rect' ? '⇧ square' : '⇧ 45° locked') : '⇧ to constrain'}
              </span>
            )}
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
              {otherViews.length > 0 && (
                <optgroup label="This slide">
                  {otherViews.map((v) => (
                    <option key={v.id} value={`view:${v.id}`}>
                      {v.label}
                    </option>
                  ))}
                </optgroup>
              )}
              {linkableSlides.length > 0 && (
                <optgroup label="Another slide">
                  {linkableSlides.map((s) => (
                    <option key={s.id} value={`slide:${s.id}`}>
                      {s.fields.title || 'Untitled slide'}
                    </option>
                  ))}
                </optgroup>
              )}
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

            <div className="mb-2 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Fill</span>
                <input
                  type="color"
                  value={pendingFill}
                  onChange={(e) => setPendingFill(e.target.value)}
                  className="h-7 w-full cursor-pointer rounded border border-[var(--line)] p-0.5"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Stroke</span>
                <input
                  type="color"
                  value={pendingStroke}
                  onChange={(e) => setPendingStroke(e.target.value)}
                  className="h-7 w-full cursor-pointer rounded border border-[var(--line)] p-0.5"
                />
              </label>
            </div>
            <label className="mb-1.5 block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-semibold text-[var(--ink-3)]">
                <span>Fill opacity</span>
                <span>{Math.round(pendingFillOpacity * 100)}%</span>
              </span>
              <input
                type="range"
                min={5}
                max={90}
                value={Math.round(pendingFillOpacity * 100)}
                onChange={(e) => setPendingFillOpacity(Number(e.target.value) / 100)}
                className="w-full"
              />
            </label>
            <label className="mb-2 block">
              <span className="mb-1 flex items-center justify-between text-[10px] font-semibold text-[var(--ink-3)]">
                <span>Stroke width</span>
                <span>{pendingStrokeWidth}px</span>
              </span>
              <input
                type="range"
                min={0.5}
                max={4}
                step={0.5}
                value={pendingStrokeWidth}
                onChange={(e) => setPendingStrokeWidth(Number(e.target.value))}
                className="w-full"
              />
            </label>

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

function ConceptBody({ slide, editable, animate, dark }: SlideRendererProps & { dark?: boolean }) {
  const updateField = useEditorStore((s) => s.updateField);
  const addPoint = useEditorStore((s) => s.addPoint);
  const removePoint = useEditorStore((s) => s.removePoint);
  const points = slide.fields.points ?? [];

  function setPoint(id: string, label: string) {
    updateField('points', points.map((pt) => (pt.id === id ? { ...pt, label } : pt)));
  }

  return (
    <div className="mt-6 flex items-center gap-10">
      <div className="flex min-w-0 flex-1 flex-col">
        <Kicker slide={slide} editable={editable} />
        <Title slide={slide} editable={editable} dark={dark} />
        <EditableText
          editable={editable}
          value={slide.fields.lead ?? ''}
          onChange={(v) => updateField('lead', v)}
          as="p"
          className="mt-4 max-w-md text-lg leading-snug text-[var(--ink-2)] outline-none"
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {points.map((pt) => (
            <span
              key={pt.id}
              className="group/pt relative inline-flex items-center rounded-md border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-2"
            >
              <EditableText
                editable={editable}
                value={pt.label}
                onChange={(v) => setPoint(pt.id, v)}
                as="span"
                className="text-[13px] font-medium leading-none text-[var(--accent)] outline-none"
              />
              {editable && (
                <button
                  onClick={() => removePoint(pt.id)}
                  aria-label={`Remove ${pt.label}`}
                  className="ml-1.5 hidden text-[10px] text-[var(--ink-3)] hover:text-red-500 group-hover/pt:block"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          {editable && (
            <button
              onClick={addPoint}
              className="rounded-md border border-dashed border-[var(--line)] px-3 py-2 text-[13px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              + Point
            </button>
          )}
        </div>
      </div>

      {/* The visual half. A generated diagram is the default so the slide is
          never just text; pasting a real plan or render replaces it. */}
      {slide.fields.visual === 'image' || slide.fields.imageUrl ? (
        <div className="relative w-[42%] shrink-0">
          <MediaBox
            url={slide.fields.imageUrl ?? ''}
            kind="image"
            editable={editable}
            onChangeUrl={(url) => updateField('imageUrl', url)}
            className="aspect-[4/3] w-full"
          />
          {editable && !slide.fields.imageUrl && (
            <button
              onClick={() => updateField('visual', 'diagram')}
              className="absolute bottom-2 right-2 rounded-md border border-dashed border-[var(--line)] bg-white/80 px-2 py-1 text-[10px] font-semibold text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Back to diagram
            </button>
          )}
        </div>
      ) : (
        <div className="relative w-[42%] shrink-0">
          <ConceptDiagram
            pillarId={slide.conceptOrigin?.pillarId}
            conceptId={slide.conceptOrigin?.conceptId}
            labels={points.map((pt) => pt.label)}
            seedKey={slide.id}
            animate={animate}
            className="aspect-[4/3] w-full"
          />
          {editable && (
            <button
              onClick={() => updateField('visual', 'image')}
              className="absolute bottom-2 right-2 rounded-md border border-dashed border-[var(--line)] bg-white/80 px-2 py-1 text-[10px] font-semibold text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              Use an image instead
            </button>
          )}
        </div>
      )}
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

export function SlideRenderer({ slide, editable, animate = false }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const accentColor = useEditorStore((s) => s.project?.accentColor) ?? DEFAULT_ACCENT;
  const dark = slide.style === 'section-starter' || slide.style === 'design';

  const entry = slide.animation?.entry ?? 'none';
  const animClass = animate && entry !== 'none' ? `slide-anim-${entry}` : '';

  const base = (
    <div
      className={`relative flex min-h-full w-full flex-col justify-center px-16 pb-14 pt-10 ${animClass} ${dark ? 'bg-[var(--ink)]' : 'bg-white'}`}
      style={
        {
          '--slide-anim-duration': `${slide.animation?.duration ?? 600}ms`,
          '--slide-anim-delay': `${slide.animation?.delay ?? 0}ms`,
          // Every accent-coloured thing on a slide reads from these, so a
          // project-level accent flows through without touching each component.
          '--accent': accentColor,
          '--accent-soft': tintWithWhite(accentColor, 0.9),
          '--accent-soft-line': tintWithWhite(accentColor, 0.78),
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
          <ClientLogo editable={editable} dark={dark} />
        </div>
      ) : slide.layout === 'blank' ? null : slide.layout === 'concept' ? (
        <ConceptBody slide={slide} editable={editable} animate={animate} dark={dark} />
      ) : (
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

      <LinkedSlideChips slide={slide} dark={dark} />
      <BrandFooter slide={slide} dark={dark} />
    </div>
  );

  return base;
}
