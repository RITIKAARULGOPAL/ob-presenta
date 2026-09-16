'use client';

import { useEffect, useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore } from '@/lib/editorStore';
import { shadeWithBlack, tintWithWhite } from '@/lib/color';
import { resolveTypography, headlineStyle } from '@/lib/fonts';
import { dataUrlBytes, fileToDataUrl, fileToSlideImage } from '@/lib/imageFile';
import {
  centroidOf,
  clamp01,
  distance,
  isTooClose,
  previewPath,
  rectPoints,
  hasEnoughPoints,
  shapePath,
  snapAngle,
  squareFrom,
  type ShapeKind,
} from '@/lib/hotspotShape';
import { ConceptDiagram } from './ConceptDiagram';
import { HotspotSidePanel } from './HotspotSidePanel';
import { Lightbox } from './Lightbox';
import { OrbitDiagram } from './OrbitDiagram';
import { SiteLocusDiagram } from './SiteLocusDiagram';
import { MaterialCompare } from './MaterialCompare';
import { OccupancyChart } from './OccupancyChart';
import { ImageAdjustOverlay } from './ImageAdjustOverlay';
import { LogoAdjustOverlay } from './LogoAdjustOverlay';
import { clamp, imageStyle, maxPan, MAX_ZOOM, MIN_ZOOM } from '@/lib/imageTransform';
import { makeId } from '@/lib/id';
import type { Brand, HotspotGalleryImage, ImageTransform, LinkedView, Slide, ViewHotspot } from '@/types/slide';
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
 * deck load. Used for Design slides, Linked-Views tabs and the concept slot.
 *
 * An image can also be zoomed, panned, rotated and faded in place — click it
 * to select it and show the handles, the same way Slides does, rather than
 * through a separate "Adjust" button; see ImageAdjustOverlay. `allowAdjust`
 * is turned off inside Linked Views while a hotspot tool is selected, so the
 * two drag gestures (drawing a hotspot vs. panning the photo) never compete
 * for the same pointer events, and a plain click there falls through to
 * placing/drawing a hotspot instead of selecting the photo. */
function MediaBox({
  url,
  kind,
  editable,
  onChangeUrl,
  transform,
  onChangeTransform,
  allowAdjust = true,
  className,
  mediaRef,
  elevated = false,
}: {
  url: string;
  kind: 'image' | 'video';
  editable: boolean;
  onChangeUrl: (url: string) => void;
  transform?: ImageTransform;
  onChangeTransform?: (t: ImageTransform | undefined) => void;
  allowAdjust?: boolean;
  className?: string;
  mediaRef?: React.Ref<HTMLVideoElement>;
  /** A larger radius + a real soft shadow instead of the plain frame — for a
   *  slide's one hero image (the `design` style), not every MediaBox use. */
  elevated?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const canUpload = editable && kind === 'image';
  const canAdjust = canUpload && allowAdjust && !!onChangeTransform;

  useEffect(() => {
    if (!url) setAdjusting(false);
  }, [url]);

  function openPicker() {
    if (!fileRef.current) {
      // Diagnostic only — if this ever fires, the ref genuinely wasn't
      // attached when the click happened, which would explain a silent
      // no-op click with no other symptom.
      console.warn('MediaBox: file input ref was not attached when "Choose a file" was clicked.');
      return;
    }
    fileRef.current.click();
  }

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
      onChangeTransform?.(undefined);
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
    <div className={`relative ${className ?? ''}`}>
      <div
        ref={frameRef}
        className={`relative h-full w-full overflow-hidden bg-black/30 ${elevated ? 'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]' : 'rounded-lg'} ${dragging ? 'ring-2 ring-[var(--accent)]' : ''} ${
          canAdjust && url && !adjusting ? 'cursor-pointer' : ''
        }`}
        onClick={canAdjust && url && !adjusting ? () => setAdjusting(true) : undefined}
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
            <img src={url} alt="" style={imageStyle(transform)} className="h-full w-full object-cover" />
          )
        ) : (
          <div
            className={`flex h-full flex-col items-center justify-center gap-2 text-sm text-white/40 ${canUpload ? 'cursor-pointer' : ''}`}
            // Click anywhere in the empty-state box, not just the small
            // button — a bigger hit target, and a fallback in case
            // something is only covering the button's own exact bounds.
            onClick={canUpload ? (e) => { e.stopPropagation(); openPicker(); } : undefined}
          >
            {canUpload ? (
              <>
                <span>{dragging ? 'Drop to add' : busy ? 'Reading image…' : 'Drag an image here'}</span>
                <button
                  onClick={(e) => { e.stopPropagation(); openPicker(); }}
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
            className="absolute h-px w-px overflow-hidden opacity-0"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void accept(file);
            }}
          />
        )}

        {editable && !adjusting && (
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
              {/* Replace lives in the on-image toolbar once selected (click the
                  image) — a photo doesn't also need a standalone Upload button
                  here. Video has no adjust overlay, so it keeps Upload as its
                  only way to swap the file. */}
              {canUpload && !canAdjust && (
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
                  onClick={(e) => { e.stopPropagation(); onChangeUrl(''); onChangeTransform?.(undefined); setNote(''); }}
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

      {canAdjust && url && adjusting && (
        <ImageAdjustOverlay
          frameRef={frameRef}
          transform={transform}
          onChange={(t) => onChangeTransform?.(t)}
          onDone={() => setAdjusting(false)}
          onReplace={openPicker}
          onRemove={() => { onChangeUrl(''); onChangeTransform?.(undefined); setAdjusting(false); setNote(''); }}
        />
      )}
    </div>
  );
}

export const DEFAULT_ACCENT = '#000000';

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

/** The client's logo on the title slide. With no logo yet, it's an upload
 * control — click to pick a file, matching how every other bit of media in
 * this app is set inline rather than through a settings screen. Once a logo
 * is set, clicking it directly selects it and shows the same kind of
 * on-canvas resize/rotate handles a MediaBox photo gets (see
 * LogoAdjustOverlay for why it's a separate component: a logo has no
 * cropping frame to pan around inside of, so a corner handle resizes the
 * whole picture instead of cropping into it) — replacing or removing the
 * logo happens from that overlay's toolbar, not a standalone button. */
function ClientLogo({ editable, dark }: { editable: boolean; dark: boolean }) {
  const project = useEditorStore((s) => s.project);
  const setClientLogo = useEditorStore((s) => s.setClientLogo);
  const setClientLogoTransform = useEditorStore((s) => s.setClientLogoTransform);
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
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
    setAdjusting(false);
  }

  if (!logo && !editable) return null;

  return (
    <div className="mt-10 flex flex-col items-center gap-2">
      {logo ? (
        <div className="relative inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt={project?.client ? `${project.client} logo` : 'Client logo'}
            style={imageStyle(project?.clientLogoTransform)}
            onClick={editable && !adjusting ? () => setAdjusting(true) : undefined}
            className={`h-10 w-auto object-contain ${editable && !adjusting ? 'cursor-pointer' : ''}`}
          />
          {editable && adjusting && (
            <LogoAdjustOverlay
              transform={project?.clientLogoTransform}
              onChange={(t) => setClientLogoTransform(t)}
              onDone={() => setAdjusting(false)}
              onReplace={() => inputRef.current?.click()}
              onRemove={() => {
                setClientLogo(undefined);
                setClientLogoTransform(undefined);
                setAdjusting(false);
              }}
            />
          )}
        </div>
      ) : null}
      {editable && (
        <>
          <input ref={inputRef} type="file" accept="image/*" onChange={handlePick} className="absolute h-px w-px overflow-hidden opacity-0" />
          {!logo && (
            <button
              onClick={() => inputRef.current?.click()}
              className={`rounded-md border border-dashed px-2.5 py-1 text-[10px] font-semibold transition ${
                dark ? 'border-white/30 text-white/60 hover:border-white/60' : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {busy ? 'Reading…' : '+ Add client logo'}
            </button>
          )}
        </>
      )}
    </div>
  );
}

/** The title slide's optional full-bleed looping background video. URL-only
 *  (like a linked-views walkthrough) — a base64 video would be tens of
 *  megabytes in the project row. Renders nothing at all in Presenter/export
 *  when unset, rather than an empty placeholder box, since a title slide
 *  with no video should look exactly like it always has. */
function HeroVideo({ url, editable, onChangeUrl }: { url?: string; editable: boolean; onChangeUrl: (url: string) => void }) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [draft, setDraft] = useState(url ?? '');

  if (!url && !editable) return null;

  return (
    <>
      {url && (
        <>
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video
            src={url}
            autoPlay
            muted
            loop
            playsInline
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
          />
          <div className="pointer-events-none absolute inset-0 -z-10 bg-black/45" />
        </>
      )}
      {editable && (
        <div className="absolute inset-x-0 -top-8 flex justify-center">
          {editingUrl ? (
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2 py-1 shadow-lg">
              <input
                autoFocus
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onChangeUrl(draft.trim());
                    setEditingUrl(false);
                  } else if (e.key === 'Escape') {
                    setEditingUrl(false);
                  }
                }}
                placeholder="Paste video URL…"
                className="w-56 text-xs text-[var(--ink)] outline-none"
              />
              <button
                onClick={() => {
                  onChangeUrl(draft.trim());
                  setEditingUrl(false);
                }}
                className="shrink-0 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                Set
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setDraft(url ?? '');
                setEditingUrl(true);
              }}
              className={`rounded-md border border-dashed px-2.5 py-1 text-[10px] font-semibold transition ${
                url ? 'border-white/30 text-white/70 hover:border-white/60' : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
              }`}
            >
              {url ? 'Replace hero video' : '+ Add hero video'}
            </button>
          )}
          {url && !editingUrl && (
            <button
              onClick={() => onChangeUrl('')}
              className="ml-1.5 rounded-md border border-dashed border-white/30 px-2 py-1 text-[10px] font-semibold text-white/70 hover:border-red-400 hover:text-red-300"
            >
              Remove
            </button>
          )}
        </div>
      )}
    </>
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
            <img
              src={project.clientLogo}
              alt={project.client ? `${project.client} logo` : 'Client logo'}
              style={imageStyle(project.clientLogoTransform)}
              className="h-4 w-auto object-contain"
            />
          </span>
        )}
      </span>
    </div>
  );
}

type DrawTool = 'rect' | 'ellipse' | 'polygon';

const TOOLS: { key: DrawTool; label: string; hint: string }[] = [
  { key: 'rect', label: '▭ Rectangle', hint: 'Drag a box over the area. Shift for a square.' },
  { key: 'ellipse', label: '◯ Ellipse', hint: 'Drag to size it. Shift for a circle.' },
  { key: 'polygon', label: '⬡ Polygon', hint: 'Click each corner. Shift locks to 45°. Click the first point, or Enter, to close.' },
];

function shapeForTool(tool: DrawTool): ShapeKind {
  return tool === 'ellipse' ? 'ellipse' : 'polygon';
}

/** Rect and ellipse are drags; polygon is a series of clicks. */
function isDragTool(tool: DrawTool | null): boolean {
  return tool === 'rect' || tool === 'ellipse';
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
  const [pendingLabel, setPendingLabel] = useState('');
  const [pendingListOn, setPendingListOn] = useState(false);
  const [pendingListValue, setPendingListValue] = useState('');
  const [pendingListDescription, setPendingListDescription] = useState('');
  const [pendingGallery, setPendingGallery] = useState<HotspotGalleryImage[]>([]);
  const [galleryBusy, setGalleryBusy] = useState(false);
  const galleryFileRef = useRef<HTMLInputElement>(null);
  /** Set while editing an existing hotspot's label/list/style rather than
   *  drawing a new one — the popup is shared between both flows. */
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  /** One id, read by both the hotspot <path> and the side-list row it
   *  matches, so highlighting the two can never drift out of sync. */
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  /** The hotspot whose gallery is open in the lightbox (view mode only). */
  const [lightboxHotspotId, setLightboxHotspotId] = useState<string | null>(null);
  /** Which named stage is active — undefined means "no stages defined" or
   *  "first one," both of which fall back to the view's own url/transform. */
  const [activeStageId, setActiveStageId] = useState<string | undefined>(undefined);
  /** Which stages the hotspot being drawn/edited is active on. Empty = every
   *  stage (matches `stageIds` being unset on save). */
  const [pendingStageIds, setPendingStageIds] = useState<string[]>([]);
  /** Which occupancy-chart zone this hotspot jumps to, when the chosen target
   *  is an occupancy-chart slide. */
  const [pendingZoneId, setPendingZoneId] = useState('');
  const setFocusZoneId = useEditorStore((s) => s.setFocusZoneId);
  /** Transient viewer-only zoom/pan — never written to `ImageTransform` or the
   *  project, just a magnifier over the authored crop. Reset whenever the
   *  shown view/stage changes so it never looks "stuck" on a new image. */
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportPanX, setViewportPanX] = useState(0);
  const [viewportPanY, setViewportPanY] = useState(0);
  const panRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const zoomPanActiveRef = useRef(false);
  /** True for the one click that immediately follows a pan drag that actually
   *  moved — read and cleared by the hotspot's own onClick, since pointerup
   *  fires (and clears panRef) before the browser's click event does. */
  const justPannedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const active = views.find((v) => v.id === activeId) ?? views[0];
  const activeStage = active?.stages?.find((s) => s.id === activeStageId) ?? active?.stages?.[0];

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

  // Separate from the drawing-tool effect above: editing an existing
  // hotspot's label/list/style needs no tool selected at all, so it needs its
  // own Escape handling rather than piggy-backing on the one gated by `tool`.
  useEffect(() => {
    if (!editingHotspotId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        setEditingHotspotId(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [editingHotspotId]);

  useEffect(() => {
    setViewportZoom(1);
    setViewportPanX(0);
    setViewportPanY(0);
  }, [activeId, activeStageId]);

  if (!active) return null;

  const otherViews = views.filter((v) => v.id !== active.id);
  const allHotspots = active.hotspots ?? [];
  // Unset stageIds = active on every stage — matters both for hotspots drawn
  // before stages existed and for a view that never defines any.
  const hotspots = activeStage ? allHotspots.filter((h) => !h.stageIds || h.stageIds.includes(activeStage.id)) : allHotspots;
  const stageUrl = activeStage?.url ?? active.url;
  const stageTransform = activeStage?.url ? activeStage.transform : active.transform;
  // Unset means "show it exactly when something would appear in it" — computed
  // here, once, rather than re-derived wherever it's read.
  const showHotspotList = active.showHotspotList ?? hotspots.some((h) => h.listEntry);
  const editingHotspot = hotspots.find((h) => h.id === editingHotspotId) ?? null;
  const targetView = otherViews.find((v) => `view:${v.id}` === pendingTarget);
  // Concept and design slides are the meaningful cross-slide destinations: a
  // zone on a plan should be able to point at the principle behind it.
  const linkableSlides = (project?.slides ?? []).filter(
    (s) => s.id !== slide.id && (s.conceptOrigin || s.style === 'design' || s.layout === 'linked-views' || s.layout === 'occupancy-chart'),
  );
  const targetOccupancySlide = linkableSlides.find((s) => `slide:${s.id}` === pendingTarget && s.layout === 'occupancy-chart');

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
    if (isDragTool(tool)) {
      // Anchored to the corner the drag started from: a square box, and so a
      // circle for the ellipse inscribed in it.
      return drawingPoints?.[0] ? squareFrom(drawingPoints[0], raw, aspect) : raw;
    }
    const from = drawingPoints?.[drawingPoints.length - 1];
    return from ? snapAngle(from, raw, aspect) : raw;
  }

  function drawable(): boolean {
    return drawing && editable && !!active.url && active.kind !== 'walkthrough' && !pickingTarget;
  }

  /** Whether the viewer's own magnifier (distinct from the authored crop) is
   *  allowed right now — gated on `tool === null` exactly like `MediaBox`'s
   *  own `allowAdjust`, so it never competes with drawing or the edit popup.
   *  Viewer-only: in the editor, dragging the image already means "adjust the
   *  authored crop" (MediaBox's own overlay) — zoom/pan only takes over once
   *  there's no editing gesture it could compete with. */
  const zoomPanActive = !!active.zoomPanEnabled && !editable && tool === null && !editingHotspotId && !pickingTarget;
  // Read inside the native wheel listener below without re-subscribing it
  // every render — React's own onWheel is passive and can't preventDefault.
  zoomPanActiveRef.current = zoomPanActive;

  useEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!zoomPanActiveRef.current) return;
      e.preventDefault();
      setViewportZoom((z) => clamp(z + (e.deltaY < 0 ? 0.2 : -0.2), MIN_ZOOM, MAX_ZOOM));
    }
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Re-clamp pan whenever zoom changes (zooming out must not leave the pan
  // further from center than the new zoom level allows).
  useEffect(() => {
    const limit = maxPan(viewportZoom) * 100;
    setViewportPanX((x) => clamp(x, -limit, limit));
    setViewportPanY((y) => clamp(y, -limit, limit));
  }, [viewportZoom]);

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable()) {
      if (zoomPanActive && viewportZoom > 1) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // No active pointer to capture; pointermove still works without it.
        }
        panRef.current = { startX: e.clientX, startY: e.clientY, startPanX: viewportPanX, startPanY: viewportPanY, moved: false };
        justPannedRef.current = false;
      }
      return;
    }
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

    // Both drag tools capture the pointer to keep receiving
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
    if (!drawable()) {
      const pan = panRef.current;
      if (!pan) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const dxPct = ((e.clientX - pan.startX) / rect.width) * 100;
      const dyPct = ((e.clientY - pan.startY) / rect.height) * 100;
      // A few px of jitter shouldn't disqualify what's really just a click.
      if (Math.abs(dxPct) + Math.abs(dyPct) > 0.6) pan.moved = true;
      const limit = maxPan(viewportZoom) * 100;
      setViewportPanX(clamp(pan.startPanX + dxPct, -limit, limit));
      setViewportPanY(clamp(pan.startPanY + dyPct, -limit, limit));
      return;
    }
    setOrtho(e.shiftKey);
    const point = pointAt(e);
    setCursor(point);
    if (!dragging) return;

    if (isDragTool(tool)) {
      setDrawingPoints((prev) => (prev ? [prev[0], point] : [point]));
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!drawable()) {
      if (panRef.current) {
        if (panRef.current.moved) justPannedRef.current = true;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          // Capture may already be gone; nothing to release.
        }
        panRef.current = null;
      }
      return;
    }
    if (!dragging) return;
    setOrtho(e.shiftKey);
    setDragging(false);
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone; nothing to release.
    }
    const pts = drawingPoints;
    if (!pts) return;

    if (!isDragTool(tool) || pts.length !== 2) return;
    // pts[1] already carries the square constraint from pointAt. Ignore an
    // accidental click that produced no area.
    if (distance(pts[0], pts[1]) < 0.02) {
      setDrawingPoints(null);
      return;
    }
    // An ellipse keeps the two corners; a rectangle expands to four.
    finishShape(tool === 'ellipse' ? pts : rectPoints(pts[0], pts[1]));
  }

  /** Hands a completed outline to the target picker. */
  function finishShape(points: Point[]) {
    setDrawingPoints(points);
    startPickingTarget(points);
  }

  /** Clears the outline but keeps the tool armed, so regions can be added one
   *  after another without re-picking the tool each time. */
  function resetShape() {
    setDrawingPoints(null);
    setPickingTarget(false);
    setCursor(null);
    setDragging(false);
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
    setEditingHotspotId(null);
  }

  function selectView(id: string) {
    setActiveId(id);
    cancelDrawing();
  }

  /** Shared by both the create-a-new-hotspot flow and the edit-an-existing-one
   *  flow — the popup's fields are identical, only what happens on confirm
   *  differs. */
  function loadPendingFrom(h?: ViewHotspot) {
    setPendingTarget(h?.targetSlideId ? `slide:${h.targetSlideId}` : h?.targetViewId ? `view:${h.targetViewId}` : otherViews[0] ? `view:${otherViews[0].id}` : linkableSlides[0] ? `slide:${linkableSlides[0].id}` : '');
    setPendingTime(h?.targetTime != null ? String(h.targetTime) : '');
    setPendingFill(h?.fillColor ?? DEFAULT_FILL);
    setPendingFillOpacity(h?.fillOpacity ?? DEFAULT_FILL_OPACITY);
    setPendingStroke(h?.strokeColor ?? DEFAULT_STROKE);
    setPendingStrokeWidth(h?.strokeWidth ?? DEFAULT_STROKE_WIDTH);
    setPendingLabel(h?.label ?? '');
    setPendingListOn(!!h?.listEntry);
    setPendingListValue(h?.listEntry?.value ?? '');
    setPendingListDescription(h?.listEntry?.description ?? '');
    setPendingGallery(h?.gallery ?? []);
    setPendingStageIds(h?.stageIds ?? []);
    setPendingZoneId(h?.targetZoneId ?? '');
  }

  function startPickingTarget(points: Point[] = drawingPoints ?? []) {
    if (!hasEnoughPoints(points, tool ? shapeForTool(tool) : 'polygon')) return;
    loadPendingFrom();
    setPickingTarget(true);
  }

  /** Opens the same popup used to configure a just-drawn hotspot, but bound
   *  to an existing one instead — this is the only way to add a label/side-
   *  list entry to a hotspot after the fact, so clicking a hotspot no longer
   *  deletes it outright (see the Remove button in the popup instead). */
  function startEditingHotspot(h: ViewHotspot) {
    loadPendingFrom(h);
    setEditingHotspotId(h.id);
  }

  function buildListEntry(existingId?: string): ViewHotspot['listEntry'] {
    if (!pendingListOn) return undefined;
    return {
      id: existingId ?? makeId('list'),
      label: pendingLabel.trim() || 'Untitled',
      value: pendingListValue.trim() || undefined,
      description: pendingListDescription.trim() || undefined,
    };
  }

  function confirmRegion() {
    const shape = tool ? shapeForTool(tool) : 'polygon';
    if (!hasEnoughPoints(drawingPoints, shape) || !pendingTarget) return;
    const time = pendingTime.trim() ? Number(pendingTime) : undefined;
    const [kind, targetId] = pendingTarget.split(':');
    const hotspot: ViewHotspot = {
      id: makeId('hotspot'),
      points: drawingPoints!,
      shape,
      ...(kind === 'slide' ? { targetSlideId: targetId } : { targetViewId: targetId }),
      targetTime: time,
      fillColor: pendingFill,
      fillOpacity: pendingFillOpacity,
      strokeColor: pendingStroke,
      strokeWidth: pendingStrokeWidth,
      label: pendingLabel.trim() || undefined,
      listEntry: buildListEntry(),
      gallery: pendingGallery.length ? pendingGallery : undefined,
      stageIds: pendingStageIds.length ? pendingStageIds : undefined,
      targetZoneId: kind === 'slide' && pendingZoneId ? pendingZoneId : undefined,
    };
    setView(active.id, { hotspots: [...allHotspots, hotspot] });
    // Stay on the tool rather than dropping out after every single region.
    resetShape();
  }

  function saveHotspotEdit() {
    if (!editingHotspot || !pendingTarget) return;
    const time = pendingTime.trim() ? Number(pendingTime) : undefined;
    const [kind, targetId] = pendingTarget.split(':');
    setView(active.id, {
      hotspots: allHotspots.map((h) =>
        h.id === editingHotspot.id
          ? {
              ...h,
              ...(kind === 'slide' ? { targetSlideId: targetId, targetViewId: undefined } : { targetViewId: targetId, targetSlideId: undefined }),
              targetTime: time,
              fillColor: pendingFill,
              fillOpacity: pendingFillOpacity,
              strokeColor: pendingStroke,
              strokeWidth: pendingStrokeWidth,
              label: pendingLabel.trim() || undefined,
              listEntry: buildListEntry(h.listEntry?.id),
              gallery: pendingGallery.length ? pendingGallery : undefined,
              stageIds: pendingStageIds.length ? pendingStageIds : undefined,
              targetZoneId: kind === 'slide' && pendingZoneId ? pendingZoneId : undefined,
            }
          : h,
      ),
    });
    setEditingHotspotId(null);
  }

  function removeHotspot(id: string) {
    setView(active.id, { hotspots: allHotspots.filter((h) => h.id !== id) });
    setEditingHotspotId((cur) => (cur === id ? null : cur));
  }

  function jumpTo(hotspot: ViewHotspot) {
    if (hotspot.gallery?.length) {
      setLightboxHotspotId(hotspot.id);
      return;
    }
    if (hotspot.targetSlideId) {
      selectSlide(hotspot.targetSlideId);
      if (hotspot.targetZoneId) setFocusZoneId(hotspot.targetZoneId);
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
  const editingCentroid: Point | null = editingHotspot ? centroidOf(editingHotspot.points) : null;
  const showPopup = pickingTarget || !!editingHotspotId;
  const popupCentroid = editingHotspotId ? editingCentroid : centroid;

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
            <label className="flex items-center gap-1 text-[11px] font-medium text-[var(--ink-3)]" title="Lets viewers wheel-zoom and drag-pan this image (Presenter/view mode only)">
              <input
                type="checkbox"
                checked={!!active.zoomPanEnabled}
                onChange={(e) => setView(active.id, { zoomPanEnabled: e.target.checked })}
                className="accent-[var(--accent)]"
              />
              Zoom/pan
            </label>
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
      {(active.stages?.length || editable) && active.kind !== 'walkthrough' && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {active.stages?.map((s) => (
            <button
              key={s.id}
              onClick={() => setActiveStageId(s.id)}
              className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition ${
                s.id === activeStage?.id
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
              }`}
            >
              {s.label}
            </button>
          ))}
          {editable && (
            <button
              onClick={() => {
                const stage = { id: makeId('stage'), label: `Stage ${(active.stages?.length ?? 0) + 1}` };
                setView(active.id, { stages: [...(active.stages ?? []), stage] });
                setActiveStageId(stage.id);
              }}
              className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
            >
              + Stage
            </button>
          )}
        </div>
      )}
      <div className="flex gap-4">
      <div
        ref={stageBoxRef}
        className={`relative aspect-video min-w-0 flex-1 select-none overflow-hidden ${
          drawing ? 'cursor-crosshair' : zoomPanActive && viewportZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setCursor(null)}
      >
      <div
        className="h-full w-full transition-transform duration-100 ease-out"
        style={{ transform: `scale(${viewportZoom}) translate(${viewportPanX}%, ${viewportPanY}%)` }}
      >
        <MediaBox
          url={stageUrl}
          kind={active.kind === 'walkthrough' ? 'video' : 'image'}
          editable={editable}
          onChangeUrl={(url) =>
            activeStage
              ? setView(active.id, { stages: active.stages!.map((s) => (s.id === activeStage.id ? { ...s, url } : s)) })
              : setView(active.id, { url })
          }
          transform={stageTransform}
          onChangeTransform={(t) =>
            activeStage
              ? setView(active.id, { stages: active.stages!.map((s) => (s.id === activeStage.id ? { ...s, transform: t } : s)) })
              : setView(active.id, { transform: t })
          }
          allowAdjust={tool === null}
          className="h-full w-full"
          mediaRef={active.kind === 'walkthrough' ? videoRef : undefined}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {hotspots.filter((h) => hasEnoughPoints(h.points, h.shape)).map((h) => (
            <path
              key={h.id}
              d={shapePath(h.points, h.shape)}
              vectorEffect="non-scaling-stroke"
              fill={h.fillColor ?? DEFAULT_FILL}
              fillOpacity={hoveredHotspotId === h.id ? Math.min(1, (h.fillOpacity ?? DEFAULT_FILL_OPACITY) * 1.8) : (h.fillOpacity ?? DEFAULT_FILL_OPACITY)}
              stroke={h.strokeColor ?? DEFAULT_STROKE}
              strokeWidth={hoveredHotspotId === h.id ? (h.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 1.6 : (h.strokeWidth ?? DEFAULT_STROKE_WIDTH)}
              className={drawing ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer transition-[fill-opacity,stroke-width]'}
              onMouseEnter={() => !drawing && setHoveredHotspotId(h.id)}
              onMouseLeave={() => setHoveredHotspotId((cur) => (cur === h.id ? null : cur))}
              onClick={(e) => {
                e.stopPropagation();
                // A pan gesture that ended over a hotspot must not also fire
                // its click — only a real (near-stationary) click should.
                if (justPannedRef.current) {
                  justPannedRef.current = false;
                  return;
                }
                if (editable) startEditingHotspot(h);
                else jumpTo(h);
              }}
            >
              <title>
                {editable
                  ? 'Click to edit'
                  : h.label ||
                    (h.targetSlideId
                      ? (project?.slides.find((s) => s.id === h.targetSlideId)?.fields.title ?? 'Linked slide')
                      : views.find((v) => v.id === h.targetViewId)?.label)}
              </title>
            </path>
          ))}
          {drawingPoints && (
            <>
              {/* A drag tool previews filled, since its shape is already
                  closed; a polygon previews as an open outline. */}
              {isDragTool(tool) && drawingPoints.length === 2 ? (
                <path
                  d={
                    tool === 'ellipse'
                      ? shapePath(drawingPoints, 'ellipse')
                      : shapePath(rectPoints(drawingPoints[0], drawingPoints[1]))
                  }
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
                  strokeDasharray="4,3"
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

              {drawingPoints.map((p, i) => (
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
      </div>

        {zoomPanActive && viewportZoom > 1 && (
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => {
              setViewportZoom(1);
              setViewportPanX(0);
              setViewportPanY(0);
            }}
            className="absolute right-2 top-2 z-20 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/85"
          >
            Reset zoom
          </button>
        )}

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
            <span className={ortho ? 'font-semibold text-[#7fd1ff]' : 'text-white/50'}>
              {ortho
                ? tool === 'rect'
                  ? '⇧ square'
                  : tool === 'ellipse'
                    ? '⇧ circle'
                    : '⇧ 45° locked'
                : '⇧ to constrain'}
            </span>
            <button onClick={cancelDrawing} className="underline decoration-white/50 hover:decoration-white">
              Cancel
            </button>
          </div>
        )}

        {showPopup && popupCentroid && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ left: `${popupCentroid.x * 100}%`, top: `${popupCentroid.y * 100}%` }}
            className="absolute z-20 w-60 -translate-x-1/2 -translate-y-1/2 rounded-lg border border-[var(--line)] bg-white p-3 shadow-xl"
          >
            <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]">
              {editingHotspotId ? 'Edit hotspot' : 'New hotspot'}
            </div>
            <input
              value={pendingLabel}
              onChange={(e) => setPendingLabel(e.target.value)}
              placeholder="Label (optional)"
              className="mb-2 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
            />
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
            {targetOccupancySlide && (
              <select
                value={pendingZoneId}
                onChange={(e) => setPendingZoneId(e.target.value)}
                className="mb-2 w-full rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
              >
                <option value="">Jump to slide (no specific zone)</option>
                {(targetOccupancySlide.fields.occupancyZones ?? []).map((z) => (
                  <option key={z.id} value={z.id}>
                    Highlight: {z.label}
                  </option>
                ))}
              </select>
            )}
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

            <label className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold text-[var(--ink-3)]">
              <input type="checkbox" checked={pendingListOn} onChange={(e) => setPendingListOn(e.target.checked)} className="accent-[var(--accent)]" />
              Add to side list
            </label>
            {pendingListOn && (
              <div className="mb-2 flex flex-col gap-1.5 rounded-md bg-[var(--surface-2)] p-2">
                <input
                  value={pendingListValue}
                  onChange={(e) => setPendingListValue(e.target.value)}
                  placeholder="Value, e.g. 24 sqm (optional)"
                  className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs outline-none"
                />
                <textarea
                  value={pendingListDescription}
                  onChange={(e) => setPendingListDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full resize-none rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs outline-none"
                />
              </div>
            )}

            {!!active.stages?.length && (
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Active on</span>
                <div className="flex flex-wrap gap-2">
                  {active.stages.map((s) => (
                    <label key={s.id} className="flex items-center gap-1 text-[11px] text-[var(--ink-2)]">
                      <input
                        type="checkbox"
                        checked={pendingStageIds.length === 0 || pendingStageIds.includes(s.id)}
                        onChange={(e) =>
                          setPendingStageIds((prev) => {
                            const base = prev.length === 0 ? active.stages!.map((st) => st.id) : prev;
                            return e.target.checked ? [...base, s.id] : base.filter((id) => id !== s.id);
                          })
                        }
                        className="accent-[var(--accent)]"
                      />
                      {s.label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Gallery images</span>
              {pendingGallery.length > 0 && (
                <div className="mb-1.5 flex flex-wrap gap-1.5">
                  {pendingGallery.map((img) => (
                    <div key={img.id} className="group relative h-10 w-10 overflow-hidden rounded border border-[var(--line)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="" className="h-full w-full object-cover" />
                      <button
                        onClick={() => setPendingGallery((g) => g.filter((i) => i.id !== img.id))}
                        className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-bold text-white opacity-0 group-hover:opacity-100"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button
                type="button"
                onClick={() => galleryFileRef.current?.click()}
                className="w-full rounded-md border border-dashed border-[var(--line)] px-2 py-1.5 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                {galleryBusy ? 'Adding…' : '+ Add image'}
              </button>
              <input
                ref={galleryFileRef}
                type="file"
                accept="image/*"
                className="absolute h-px w-px overflow-hidden opacity-0"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  e.target.value = '';
                  if (!file) return;
                  setGalleryBusy(true);
                  try {
                    const url = await fileToSlideImage(file);
                    setPendingGallery((g) => [...g, { id: makeId('gal'), url }]);
                  } catch (err) {
                    console.error('Could not read that image:', err);
                  }
                  setGalleryBusy(false);
                }}
              />
            </div>

            <div className="flex gap-2">
              <button
                onClick={editingHotspotId ? saveHotspotEdit : confirmRegion}
                className="flex-1 rounded-md bg-[var(--accent)] px-2 py-1.5 text-xs font-semibold text-white"
              >
                {editingHotspotId ? 'Save' : 'Add region'}
              </button>
              {editingHotspotId && (
                <button
                  onClick={() => removeHotspot(editingHotspotId)}
                  className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium text-red-500 hover:border-red-300"
                >
                  Remove
                </button>
              )}
              <button onClick={cancelDrawing} className="rounded-md border border-[var(--line)] px-2 py-1.5 text-xs font-medium text-[var(--ink-2)]">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
      {(() => {
        const lightboxHotspot = hotspots.find((h) => h.id === lightboxHotspotId && h.gallery?.length);
        return lightboxHotspot ? (
          <Lightbox
            images={lightboxHotspot.gallery!}
            keyPlanImage={lightboxHotspot.keyPlanImage}
            onClose={() => setLightboxHotspotId(null)}
          />
        ) : null;
      })()}
      {showHotspotList && (
        <HotspotSidePanel
          hotspots={hotspots.filter((h) => h.listEntry)}
          hoveredId={hoveredHotspotId}
          onHover={setHoveredHotspotId}
          onSelect={(h) => (editable ? startEditingHotspot(h) : jumpTo(h))}
        />
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
        placeholder="Section"
        className="text-[var(--accent)] outline-none"
      />
      {(editable ? slide.fields.kickerLabel !== undefined : !!slide.fields.kickerLabel?.trim()) && (
        <>
          <span className="h-px w-6 bg-[var(--line)]" />
          <EditableText
            editable={editable}
            value={slide.fields.kickerLabel ?? ''}
            onChange={(v) => updateField('kickerLabel', v)}
            as="span"
            placeholder="Label"
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
      placeholder="Slide title"
      style={headlineStyle(1.875)}
      className={`font-display leading-tight outline-none ${dark ? 'text-white' : 'text-[var(--accent)]'}`}
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
      placeholder="Body copy"
      className="mt-4 max-w-2xl text-base leading-relaxed text-[var(--ink-2)] outline-none"
    />
  );
}

function StatsRow({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const addStatItem = useEditorStore((s) => s.addStatItem);
  const removeStatItem = useEditorStore((s) => s.removeStatItem);
  const stats = slide.fields.stats ?? [];
  // Editing shows every slot, so there is something to type into. A deck shows
  // only what was written — an untouched slide reads as blank rather than as a
  // row of empty boxes.
  const shownStats = editable ? stats : stats.filter((st) => st.value.trim() || st.label.trim());

  function setStat(id: string, patch: Partial<{ value: string; label: string }>) {
    updateField(
      'stats',
      stats.map((st) => (st.id === id ? { ...st, ...patch } : st))
    );
  }

  if (!editable && shownStats.length === 0) return null;

  const tinted = slide.style === 'company';

  return (
    <div className="mt-8">
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${Math.min(shownStats.length, 4) || 1}, 1fr)` }}
      >
        {shownStats.map((st) => (
          <div
            key={st.id}
            className={`rounded-[var(--radius-md)] p-5 shadow-[var(--shadow-sm)] ${tinted ? 'bg-[var(--accent-wash)]' : 'bg-white border border-[var(--line)]'}`}
          >
            <EditableText
              editable={editable}
              value={st.value}
              onChange={(v) => setStat(st.id, { value: v })}
              as="div"
              placeholder="0"
              style={headlineStyle(1.875)}
              className="font-display text-[var(--accent)] outline-none"
            />
            <EditableText
              editable={editable}
              value={st.label}
              onChange={(v) => setStat(st.id, { label: v })}
              as="div"
              placeholder="Label"
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
  const shownItems = editable ? items : items.filter((it) => it.label.trim());
  const result = slide.fields.result?.trim() ?? '';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-8">
      <div className="flex flex-col gap-4">
        {shownItems.map((it) => (
          <div key={it.id} className="flex items-center gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-[var(--line)] bg-[var(--surface-2)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--ink-3)]" />
            </span>
            <EditableText
              editable={editable}
              value={it.label}
              onChange={(v) => updateField('items', items.map((i) => (i.id === it.id ? { ...i, label: v } : i)))}
              as="span"
              placeholder="Item"
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
      {(editable || result) && (
        <>
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
              placeholder="Result"
              className="text-sm font-semibold text-[var(--ink)] outline-none"
            />
          </div>
        </>
      )}
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
        placeholder="0"
        style={headlineStyle(6)}
        className="font-display leading-none text-[var(--accent)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.statLabel ?? ''}
        onChange={(v) => updateField('statLabel', v)}
        as="div"
        placeholder="Stat description"
        className="mt-3 text-sm font-semibold uppercase tracking-wide text-[var(--ink-3)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.caption ?? ''}
        onChange={(v) => updateField('caption', v)}
        as="p"
        placeholder="Supporting caption"
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
  const shownPoints = editable ? points : points.filter((pt) => pt.label.trim());

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
          placeholder="One line describing the principle"
          className="mt-4 max-w-md text-lg leading-snug text-[var(--ink-2)] outline-none"
        />

        <div className="mt-6 flex flex-wrap gap-2">
          {shownPoints.map((pt) => (
            <span
              key={pt.id}
              className="group/pt relative inline-flex items-center rounded-md border border-[var(--accent-soft-line)] bg-[var(--accent-soft)] px-3 py-2"
            >
              <EditableText
                editable={editable}
                value={pt.label}
                onChange={(v) => setPoint(pt.id, v)}
                as="span"
                placeholder="Point"
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
            transform={slide.fields.imageTransform}
            onChangeTransform={(t) => updateField('imageTransform', t)}
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
        placeholder="Left column"
        className="flex-1 text-base leading-relaxed text-[var(--ink-2)] outline-none"
      />
      <EditableText
        editable={editable}
        value={slide.fields.rightColumn ?? ''}
        onChange={(v) => updateField('rightColumn', v)}
        as="p"
        placeholder="Right column"
        className="flex-1 text-base leading-relaxed text-[var(--ink-2)] outline-none"
      />
    </div>
  );
}

export function SlideRenderer({ slide, editable, animate = false }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const accentColor = useEditorStore((s) => s.project?.accentColor) ?? DEFAULT_ACCENT;
  const projectFontFamily = useEditorStore((s) => s.project?.fontFamily);
  const projectTypography = useEditorStore((s) => s.project?.typography);
  // font's own project-level default is `project.fontFamily`, a field of its
  // own predating TypographySettings (see resolveTypography in fonts.ts) —
  // folded in here so a slide's typographyOverride.font still resolves
  // through the same slide-then-project-then-built-in chain as the rest.
  const typography = resolveTypography({ ...projectTypography, font: projectFontFamily }, slide.typographyOverride);
  const dark = slide.style === 'section-starter' || slide.style === 'design';

  const entry = slide.animation?.entry ?? 'none';
  const animClass = animate && entry !== 'none' ? `slide-anim-${entry}` : '';

  const base = (
    <div
      className={`relative flex min-h-full w-full flex-col justify-center px-16 pb-14 pt-10 ${animClass} ${dark ? 'bg-[var(--ink)] [background-image:radial-gradient(120%_90%_at_15%_-10%,var(--dark-veil-1),var(--dark-veil-2)_60%)]' : 'bg-white'}`}
      style={
        {
          '--slide-anim-duration': `${slide.animation?.duration ?? 600}ms`,
          '--slide-anim-delay': `${slide.animation?.delay ?? 0}ms`,
          // Every accent-coloured thing on a slide reads from these, so a
          // project-level accent flows through without touching each component.
          '--accent': accentColor,
          '--accent-soft': tintWithWhite(accentColor, 0.9),
          '--accent-soft-line': tintWithWhite(accentColor, 0.78),
          // Lighter than --accent-soft, for larger surface fills (a whole
          // card) rather than small chip-sized tints.
          '--accent-wash': tintWithWhite(accentColor, 0.96),
          '--accent-line-strong': tintWithWhite(accentColor, 0.55),
          // Dark-style backgrounds (section-starter/design) read as a radial
          // gradient tied to the deck's own accent instead of flat ink, so
          // every deck's dark slides feel designed for that deck specifically.
          '--dark-veil-1': shadeWithBlack(accentColor, 0.55),
          '--dark-veil-2': '#141a2b',
          // Tailwind's font-display utility resolves --font-display, which
          // globals.css points at --font-archivo — redeclaring it here, at the
          // slide's own scope, is what lets a project's font choice reach every
          // font-display element below without touching each component, same
          // trick as the accent vars above. It's a live CSS var reference, not a
          // static substitution, so this keeps resolving correctly however many
          // var() layers of indirection sit in between.
          '--font-archivo': typography.fontVar,
          // Body text never sets an explicit font-family (it just inherits the
          // theme's --font-sans default), so overriding --font-geist-sans here
          // reaches every kicker, description and caption below the same way
          // --font-archivo reaches every font-display headline — no changes
          // needed in Kicker/Body/TwoContent/etc. themselves.
          '--font-geist-sans': typography.bodyFontVar,
          // headlineStyle() (fonts.ts) reads these three on each of the six
          // headline/hero-number elements, so one slide-level resolve here
          // reaches all of them.
          '--type-scale': typography.scaleMultiplier,
          '--headline-weight': typography.weightValue,
          '--headline-tracking': typography.trackingValue,
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
            placeholder="01"
            style={headlineStyle(6)}
            className="font-display leading-none text-white/15 outline-none"
          />
          <EditableText
            editable={editable}
            value={slide.fields.title ?? ''}
            onChange={(v) => updateField('title', v)}
            as="h1"
            placeholder="Section title"
            style={headlineStyle(2.25)}
            className="mt-2 font-display text-white outline-none"
          />
          <EditableText
            editable={editable}
            value={slide.fields.subtitle ?? ''}
            onChange={(v) => updateField('subtitle', v)}
            as="p"
            placeholder="Chapter subtitle"
            className="mx-auto mt-4 max-w-lg text-white/65 outline-none"
          />
        </div>
      ) : slide.layout === 'title-slide' ? (
        <div className="relative text-center">
          <HeroVideo url={slide.fields.heroVideoUrl} editable={editable} onChangeUrl={(url) => updateField('heroVideoUrl', url)} />
          <div className="relative">
            <Kicker slide={slide} editable={editable} />
            <EditableText
              editable={editable}
              value={slide.fields.title ?? ''}
              onChange={(v) => updateField('title', v)}
              as="h1"
              placeholder="Presentation title"
              style={headlineStyle(3)}
              className={`font-display outline-none ${slide.fields.heroVideoUrl ? 'text-white' : 'text-[var(--accent)]'}`}
            />
            <EditableText
              editable={editable}
              value={slide.fields.subtitle ?? ''}
              onChange={(v) => updateField('subtitle', v)}
              as="p"
              placeholder="Subtitle"
              className={`mx-auto mt-4 max-w-lg outline-none ${slide.fields.heroVideoUrl ? 'text-white/80' : 'text-[var(--ink-2)]'}`}
            />
            <ClientLogo editable={editable} dark={dark || !!slide.fields.heroVideoUrl} />
          </div>
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
          {slide.layout === 'orbit' && <OrbitDiagram slide={slide} editable={editable} />}
          {slide.layout === 'site-locus' && <SiteLocusDiagram slide={slide} editable={editable} />}
          {slide.layout === 'material-compare' && <MaterialCompare slide={slide} editable={editable} />}
          {slide.layout === 'occupancy-chart' && <OccupancyChart slide={slide} editable={editable} />}
          {slide.style === 'design' && (
            <MediaBox
              url={slide.fields.imageUrl ?? ''}
              kind="image"
              editable={editable}
              onChangeUrl={(url) => updateField('imageUrl', url)}
              transform={slide.fields.imageTransform}
              onChangeTransform={(t) => updateField('imageTransform', t)}
              className="mt-6 aspect-video w-full max-w-xl"
              elevated
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
