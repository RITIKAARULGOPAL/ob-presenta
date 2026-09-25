'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { EditableText } from './EditableText';
import { useEditorStore, type DrawTool } from '@/lib/editorStore';
import { shadeWithBlack, tintWithWhite } from '@/lib/color';
import { resolveTypography, headlineStyle } from '@/lib/fonts';
import { dataUrlBytes, fileToDataUrl, fileToSlideImage } from '@/lib/imageFile';
import { loadPdfDocument, preparePdfPlan, renderPlanPage } from '@/lib/pdfPlan';
import { buildSnapIndex, snapTo, type SnapResult } from '@/lib/planSnap';
import {
  boundingBoxOf,
  centroidOf,
  clamp01,
  distance,
  isTooClose,
  previewPath,
  rectPoints,
  hasEnoughPoints,
  shapeArea,
  shapePath,
  simplifyPath,
  snapAngle,
  squareFrom,
  type ShapeKind,
} from '@/lib/hotspotShape';
import { calibrationFrom, formatArea, formatMeasure, realArea, realDistance, zoneColor } from '@/lib/planOverlay';
import { ConceptDiagram } from './ConceptDiagram';
import { HotspotSidePanel } from './HotspotSidePanel';
import { SeatingTable } from './SeatingTable';
import { Lightbox } from './Lightbox';
import { SpaceDetailOverlay } from './SpaceDetailOverlay';
import { OrbitDiagram } from './OrbitDiagram';
import { SiteLocusDiagram } from './SiteLocusDiagram';
import { MaterialCompare } from './MaterialCompare';
import { ImageAdjustOverlay } from './ImageAdjustOverlay';
import { LogoAdjustOverlay } from './LogoAdjustOverlay';
import PlanTimeline from './PlanTimeline';
import { SplitStylePreviewIcon } from './SplitStylePreviewIcon';
import { morphShapes } from '@/lib/shapeMorph';
import { clamp, imageStyle, maxPan, MAX_ZOOM, MIN_ZOOM } from '@/lib/imageTransform';
import { makeId } from '@/lib/id';
import type { Brand, FreeformElement, HotspotGalleryImage, ImageTransform, LinkedView, PlanCalibration, PlanGeometry, Slide, ViewHotspot } from '@/types/slide';
import type { Point } from '@/lib/hotspotShape';

type PdfDocument = import('pdfjs-dist').PDFDocumentProxy;

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
  style,
  mediaRef,
  elevated = false,
  square = false,
  fit = 'cover',
  onPdfPlan,
}: {
  url: string;
  kind: 'image' | 'video';
  editable: boolean;
  onChangeUrl: (url: string) => void;
  transform?: ImageTransform;
  onChangeTransform?: (t: ImageTransform | undefined) => void;
  allowAdjust?: boolean;
  className?: string;
  style?: React.CSSProperties;
  mediaRef?: React.Ref<HTMLVideoElement>;
  /** `contain` shows the whole picture, letterboxed. Plans need it — a floor
   *  plan is rarely 16:9, and `cover` would crop away the parts of the drawing
   *  you then cannot click. Photos keep `cover`. */
  fit?: 'cover' | 'contain';
  /** Opt-in: when set, an uploaded PDF also yields its vector geometry for
   *  snapping. The image and geometry arrive together so the caller can commit
   *  them in **one** patch — two writes into the same array field in one tick
   *  clobber each other (see `setView`). */
  onPdfPlan?: (plan: { imageUrl: string; geometry: PlanGeometry }) => void;
  /** A larger radius + a real soft shadow instead of the plain frame — for a
   *  slide's one hero image (the `design` style), not every MediaBox use. */
  elevated?: boolean;
  /** No rounding at all — for a full-bleed slot flush with the slide's own
   *  edges (e.g. an "as is" imported slide), where any radius would visibly
   *  clip the image's own corners. */
  square?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [note, setNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);
  const [pdfPick, setPdfPick] = useState<{ doc: PdfDocument; numPages: number; page: number } | null>(null);
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

  /** Renders one PDF page in and, when the caller asked for it, reads the
   *  drawing's vector geometry so measurements can snap to real walls. */
  async function applyPdfPage(doc: PdfDocument, pageNumber: number) {
    setBusy(true);
    setNote('Reading the plan…');
    try {
      if (onPdfPlan) {
        const { imageUrl, geometry } = await preparePdfPlan(doc, pageNumber, FRAME_ASPECT);
        onPdfPlan({ imageUrl, geometry });
        const kb = Math.round(dataUrlBytes(imageUrl) / 1024);
        const points = geometry.vertices.length / 2;
        setNote(
          points === 0
            ? `Added — ${kb}KB. No vector lines in this PDF (it looks scanned), so picks won't snap.`
            : `Added — ${kb}KB · ${points} snap points${geometry.truncated ? ' (plan is dense, trimmed to the busiest lines)' : ''}.`,
        );
      } else {
        const imageUrl = await renderPlanPage(doc, pageNumber);
        onChangeUrl(imageUrl);
        onChangeTransform?.(undefined);
        setNote(`Added — ${Math.round(dataUrlBytes(imageUrl) / 1024)}KB.`);
      }
      setPdfPick(null);
    } catch (err) {
      console.error('Could not read that PDF page:', err);
      setNote('Could not read that PDF page.');
    } finally {
      setBusy(false);
    }
  }

  async function accept(file: File | undefined) {
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf && !file.type.startsWith('image/')) {
      setNote('That file is not an image or a PDF.');
      return;
    }
    setBusy(true);
    setNote('');
    try {
      if (isPdf) {
        const doc = await loadPdfDocument(file);
        if (doc.numPages === 1) {
          await applyPdfPage(doc, 1);
        } else {
          // Don't guess which page is the plan. No thumbnail strip either:
          // these decks run to hundreds of pages.
          setPdfPick({ doc, numPages: doc.numPages, page: 1 });
          setNote(`${doc.numPages} pages — pick the one with the plan.`);
        }
        return;
      }
      const dataUrl = await fileToSlideImage(file);
      onChangeUrl(dataUrl);
      onChangeTransform?.(undefined);
      const kb = Math.round(dataUrlBytes(dataUrl) / 1024);
      // Worth saying out loud: this lands in the project row, not a bucket.
      setNote(kb > 700 ? `Added — ${kb}KB, which is heavy for one slide.` : `Added — ${kb}KB.`);
    } catch (err) {
      console.error('Could not read that file:', err);
      setNote(isPdf ? 'Could not read that PDF.' : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`relative ${className ?? ''}`} style={style}>
      <div
        ref={frameRef}
        className={`relative h-full w-full overflow-hidden ${
          // A letterboxed plan reads as a sheet of paper, not a photo in a
          // dark mount, so the bars around it are white rather than the
          // usual scrim.
          fit === 'contain' && url ? 'bg-white' : 'bg-black/30'
        } ${square ? '' : elevated ? 'rounded-[var(--deck-radius-lg)] shadow-[var(--deck-shadow-lg)]' : 'rounded-lg'} ${dragging ? 'ring-2 ring-[var(--accent)]' : ''} ${
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
            <img
              src={url}
              alt=""
              style={imageStyle(transform)}
              className={`h-full w-full ${fit === 'contain' ? 'object-contain' : 'object-cover'}`}
            />
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
                <span>
                  {dragging
                    ? 'Drop to add'
                    : busy
                      ? 'Reading…'
                      : onPdfPlan
                        ? 'Drag a plan here — a vector PDF snaps to points and lines while calibrating'
                        : 'Drag an image here'}
                </span>
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
            accept="image/*,application/pdf"
            className="absolute h-px w-px overflow-hidden opacity-0"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              void accept(file);
            }}
          />
        )}

        {pdfPick && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-2 bg-black/80 p-3 text-white"
          >
            <span className="text-xs text-white/80">Which page is the plan?</span>
            <div className="flex items-center gap-1.5">
              <input
                type="number"
                min={1}
                max={pdfPick.numPages}
                value={pdfPick.page}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setPdfPick((cur) => (cur ? { ...cur, page: Math.min(cur.numPages, Math.max(1, Math.round(n))) } : cur));
                  }
                }}
                className="w-16 rounded-md border border-white/25 bg-black/60 px-2 py-1 text-center text-xs outline-none"
              />
              <span className="text-[11px] text-white/60">of {pdfPick.numPages}</span>
              <button
                disabled={busy}
                onClick={() => void applyPdfPage(pdfPick.doc, pdfPick.page)}
                className="rounded-md bg-white px-2.5 py-1 text-[11px] font-semibold text-black hover:bg-white/90 disabled:opacity-50"
              >
                {busy ? 'Reading…' : 'Use this page'}
              </button>
              <button
                onClick={() => { setPdfPick(null); setNote(''); }}
                className="rounded-md border border-white/25 px-2 py-1 text-[11px] text-white/70 hover:text-white"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {editable && !adjusting && (
          <div className="absolute inset-x-2 bottom-2 flex flex-col gap-1">
            {note && <span className="rounded bg-black/70 px-2 py-0.5 text-[10px] text-white/80">{note}</span>}
            <div className="flex gap-1">
              {/* Image has real upload paths now (drag-drop, Choose a file,
                  PDF plans) — a paste-URL fallback next to all of that is just
                  clutter, so it's video-only: video has no adjust overlay and
                  no upload path at all (a base64 video would be tens of
                  megabytes in the project row, see imageFile.ts), so a pasted
                  URL is its *only* way to get a source. */}
              {kind === 'video' && (
                <input
                  value={url}
                  onChange={(e) => onChangeUrl(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  placeholder="Paste video URL…"
                  className="min-w-0 flex-1 rounded-md border border-white/20 bg-black/60 px-2 py-1 text-xs text-white outline-none placeholder:text-white/40"
                />
              )}
              {/* Replace lives in the on-image toolbar once selected (click the
                  image) — a photo doesn't also need a standalone Upload button
                  here. */}
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

/** The linked-views stage box is `aspect-video`, so the frame every hotspot
 *  coordinate, calibration and PDF snap point is normalised against is always
 *  16:9 — no measuring needed, and the number holds at any render size, export
 *  scale or viewer zoom. Module-level because `MediaBox` needs it too, to place
 *  a PDF plan's geometry into that same space at upload. */
const FRAME_ASPECT = 16 / 9;

/** How close, in on-screen pixels, a pointer has to be before a pick snaps to
 *  the plan's geometry. Generous enough to catch a corner without hunting,
 *  tight enough that two walls a few pixels apart stay separately selectable. */
const SNAP_SCREEN_PX = 12;

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

/** One text box on a `'freeform'` slide — shows its original rich, per-run
 *  styling (e.g. one pink word inside an otherwise black headline) until
 *  actually edited, at which point a real edit collapses it to a single
 *  plain-styled run. contentEditable directly on the rich markup rather than
 *  reusing EditableText, since EditableText only takes one flat string/style
 *  and would flatten the multi-run look on every render, not just on edit. */
function FreeformTextBox({
  el,
  editable,
  onChange,
}: {
  el: FreeformElement & { type: 'text' };
  editable: boolean;
  onChange: (patch: Partial<FreeformElement & { type: 'text' }>) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const plainText = el.paragraphs.map((p) => p.runs.map((r) => r.text).join('')).join('\n');

  return (
    <div
      ref={ref}
      contentEditable={editable}
      suppressContentEditableWarning
      className="h-full w-full overflow-hidden outline-none"
      style={{
        fontSize: `${el.fontSize}px`,
        fontFamily: el.fontFamily,
        lineHeight: 1.25,
      }}
      onBlur={(e) => {
        const newText = e.currentTarget.innerText.replace(/\n+$/, '');
        if (newText === plainText) return;
        const first = el.paragraphs[0]?.runs[0];
        onChange({
          paragraphs: [{ align: el.paragraphs[0]?.align ?? 'left', runs: [{ text: newText, bold: first?.bold, italic: first?.italic, color: first?.color }] }],
        });
      }}
    >
      {el.paragraphs.map((p, i) => (
        <div key={i} style={{ textAlign: p.align }}>
          {p.runs.map((r, j) => (
            <span key={j} style={{ fontWeight: r.bold ? 700 : 400, fontStyle: r.italic ? 'italic' : 'normal', color: r.color }}>
              {r.text}
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

const FREEFORM_DRAG_THRESHOLD_PX = 4;
const SNAP_THRESHOLD_PX = 6;

/** Candidate alignment lines for one axis: the slide's own edges/center,
 *  plus every other element's edges/center on that axis. Checked against
 *  the dragged element's own left/center/right (or top/center/bottom) —
 *  whichever pairing is closest, within `SNAP_THRESHOLD_PX`, wins. Returns
 *  the snapped coordinate unchanged if nothing is close enough to snap to.
 *  Pixel-based threshold (via `containerSize`) rather than a fixed fraction,
 *  so the snap distance feels the same regardless of slide/element size. */
function snapAxis(rawStart: number, size: number, others: number[], containerSize: number): { value: number; guide: number | null } {
  const edges = [rawStart, rawStart + size / 2, rawStart + size];
  const candidates = [0, 0.5, 1, ...others];

  let best: { deltaPx: number; delta: number; candidate: number } | null = null;
  for (const edge of edges) {
    for (const candidate of candidates) {
      const deltaPx = Math.abs(edge - candidate) * containerSize;
      if (deltaPx <= SNAP_THRESHOLD_PX && (!best || deltaPx < best.deltaPx)) {
        best = { deltaPx, delta: edge - candidate, candidate };
      }
    }
  }
  return best ? { value: rawStart - best.delta, guide: best.candidate } : { value: rawStart, guide: null };
}

/** Wraps one freeform element with drag-to-move: the wrapper owns absolute
 *  positioning and the pointer gesture, and its child just fills it at
 *  100%/100%, keeping its own click/edit behavior (MediaBox's adjust mode,
 *  the text box's contentEditable) for a plain click that never crossed the
 *  drag threshold. A capture-phase click listener swallows the click that
 *  would otherwise follow a completed drag's pointerup — the same "a real
 *  drag isn't also a click" rule the linked-views hotspot canvas already
 *  applies to its own pan-vs-click disambiguation.
 *
 *  Safe to layer on top of MediaBox's own adjust-mode dragging (pan/zoom/
 *  rotate handles): `ImageAdjustOverlay` stops propagation on every
 *  pointerdown inside itself, so none of that ever reaches this wrapper's
 *  own `onPointerDown` — the two never compete for the same gesture. */
function FreeformElementWrapper({
  el,
  editable,
  containerRef,
  siblings,
  onMoveEnd,
  onGuideChange,
  children,
}: {
  el: FreeformElement;
  editable: boolean;
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** Every other element on this slide, read fresh at drag-start — used to
   *  compute snap candidates (their edges/centers), never mutated here. */
  siblings: FreeformElement[];
  onMoveEnd: (pos: { x: number; y: number }) => void;
  /** Reports the alignment guide line(s) currently active for THIS drag, so
   *  the shared slide-level overlay can draw them; called with {x:null,
   *  y:null} once the drag ends. */
  onGuideChange: (guides: { x: number | null; y: number | null }) => void;
  children: React.ReactNode;
}) {
  const elRef = useRef(el);
  elRef.current = el;
  const siblingsRef = useRef(siblings);
  siblingsRef.current = siblings;
  // `onMoveEnd` is a fresh inline closure every time `FreeformSlide` renders
  // (`onMoveEnd={(pos) => setElement(el.id, pos)}`), and calling `onGuideChange`
  // on every pointermove — needed so the guide line actually tracks the drag
  // — triggers exactly that parent re-render mid-drag. If `onPointerUp`
  // closed over `onMoveEnd` directly, that dependency change would give it a
  // new identity mid-drag too, which would fire the cleanup `useEffect`
  // below (its deps include `onPointerUp`) and unregister both window
  // listeners *before* the real pointerup ever arrives — the drag would
  // silently stop committing and the guide line would never clear, with
  // nothing to log because the listener genuinely isn't there anymore.
  // Mirroring it into a ref keeps `onPointerUp`'s own identity stable across
  // any number of mid-drag re-renders, so the listeners survive until the
  // real pointerup.
  const onMoveEndRef = useRef(onMoveEnd);
  onMoveEndRef.current = onMoveEnd;
  const dragRef = useRef<{ startClientX: number; startClientY: number; startX: number; startY: number; moved: boolean } | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  // Mirrors `live` outside React state so onPointerUp can read the final
  // position as a plain synchronous value. Calling `onMoveEnd` (a store
  // write) from inside a setState *updater* — the obvious-looking
  // `setLive((pos) => { onMoveEnd(pos); return null })` — actually commits
  // the move twice in dev: StrictMode intentionally double-invokes updater
  // functions to catch exactly this kind of side effect hiding in one.
  const liveRef = useRef<{ x: number; y: number } | null>(null);
  const justDraggedRef = useRef(false);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      const container = containerRef.current;
      if (!drag || !container) return;
      if (!drag.moved && Math.hypot(e.clientX - drag.startClientX, e.clientY - drag.startClientY) < FREEFORM_DRAG_THRESHOLD_PX) return;
      drag.moved = true;
      const rect = container.getBoundingClientRect();
      const { w, h } = elRef.current;
      const rawX = clamp(drag.startX + (e.clientX - drag.startClientX) / rect.width, 0, 1 - w);
      const rawY = clamp(drag.startY + (e.clientY - drag.startClientY) / rect.height, 0, 1 - h);
      const others = siblingsRef.current;
      const snapX = snapAxis(rawX, w, others.flatMap((o) => [o.x, o.x + o.w / 2, o.x + o.w]), rect.width);
      const snapY = snapAxis(rawY, h, others.flatMap((o) => [o.y, o.y + o.h / 2, o.y + o.h]), rect.height);
      const next = { x: snapX.value, y: snapY.value };
      liveRef.current = next;
      setLive(next);
      onGuideChange({ x: snapX.guide, y: snapY.guide });
    },
    [containerRef, onGuideChange],
  );

  const onPointerUp = useCallback(() => {
    if (dragRef.current?.moved && liveRef.current) {
      justDraggedRef.current = true;
      onMoveEndRef.current(liveRef.current);
    }
    liveRef.current = null;
    setLive(null);
    onGuideChange({ x: null, y: null });
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPointerMove, onGuideChange]);

  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    },
    [onPointerMove, onPointerUp],
  );

  return (
    <div
      className="absolute"
      style={{
        left: `${(live?.x ?? el.x) * 100}%`,
        top: `${(live?.y ?? el.y) * 100}%`,
        width: `${el.w * 100}%`,
        height: `${el.h * 100}%`,
        cursor: editable ? 'move' : undefined,
      }}
      onPointerDown={(e) => {
        if (!editable) return;
        dragRef.current = { startClientX: e.clientX, startClientY: e.clientY, startX: el.x, startY: el.y, moved: false };
        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      }}
      onClickCapture={(e) => {
        if (justDraggedRef.current) {
          justDraggedRef.current = false;
          e.stopPropagation();
        }
      }}
    >
      {children}
    </div>
  );
}

/** A slide imported "as is" from an external file (see conceptSlides.ts) —
 *  every photo/text block/shape from the source sits at its original
 *  position, independently editable, rather than one flat screenshot. No
 *  title/kicker chrome (matches the 'blank' layout's own convention) since
 *  the imported content already carries its own. */
function FreeformSlide({ slide, editable }: SlideRendererProps) {
  const updateField = useEditorStore((s) => s.updateField);
  const elements = slide.fields.elements ?? [];
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const containerRef = useRef<HTMLDivElement>(null);
  // Alignment guide lines for whichever element is currently being dragged —
  // shared across every wrapper since only one drags at a time; drawn here
  // rather than per-wrapper because a guide spans the whole slide, not just
  // the dragged element's own box.
  const [guides, setGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  function setElement(id: string, patch: Partial<FreeformElement>) {
    updateField(
      'elements',
      elementsRef.current.map((el) => (el.id === id ? ({ ...el, ...patch } as FreeformElement) : el)),
    );
  }

  return (
    <div ref={containerRef} className="absolute inset-0 overflow-hidden bg-white">
      {elements.map((el) => (
        <FreeformElementWrapper
          key={el.id}
          el={el}
          editable={editable}
          containerRef={containerRef}
          siblings={elements.filter((s) => s.id !== el.id)}
          onMoveEnd={(pos) => setElement(el.id, pos)}
          onGuideChange={setGuides}
        >
          {el.type === 'image' ? (
            <MediaBox
              url={el.url}
              kind="image"
              editable={editable}
              onChangeUrl={(url) => setElement(el.id, { url })}
              transform={el.transform}
              onChangeTransform={(t) => setElement(el.id, { transform: t })}
              style={{ width: '100%', height: '100%' }}
              square
            />
          ) : el.type === 'text' ? (
            <FreeformTextBox el={el} editable={editable} onChange={(patch) => setElement(el.id, patch)} />
          ) : (
            <div className="h-full w-full" style={{ backgroundColor: el.color }} />
          )}
        </FreeformElementWrapper>
      ))}
      {guides.x != null && (
        <div className="pointer-events-none absolute inset-y-0 w-px bg-[#0b72c2]" style={{ left: `${guides.x * 100}%` }} />
      )}
      {guides.y != null && (
        <div className="pointer-events-none absolute inset-x-0 h-px bg-[#0b72c2]" style={{ top: `${guides.y * 100}%` }} />
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

/** How long a Layout-view stage transition's crossfade/shape-morph/overlay
 *  -fade runs, all three driven off one shared clock so they land in sync —
 *  the same reasoning the Sidvin reference gives for its own single rAF
 *  clock (avoiding drift between its image crossfade and its shape morph). */
const MORPH_DURATION_MS = 1200;

/** The drawing-tool picker's own labels/hints — exported so the Properties
 *  panel (which now renders these buttons; see `linkedViewToolbar` in
 *  editorStore.ts) doesn't duplicate them. */
export const LINKED_VIEW_DRAW_TOOLS: { key: DrawTool; label: string; hint: string }[] = [
  { key: 'rect', label: '▭ Rectangle', hint: 'Drag a box over the area. Shift for a square.' },
  { key: 'ellipse', label: '◯ Ellipse', hint: 'Drag to size it. Shift for a circle.' },
  { key: 'polygon', label: '⬡ Polygon', hint: 'Click each corner. Shift locks to 45°. Click the first point, or Enter, to close.' },
  { key: 'spline', label: '∿ Spline', hint: 'Click each point. Shift locks to 45°. Click the first point, or Enter, to close — edges curve smoothly through your points.' },
  { key: 'freehand', label: '✎ Freehand', hint: 'Drag along the boundary — released as a smooth curve through your trace.' },
];

function shapeForTool(tool: DrawTool): ShapeKind {
  if (tool === 'ellipse') return 'ellipse';
  if (tool === 'spline' || tool === 'freehand') return 'spline';
  return 'polygon';
}

/** Rect and ellipse are two-corner drags. Freehand is also a drag, but a
 *  continuous trace rather than two corners — it needs its own handling
 *  everywhere this function's "exactly the start and end corner" assumption
 *  doesn't hold, so it's deliberately NOT included here. */
function isDragTool(tool: DrawTool | null): boolean {
  return tool === 'rect' || tool === 'ellipse';
}

/** Polygon and spline are both a series of clicks — same interaction,
 *  different final edge rendering (straight vs. curved through the points). */
function isClickTool(tool: DrawTool | null): boolean {
  return tool === 'polygon' || tool === 'spline';
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
  const setLinkedViewToolbar = useEditorStore((s) => s.setLinkedViewToolbar);
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
  /** Only meaningful once a hotspot has both a gallery and a target —
   *  otherwise there's nothing for jumpTo to choose between. */
  const [pendingClickAction, setPendingClickAction] = useState<'navigate' | 'gallery' | ''>('');
  const [pendingKeyPlanUrl, setPendingKeyPlanUrl] = useState('');
  const [pendingKeyPlanArrowDeg, setPendingKeyPlanArrowDeg] = useState('');
  /** Space Detail — everything about this space surfaced on click instead of
   *  navigating away. Collapsed by default; expands automatically once
   *  editing a hotspot that already has any of this filled in. */
  const [spaceDetailOpen, setSpaceDetailOpen] = useState(false);
  const [pendingConceptTitle, setPendingConceptTitle] = useState('');
  const [pendingConceptBody, setPendingConceptBody] = useState('');
  const [pendingConceptImage, setPendingConceptImage] = useState('');
  const [pendingWalkthroughUrl, setPendingWalkthroughUrl] = useState('');
  const [pendingBoqNote, setPendingBoqNote] = useState('');
  const [pendingSpaceNote, setPendingSpaceNote] = useState('');
  /** Set while editing an existing hotspot's label/list/style rather than
   *  drawing a new one — the popup is shared between both flows. */
  const [editingHotspotId, setEditingHotspotId] = useState<string | null>(null);
  /** One id, read by both the hotspot <path> and the side-list row it
   *  matches, so highlighting the two can never drift out of sync. */
  const [hoveredHotspotId, setHoveredHotspotId] = useState<string | null>(null);
  /** The hotspot whose gallery is open in the lightbox (view mode only). */
  const [lightboxHotspotId, setLightboxHotspotId] = useState<string | null>(null);
  /** The hotspot whose space-detail overlay is open (view mode only) — takes
   *  over the click ahead of plain navigate/gallery once a hotspot has any
   *  spaceDetail content or a linked seating row (see jumpTo/hasSpaceDetail). */
  const [spaceDetailHotspotId, setSpaceDetailHotspotId] = useState<string | null>(null);
  /** Which gallery index to jump straight to if a render thumbnail inside the
   *  space-detail overlay is clicked, opening the full Lightbox on top of it. */
  const [spaceDetailGalleryIndex, setSpaceDetailGalleryIndex] = useState<number | null>(null);
  /** Which named stage is active — undefined means "no stages defined" or
   *  "first one," both of which fall back to the view's own url/transform. */
  const [activeStageId, setActiveStageId] = useState<string | undefined>(undefined);
  /** A snapshot of the stage just switched *away* from, kept only for the
   *  duration of a Layout-view stage transition — `activeStageId` above has
   *  already moved on to the destination stage the instant a transition
   *  starts (so every other derived value in this component is already
   *  "the new stage"), and rendering blends this outgoing snapshot against
   *  that current data using `transitionProgress`. `null` outside a
   *  transition, or for any view kind other than 'layout'. */
  const [transitionFrom, setTransitionFrom] = useState<{
    url: string | undefined;
    transform: ImageTransform | undefined;
    isPdfPlan: boolean | undefined;
    overlay: 'zoning' | 'circulation' | null;
    hotspots: { id: string; points: Point[]; shape: ViewHotspot['shape']; parentHotspotId: string | undefined }[];
  } | null>(null);
  const [transitionProgress, setTransitionProgress] = useState(1);
  const transitionRafRef = useRef<number | null>(null);
  /** Whether the Zoning/Circulation auto-overlay that matches the active
   *  stage's own label (see `activeOverlay` below) is suppressed for a
   *  moment — a presenter's "show me the bare plan" escape hatch, since
   *  reaching a stage named e.g. "Circulation" now paints its overlay
   *  automatically with no separate mode to opt out of otherwise. Transient
   *  like the active stage; resets on every view/stage change below. */
  const [overlayHidden, setOverlayHidden] = useState(false);
  /** Whether the Dimensions toggle (badge row, next to North) is on for the
   *  active stage — shows every space's calibrated area and puts the plan
   *  into click-two-points-to-measure. Transient, resets below; distinct
   *  from `pickMode === 'calibrate'`, which is a deliberate editor-only
   *  action independent of whether this viewer toggle is on. */
  const [dimensionsOn, setDimensionsOn] = useState(false);
  /** Set while redrawing one existing hotspot's shape specifically for the
   *  active stage (see the hotspot popup's "Shape on this stage" section) —
   *  `finishShape` branches on this to commit into `pointsByStage` instead
   *  of opening the normal create-a-new-hotspot target picker. */
  const [redrawShapeFor, setRedrawShapeFor] = useState<{ hotspotId: string; stageId: string } | null>(null);
  /** A two-point pick in progress on the plan: either establishing the scale
   *  ('calibrate') or just measuring between two points ('measure'). Both
   *  collect points the same way, so they share one bit of state. */
  const [pickMode, setPickMode] = useState<null | 'calibrate' | 'measure'>(null);
  const [pickPoints, setPickPoints] = useState<Point[]>([]);
  /** Where the next click would actually land, once snapped to the plan's own
   *  geometry — shown live so the user can see what they are about to pick. */
  const [snapHit, setSnapHit] = useState<SnapResult | null>(null);
  const [pendingCalDistance, setPendingCalDistance] = useState('');
  const [pendingCalUnit, setPendingCalUnit] = useState('m');
  /** Which stages the hotspot being drawn/edited is active on. Empty = every
   *  stage (matches `stageIds` being unset on save). */
  const [pendingStageIds, setPendingStageIds] = useState<string[]>([]);
  /** Zoning/adjacency for the hotspot being drawn or edited — see the
   *  matching fields on ViewHotspot. */
  const [pendingZoneCategory, setPendingZoneCategory] = useState('');
  const [pendingAdjacentIds, setPendingAdjacentIds] = useState<string[]>([]);
  /** This hotspot's one real parent zone hotspot — see ViewHotspot.parentHotspotId. */
  const [pendingParentId, setPendingParentId] = useState('');
  /** Rows in the seating table (if any) whose hotspot(s) should highlight
   *  right now — fed by hovering a SeatingTable row; consumed by the hotspot
   *  <path> rendering below alongside the simple side-list's own
   *  hoveredHotspotId. Kept separate since a row can map to several ids at
   *  once (see SeatingRow.hotspotIds), unlike the single-hotspot side list. */
  const [hoveredRowHotspotIds, setHoveredRowHotspotIds] = useState<string[]>([]);
  /** Transient viewer-only zoom/pan — never written to `ImageTransform` or the
   *  project, just a magnifier over the authored crop. Reset whenever the
   *  shown view/stage changes so it never looks "stuck" on a new image. */
  const [viewportZoom, setViewportZoom] = useState(1);
  const [viewportPanX, setViewportPanX] = useState(0);
  const [viewportPanY, setViewportPanY] = useState(0);
  const panRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; moved: boolean } | null>(null);
  const stageBoxRef = useRef<HTMLDivElement>(null);
  const zoomPanActiveRef = useRef(false);
  // The hotspot popup below clamps its own position against the stage's
  // current size — tracked here via ResizeObserver (an effect, not a
  // render-time ref read) rather than reaching into stageBoxRef.current
  // directly while rendering, which is exactly the "ref access during
  // render" pattern this file's own lint rule already flags elsewhere.
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const el = stageBoxRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setStageSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  /** The plan box's own size, computed in JS rather than left to CSS.
   *
   *  `aspect-video h-full` alone (the previous approach) pins height to the
   *  row's own height and derives width from *that* — deliberately, per the
   *  comment where it's used below: pairing `flex-1` (so width could grow
   *  into space freed by the aside panel collapsing/closing) with an
   *  aspect-ratio box leaves nothing "auto" for the aspect ratio to derive,
   *  so browsers just ignore the ratio outright — confirmed live before
   *  writing this, not assumed. That trade-off shipped the Presenter
   *  no-overflow fix, but as a side effect made the plan's width
   *  permanently blind to how much room the aside actually claims — so
   *  collapsing or closing the Seating Capacity panel just left empty
   *  gutter next to the plan instead of the plan actually growing into it.
   *
   *  Computing the fit ourselves — largest 16:9 box that satisfies BOTH the
   *  row's available width (row width minus whatever the aside currently
   *  claims) AND its available height — gets both properties genuinely:
   *  never taller than the row (still Presenter-safe) and, whenever the
   *  aside frees up width, the plan actually uses it. `rowRef`/`asideRef`
   *  measure via `offsetWidth/Height` (layout size), not
   *  `getBoundingClientRect()` — the editor's `ScaledStage` visually scales
   *  the whole canvas down for display, so `getBoundingClientRect()` would
   *  read post-scale pixels while the size we're computing here has to be
   *  set as a style *inside* that same scaled subtree; confirmed live that
   *  using the wrong one silently double-scales the result. */
  const rowRef = useRef<HTMLDivElement>(null);
  const asideRef = useRef<HTMLDivElement>(null);
  const [fitSize, setFitSize] = useState<{ width: number; height: number } | null>(null);
  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    function recompute() {
      const rowEl = rowRef.current;
      if (!rowEl) return;
      const rowW = rowEl.offsetWidth;
      const rowH = rowEl.offsetHeight;
      const asideW = asideRef.current?.offsetWidth ?? 0;
      const GAP = 16; // matches the row's own gap-4
      const availW = Math.max(0, rowW - (asideW > 0 ? asideW + GAP : 0));
      if (availW <= 0 || rowH <= 0) return;
      const ratio = 16 / 9;
      setFitSize(
        availW / rowH > ratio ? { width: rowH * ratio, height: rowH } : { width: availW, height: availW / ratio },
      );
    }
    const observer = new ResizeObserver(recompute);
    observer.observe(row);
    if (asideRef.current) observer.observe(asideRef.current);
    recompute();
    return () => observer.disconnect();
  }, []);
  /** Manual override for the hotspot popup's computed position — a pixel
   *  offset added on top of whatever `popupPosition()` would otherwise
   *  place it at, so dragging works regardless of which side of the shape
   *  the popup auto-anchored to. Reset (below the early return, where
   *  `editingHotspotId`/`pickingTarget` are in scope together) whenever a
   *  *different* popup opens — a drag is a one-popup-instance override, not
   *  a persisted preference. That reset compares against `prevPopupKeyRef`
   *  and calls `setPopupDrag` conditionally during render rather than from
   *  a useEffect — React's own documented pattern for "reset state when a
   *  key changes", which skips the extra render-then-effect round trip an
   *  effect would need and (unlike one) doesn't trip this file's existing
   *  react-hooks/set-state-in-effect warnings. */
  const [popupDrag, setPopupDrag] = useState<{ x: number; y: number } | null>(null);
  const popupDragRef = useRef<{ startX: number; startY: number; startOffset: { x: number; y: number } } | null>(null);
  const prevPopupKeyRef = useRef<string | null>(null);
  /** Live, uncommitted angle while the north-point handle is being dragged —
   *  `null` when not dragging. Read by both the toolbar icon and the
   *  on-stage badge so they rotate together in real time; committed once, on
   *  release, via `setStage` (see the drag handlers near it, below the early
   *  return). Declared up here, with the rest of this component's hooks,
   *  same reasoning as `panRef`/`viewportZoom` above — so the hook order
   *  can't change across the early return just below. */
  const [dragNorthDeg, setDragNorthDeg] = useState<number | null>(null);
  const northDragRef = useRef<{ cx: number; cy: number; startAngle: number; startDeg: number } | null>(null);
  /** Background-music playback for the active view (Render/Axo, typically) —
   *  mute is a viewer preference kept across view switches; whether the
   *  browser actually blocked autoplay is per-attempt, so it resets. */
  const [musicMuted, setMusicMuted] = useState(false);
  const [musicBlocked, setMusicBlocked] = useState(false);
  const musicAudioRef = useRef<HTMLAudioElement>(null);
  /** Key-plan card — visible by default whenever a view sets one, collapsed
   *  back to its small size on every view switch (never carries the
   *  expanded state over from the last view shown, matching the reference). */
  const [keyPlanVisible, setKeyPlanVisible] = useState(true);
  const [keyPlanExpanded, setKeyPlanExpanded] = useState(false);
  /** True for the one click that immediately follows a pan drag that actually
   *  moved — read and cleared by the hotspot's own onClick, since pointerup
   *  fires (and clears panRef) before the browser's click event does. */
  const justPannedRef = useRef(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  /** A `targetTime` seek that arrived before its walkthrough view's <video>
   *  had actually mounted — applied by the effect below once it has,
   *  instead of hoping a single requestAnimationFrame was enough. */
  const pendingSeekRef = useRef<number | null>(null);

  useEffect(() => {
    const time = pendingSeekRef.current;
    if (time == null) return;
    const video = videoRef.current;
    // Nothing mounted for this view (it isn't a walkthrough, or the target
    // view has no video yet) — there's nothing to seek, drop the request
    // rather than leaving it to fire against some later, unrelated video.
    if (!video) {
      pendingSeekRef.current = null;
      return;
    }
    const apply = () => {
      video.currentTime = time;
      pendingSeekRef.current = null;
    };
    if (video.readyState >= 1) {
      apply();
      return;
    }
    video.addEventListener('loadedmetadata', apply, { once: true });
    return () => video.removeEventListener('loadedmetadata', apply);
  }, [activeId]);
  const active = views.find((v) => v.id === activeId) ?? views[0];
  const activeStage = active?.stages?.find((s) => s.id === activeStageId) ?? active?.stages?.[0];
  // Derived up here, before the early return below, so the hook order can't
  // change. Rebuilding the grid is only worth doing when the plan changes.
  const planGeometry = activeStage?.url ? activeStage.geometry : active?.geometry;
  const snapIndex = useMemo(() => buildSnapIndex(planGeometry, FRAME_ASPECT), [planGeometry]);

  function setView(id: string, patch: Partial<LinkedView>) {
    // Read the freshest views from the store rather than this render's
    // closure. MediaBox commits a url and then a transform back-to-back in
    // one tick (see accept()), and for a linked view *both* land inside this
    // same `views` array — so computing the second patch from a stale
    // snapshot silently threw the first one away, which is why dropping an
    // image here reported "Added — 113KB" and then showed an empty slot.
    // Ordinary slides never hit this: their url and transform are separate
    // fields, so two writes can't clobber each other.
    const live = useEditorStore.getState().project?.slides.find((s) => s.id === slide.id)?.fields.views ?? views;
    updateField('views', live.map((v) => (v.id === id ? { ...v, ...patch } : v)));
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
    // A different plan is a different reading: an overlay (or a half-finished
    // measurement) from the last one would be describing the wrong image.
    setOverlayHidden(false);
    setDimensionsOn(false);
    setPickMode(null);
    setPickPoints([]);
    setSnapHit(null);
    setRedrawShapeFor(null);
    // Fresh key-plan state per view/stage — never carries an expanded card
    // over from whichever plan was showing before, matching the reference
    // deck. Scoped to activeStageId too (not just activeId): a stage swaps
    // the actual image on screen just as much as a view does.
    setKeyPlanVisible(true);
    setKeyPlanExpanded(false);
    // A hover highlight describing a space on the *last* plan is just wrong
    // once the image underneath it has changed — nothing else here is
    // spared this reset, hover shouldn't be either.
    setHoveredHotspotId(null);
    setHoveredRowHotspotIds([]);
    // Closing these by hand (rather than letting the next render's
    // `hotspots.find(...)` quietly return undefined) keeps their own
    // onClose cleanup — clearing spaceDetailGalleryIndex alongside
    // lightboxHotspotId — from being skipped.
    setLightboxHotspotId(null);
    setSpaceDetailHotspotId(null);
    setSpaceDetailGalleryIndex(null);
  }, [activeId, activeStageId]);

  // Separate from the reset above and keyed on activeId alone (not
  // activeStageId): a stage transition's own progress is what that effect
  // must NOT stomp on the very render it starts (selectStage sets
  // transitionFrom/transitionProgress and activeStageId together, in one
  // batch). Switching to a completely different view, though, should always
  // cut a mid-flight transition short rather than let it keep blending
  // against a plan that's no longer on screen.
  useEffect(() => {
    return () => {
      if (transitionRafRef.current != null) cancelAnimationFrame(transitionRafRef.current);
      transitionRafRef.current = null;
      setTransitionFrom(null);
      setTransitionProgress(1);
    };
  }, [activeId]);

  // Background music for the active view: fades in on arrival, stops on
  // leaving (or when this view has none). A play() promise can reject if
  // the browser blocks autoplay-with-sound before any user gesture on the
  // page — surfaced as `musicBlocked` so the UI can offer a tap-to-enable
  // control instead of silently doing nothing.
  useEffect(() => {
    const audio = musicAudioRef.current;
    if (!audio || !active.musicUrl) return;
    audio.loop = true;
    audio.muted = musicMuted;
    audio.volume = 0;
    setMusicBlocked(false);
    let cancelled = false;
    audio
      .play()
      .then(() => {
        let v = 0;
        const fadeIn = () => {
          if (cancelled) return;
          v = Math.min(0.35, v + 0.05);
          audio.volume = v;
          if (v < 0.35) requestAnimationFrame(fadeIn);
        };
        fadeIn();
      })
      .catch(() => setMusicBlocked(true));
    return () => {
      cancelled = true;
      audio.pause();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, active.musicUrl]);

  const stageUrl = activeStage?.url ?? active.url;
  const stageTransform = activeStage?.url ? activeStage.transform : active.transform;
  // Scale belongs to whichever image is actually on screen — a stage that
  // brought its own plan carries its own scale; otherwise it's the view's.
  const calibration = activeStage?.url ? activeStage.calibration : active.calibration;
  const isPdfPlan = activeStage?.url ? activeStage.isPdfPlan : active.isPdfPlan;
  const northDeg = activeStage?.url ? activeStage.northDeg : active.northDeg;
  const displayNorthDeg = dragNorthDeg ?? northDeg ?? 0;
  const northLocked = activeStage?.url ? activeStage.northLocked : active.northLocked;
  const calibrationLocked = activeStage?.url ? activeStage.calibrationLocked : active.calibrationLocked;

  /** Writes any of the image-scoped fields to whichever of the stage or the
   *  view actually owns the picture on screen.
   *
   *  A stage only owns the image once it has its own `url`; until then it is
   *  showing the view's. Setting a url is therefore what makes a stage
   *  image-owning, which is why that case targets the stage even though the
   *  check above would still say the view. */
  function setStage(patch: Partial<Pick<LinkedView, 'url' | 'transform' | 'calibration' | 'geometry' | 'isPdfPlan' | 'northDeg' | 'northLocked' | 'calibrationLocked'>>) {
    const targetsStage = !!activeStage && (!!activeStage.url || patch.url !== undefined);
    if (targetsStage) {
      setView(active.id, { stages: active.stages!.map((s) => (s.id === activeStage!.id ? { ...s, ...patch } : s)) });
    } else {
      setView(active.id, patch);
    }
  }

  /** North-point rotate handle. Mirrors the drag-tools' own pointer-capture
   *  pattern just below this (plain functions, `setPointerCapture`) rather
   *  than ImageAdjustOverlay's window-listener approach — capture already
   *  keeps delivering moves once the pointer leaves the icon's small hit
   *  area, so there's no stale-closure/listener-teardown risk to guard
   *  against here.
   *
   *  Commits once, on release, not on every move: `setStage` isn't memoized
   *  and `commitProject` pushes an undo-stack entry on every call with no
   *  de-duping for array fields, so a live per-move commit would flood undo
   *  history (and, past MAX_HISTORY, evict unrelated earlier edits) for
   *  what should read as one undo-able action. `dragNorthDeg` carries the
   *  live angle during the drag so the toolbar icon and on-stage badge can
   *  still rotate smoothly in real time without committing anything yet. */
  function normalizeDeg(deg: number) {
    return ((deg % 360) + 360) % 360;
  }

  function startNorthDrag(e: React.PointerEvent<HTMLButtonElement>) {
    if (northLocked) return;
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // No active pointer to capture; pointermove on the button still works.
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    northDragRef.current = { cx, cy, startAngle: Math.atan2(e.clientY - cy, e.clientX - cx), startDeg: displayNorthDeg };
    setDragNorthDeg(displayNorthDeg);
  }

  function moveNorthDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = northDragRef.current;
    if (!drag) return;
    const nowAngle = Math.atan2(e.clientY - drag.cy, e.clientX - drag.cx);
    const deltaDeg = ((nowAngle - drag.startAngle) * 180) / Math.PI;
    setDragNorthDeg(normalizeDeg(drag.startDeg + deltaDeg));
  }

  function endNorthDrag(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = northDragRef.current;
    if (!drag) return;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone; nothing to release.
    }
    const finalDeg = dragNorthDeg ?? displayNorthDeg;
    northDragRef.current = null;
    // Auto-lock only on a real drag, not a plain click: startNorthDrag arms
    // this ref unconditionally on pointerdown, before any movement happens,
    // so a mere curious tap on the handle would otherwise lock North at its
    // untouched default before anyone ever rotated it. Shortest angular
    // distance, not a raw subtraction, so e.g. 359° -> 1° (a 2° nudge across
    // the wrap point) doesn't read as "moved 358°".
    const rawDiff = normalizeDeg(finalDeg - drag.startDeg);
    const moved = Math.min(rawDiff, 360 - rawDiff) > 0.5;
    setStage({ northDeg: finalDeg, ...(moved ? { northLocked: true } : {}) });
    setDragNorthDeg(null);
  }

  function unlockNorth() {
    setStage({ northLocked: false });
  }

  function unlockCalibration() {
    setStage({ calibrationLocked: false });
  }

  // Registers the canvas toolbar's live values/handlers into the store so
  // PropertiesPanel — a sibling subtree, not a descendant of this component
  // — can render the actual buttons (Zoom/pan, North, Calibrate, drawing
  // tools) and still call back into these exact same handlers. Every
  // handler referenced here is unchanged from when this toolbar rendered
  // inline on the canvas; only where the buttons are drawn moved. Cleared
  // (not just re-set) whenever the toolbar shouldn't be showable at all —
  // matching the `editable && stageUrl && active.kind !== 'walkthrough'`
  // gate the removed on-canvas JSX used to check.
  //
  // Gated on `editable` FIRST, before anything else: the slide rail renders
  // its own non-editable `LinkedViewsExplorer` instance for every Linked
  // Views slide's thumbnail (the same rail/canvas DOM-duplication this
  // component's other effects already have to account for — see the
  // `isInRailPreview()`-style guards elsewhere in this file). Every one of
  // those non-editable instances runs this same effect; without this early
  // return each of them would call `setLinkedViewToolbar(null)` right after
  // the real editable instance registers its own snapshot, since this is
  // one shared store slot and effects across sibling instances aren't
  // ordered against each other. Only the single editable instance — there
  // is ever at most one — may write to this slot at all.
  useEffect(() => {
    if (!editable) return;
    if (!stageUrl || active.kind === 'walkthrough') {
      setLinkedViewToolbar(null);
      return;
    }
    setLinkedViewToolbar({
      zoomPanEnabled: !!active.zoomPanEnabled,
      onToggleZoomPan: (v) => setView(active.id, { zoomPanEnabled: v }),
      displayNorthDeg,
      northLocked: !!northLocked,
      onNorthPointerDown: startNorthDrag,
      onNorthPointerMove: moveNorthDrag,
      onNorthPointerUp: endNorthDrag,
      onUnlockNorth: unlockNorth,
      hasCalibration: !!calibration,
      calibrationLocked: !!calibrationLocked,
      pickMode,
      onCalibrate: () => {
        if (calibrationLocked) return;
        setPickMode('calibrate');
        setPickPoints([]);
        setPendingCalDistance('');
      },
      onUnlockCalibration: unlockCalibration,
      tool,
      onSetTool: (t) => {
        setDrawingPoints(null);
        setPickingTarget(false);
        setTool((prev) => (prev === t ? null : t));
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editable, stageUrl, active.kind, active.id, active.zoomPanEnabled, displayNorthDeg, northLocked, calibration, calibrationLocked, pickMode, tool]);

  // Unmount only, and only for the editable instance (see above) — clears
  // the registration so a different slide's Properties panel never shows a
  // stale toolbar from a slide no longer being edited.
  useEffect(() => {
    if (!editable) return undefined;
    return () => setLinkedViewToolbar(null);
  }, [editable, setLinkedViewToolbar]);

  if (!active) return null;

  const otherViews = views.filter((v) => v.id !== active.id);
  const allHotspots = active.hotspots ?? [];
  // Unset stageIds = active on every stage — matters both for hotspots drawn
  // before stages existed and for a view that never defines any.
  const hotspots = activeStage ? allHotspots.filter((h) => !h.stageIds || h.stageIds.includes(activeStage.id)) : allHotspots;

  /** Where a pointer at these client coordinates should actually place a point.
   *
   *  The snap radius is a **screen** distance converted into frame units, so it
   *  shrinks as the viewer zooms in — snapping must get finer with magnification,
   *  not coarser, since zooming in is exactly when precision is being asked for. */
  function resolvePick(rect: DOMRect, clientX: number, clientY: number): { point: Point; snap: SnapResult | null } {
    const raw = clamp01({ x: (clientX - rect.left) / rect.width, y: (clientY - rect.top) / rect.height });
    const radius = (SNAP_SCREEN_PX / rect.width) / Math.max(1, viewportZoom);
    const snap = snapTo(snapIndex, raw, radius);
    return { point: snap ? snap.point : raw, snap };
  }

  function setCalibration(cal: PlanCalibration | undefined) {
    // Unlike North, there's no accidental-fire path to guard against here —
    // this only ever runs from "Set scale", already gated behind a
    // deliberate two-point pick, a typed distance, and a button press.
    setStage({ calibration: cal, calibrationLocked: !!cal });
  }

  const zoneCategories = [...new Set(hotspots.map((h) => h.zoneCategory?.trim()).filter((z): z is string => !!z))].sort();
  // Only one end of a pair has to name the other, and a space whose partner
  // isn't on this stage simply has no line to draw here.
  const adjacencyPairs: { a: ViewHotspot; b: ViewHotspot }[] = [];
  const seenPairs = new Set<string>();
  for (const h of hotspots) {
    for (const otherId of h.adjacentHotspotIds ?? []) {
      const other = hotspots.find((o) => o.id === otherId);
      if (!other || other.id === h.id) continue;
      const key = [h.id, other.id].sort().join('|');
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      adjacencyPairs.push({ a: h, b: other });
    }
  }
  // Which auto-overlay (if any) belongs on the active stage, matched by its
  // label — exact match after normalizing, same precision as zoneCategory's
  // own free-text convention, so a stage titled "Zoning Notes" doesn't
  // accidentally match. "Circulation" and "corridor" alias to the same
  // adjacency-lines behaviour, matching the ask's own "corridor/circulation"
  // phrasing for what is clearly one phase.
  const activeOverlayLabel = activeStage?.label.trim().toLowerCase();
  const activeOverlay: 'zoning' | 'circulation' | null =
    activeOverlayLabel === 'zoning' ? 'zoning' : activeOverlayLabel === 'circulation' || activeOverlayLabel === 'corridor' ? 'circulation' : null;
  /** A hotspot's shape, resolved for the active stage — falls back to the
   *  base `points` when this stage has no override, so nothing drawn before
   *  `pointsByStage` existed needs migrating. */
  function pointsFor(h: ViewHotspot): Point[] {
    return (activeStage && h.pointsByStage?.[activeStage.id]) ?? h.points;
  }
  // Unset means "show it exactly when something would appear in it" — computed
  // here, once, rather than re-derived wherever it's read.
  const showHotspotList = active.showHotspotList ?? hotspots.some((h) => h.listEntry);
  const editingHotspot = hotspots.find((h) => h.id === editingHotspotId) ?? null;
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
    isClickTool(tool) && !!drawingPoints && drawingPoints.length >= 3 && !!cursor && distance(cursor, drawingPoints[0]) < 0.02;

  function pointAt(e: React.PointerEvent<HTMLDivElement>): Point {
    const rect = e.currentTarget.getBoundingClientRect();
    const raw = clamp01({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height });
    // A freehand trace has no notion of "square" or "45°-locked" — it's a
    // continuous gesture, not a series of discrete points to constrain.
    if (!e.shiftKey || tool === 'freehand') return raw;

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
    // stageUrl, not active.url: a Layout view whose images live entirely on
    // its stages (the pattern the plan-evolution timeline actively
    // encourages — 4 suggested stages, no base-view image at all) still
    // needs to be drawable on. Pre-existing gap, newly consequential now
    // that stage-only images are the common case rather than an edge one.
    return drawing && editable && !!stageUrl && active.kind !== 'walkthrough' && !pickingTarget;
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

    if (isClickTool(tool)) {
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
    } else if (tool === 'freehand') {
      // Every sample, not just start/end — simplifyPath thins this down to
      // the few points the traced shape actually needs, on release.
      setDrawingPoints((prev) => (prev ? [...prev, point] : [point]));
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

    if (tool === 'freehand') {
      const simplified = simplifyPath(pts);
      // Too short a drag simplifies down to fewer points than a closed
      // region needs — discard it, same call as a too-small rect/ellipse.
      if (!hasEnoughPoints(simplified, 'spline')) {
        setDrawingPoints(null);
        return;
      }
      finishShape(simplified);
      return;
    }

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

  /** Hands a completed outline to the target picker — or, if this drag was
   *  started via "Shape on this stage" in the hotspot popup, commits it
   *  straight into that one hotspot's pointsByStage instead: only the shape
   *  changed, there's no new metadata to pick. */
  function finishShape(points: Point[]) {
    if (redrawShapeFor) {
      const { hotspotId, stageId } = redrawShapeFor;
      setView(active.id, {
        hotspots: allHotspots.map((h) => (h.id === hotspotId ? { ...h, pointsByStage: { ...h.pointsByStage, [stageId]: points } } : h)),
      });
      setRedrawShapeFor(null);
      resetShape();
      return;
    }
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
    setRedrawShapeFor(null);
  }

  function selectView(id: string) {
    setActiveId(id);
    cancelDrawing();
  }

  /** Switches the active stage — animated for Layout views (the plan-
   *  evolution timeline), instant for every other kind, matching how the
   *  plain pill row already worked and still works for Render/Axo/etc.
   *  `activeStageId` moves to the destination immediately either way, so
   *  every other derived value in this component (hotspots, stageUrl,
   *  activeOverlay...) is already "the new stage" the instant this
   *  returns — the animated case renders a blend against `transitionFrom`
   *  on top of that for `MORPH_DURATION_MS`, it doesn't delay the switch
   *  itself. */
  function selectStage(toStageId: string) {
    if (toStageId === activeStage?.id) return;
    cancelDrawing();
    if (active.kind !== 'layout' || !activeStage) {
      setActiveStageId(toStageId);
      return;
    }
    if (transitionRafRef.current != null) cancelAnimationFrame(transitionRafRef.current);
    setTransitionFrom({
      url: stageUrl,
      transform: stageTransform,
      isPdfPlan,
      overlay: activeOverlay,
      hotspots: hotspots.filter((h) => hasEnoughPoints(pointsFor(h), h.shape)).map((h) => ({ id: h.id, points: pointsFor(h), shape: h.shape, parentHotspotId: h.parentHotspotId })),
    });
    setTransitionProgress(0);
    setActiveStageId(toStageId);

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / MORPH_DURATION_MS);
      setTransitionProgress(t);
      if (t < 1) {
        transitionRafRef.current = requestAnimationFrame(step);
      } else {
        transitionRafRef.current = null;
        setTransitionFrom(null);
      }
    };
    transitionRafRef.current = requestAnimationFrame(step);
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
    setPendingClickAction(h?.clickAction ?? '');
    setPendingKeyPlanUrl(h?.keyPlanImage?.url ?? '');
    setPendingKeyPlanArrowDeg(h?.keyPlanImage?.arrowDeg != null ? String(h.keyPlanImage.arrowDeg) : '');
    setPendingStageIds(h?.stageIds ?? []);
    setPendingConceptTitle(h?.spaceDetail?.concept?.title ?? '');
    setPendingConceptBody(h?.spaceDetail?.concept?.body ?? '');
    setPendingConceptImage(h?.spaceDetail?.concept?.imageUrl ?? '');
    setPendingWalkthroughUrl(h?.spaceDetail?.walkthroughUrl ?? '');
    setPendingBoqNote(h?.spaceDetail?.boq?.note ?? '');
    setPendingSpaceNote(h?.spaceDetail?.note ?? '');
    setSpaceDetailOpen(!!h?.spaceDetail);
    setPendingZoneCategory(h?.zoneCategory ?? '');
    setPendingAdjacentIds(h?.adjacentHotspotIds ?? []);
    setPendingParentId(h?.parentHotspotId ?? '');
  }

  function buildSpaceDetail(): ViewHotspot['spaceDetail'] {
    const concept =
      pendingConceptTitle.trim() || pendingConceptBody.trim()
        ? { title: pendingConceptTitle.trim(), body: pendingConceptBody.trim(), imageUrl: pendingConceptImage.trim() || undefined }
        : undefined;
    const boq = pendingBoqNote.trim() ? { note: pendingBoqNote.trim() } : undefined;
    const walkthroughUrl = pendingWalkthroughUrl.trim() || undefined;
    const note = pendingSpaceNote.trim() || undefined;
    if (!concept && !boq && !walkthroughUrl && !note) return undefined;
    return { concept, boq, walkthroughUrl, note };
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

  function buildKeyPlanImage(): ViewHotspot['keyPlanImage'] {
    if (!pendingKeyPlanUrl.trim()) return undefined;
    return {
      url: pendingKeyPlanUrl.trim(),
      arrowDeg: pendingKeyPlanArrowDeg.trim() ? Number(pendingKeyPlanArrowDeg) : undefined,
    };
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
      keyPlanImage: buildKeyPlanImage(),
      clickAction: pendingClickAction || undefined,
      stageIds: pendingStageIds.length ? pendingStageIds : undefined,
      spaceDetail: buildSpaceDetail(),
      zoneCategory: pendingZoneCategory.trim() || undefined,
      adjacentHotspotIds: pendingAdjacentIds.length ? pendingAdjacentIds : undefined,
      parentHotspotId: pendingParentId || undefined,
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
              keyPlanImage: buildKeyPlanImage(),
              clickAction: pendingClickAction || undefined,
              stageIds: pendingStageIds.length ? pendingStageIds : undefined,
              spaceDetail: buildSpaceDetail(),
              zoneCategory: pendingZoneCategory.trim() || undefined,
              adjacentHotspotIds: pendingAdjacentIds.length ? pendingAdjacentIds : undefined,
              parentHotspotId: pendingParentId || undefined,
            }
          : h,
      ),
    });
    setEditingHotspotId(null);
  }

  function removeHotspot(id: string) {
    setView(active.id, {
      // Also drop the deleted space from anyone's adjacency list, so a
      // rebuilt plan doesn't accumulate links pointing at nothing.
      hotspots: allHotspots
        .filter((h) => h.id !== id)
        .map((h) => {
          const adjacentHotspotIds = h.adjacentHotspotIds?.includes(id)
            ? h.adjacentHotspotIds.filter((x) => x !== id) : h.adjacentHotspotIds;
          // Same reasoning: a child left pointing at a deleted parent would
          // just silently never burst/merge again rather than erroring, so
          // clear it the same way adjacency is cleared above.
          const parentHotspotId = h.parentHotspotId === id ? undefined : h.parentHotspotId;
          if (adjacentHotspotIds === h.adjacentHotspotIds && parentHotspotId === h.parentHotspotId) return h;
          return { ...h, adjacentHotspotIds: adjacentHotspotIds?.length ? adjacentHotspotIds : undefined, parentHotspotId };
        }),
      // Same reasoning as the adjacency cleanup above, for the seating
      // table's own hotspot links — otherwise a deleted space leaves a
      // dangling id in a row's hotspotIds that will just never highlight
      // anything again, silently.
      seatingZones: active.seatingZones?.map((z) => ({
        ...z,
        rows: z.rows.map((r) => (r.hotspotIds?.includes(id) ? { ...r, hotspotIds: r.hotspotIds.filter((x) => x !== id) } : r)),
      })),
    });
    setEditingHotspotId((cur) => (cur === id ? null : cur));
  }

  /** Arms drawing a fresh shape for one existing hotspot, scoped to the
   *  active stage only — closes the edit popup (metadata isn't changing,
   *  only the shape) and defaults the tool to match the hotspot's own
   *  shape kind. `finishShape` commits the result into `pointsByStage`
   *  instead of opening the normal create-a-new-hotspot flow. */
  function startRedrawShape(h: ViewHotspot) {
    if (!activeStage) return;
    setDrawingPoints(null);
    setPickingTarget(false);
    setCursor(null);
    setDragging(false);
    setOrtho(false);
    setEditingHotspotId(null);
    setTool(h.shape === 'ellipse' ? 'ellipse' : h.shape === 'spline' ? 'spline' : 'polygon');
    setRedrawShapeFor({ hotspotId: h.id, stageId: activeStage.id });
  }

  /** Drops this stage's shape override, back to the hotspot's base `points`. */
  function clearShapeOverride(h: ViewHotspot) {
    if (!activeStage || !h.pointsByStage) return;
    const stageId = activeStage.id;
    setView(active.id, {
      hotspots: allHotspots.map((x) => {
        if (x.id !== h.id || !x.pointsByStage) return x;
        const rest = Object.fromEntries(Object.entries(x.pointsByStage).filter(([id]) => id !== stageId));
        return { ...x, pointsByStage: Object.keys(rest).length ? rest : undefined };
      }),
    });
  }

  /** The seating-table row (if any) linked to this hotspot, wherever it
   *  lives among the active view's seatingZones. */
  function occupancyFor(hotspotId: string) {
    for (const zone of active.seatingZones ?? []) {
      const row = zone.rows.find((r) => r.hotspotIds?.includes(hotspotId));
      if (row) return row;
    }
    return undefined;
  }

  function jumpTo(hotspot: ViewHotspot) {
    const detail = hotspot.spaceDetail;
    const hasRichDetail = !!(detail?.concept || detail?.walkthroughUrl || detail?.boq || detail?.note);
    // Always wins, regardless of clickAction — per ViewHotspot.clickAction's
    // own doc comment, staying on the plan takes priority over any override.
    if (hasRichDetail || occupancyFor(hotspot.id)) {
      setSpaceDetailHotspotId(hotspot.id);
      return;
    }

    const openGallery = () => setLightboxHotspotId(hotspot.id);
    const navigate = () => {
      if (hotspot.targetSlideId) {
        selectSlide(hotspot.targetSlideId);
        return;
      }
      if (!hotspot.targetViewId) return;
      const changingView = hotspot.targetViewId !== activeId;
      setActiveId(hotspot.targetViewId);
      if (hotspot.targetTime == null) return;
      if (!changingView && videoRef.current) {
        // Already on this view — its video is already mounted, no render to
        // wait for.
        videoRef.current.currentTime = hotspot.targetTime;
      } else {
        // Video for the view being switched to isn't mounted yet; the effect
        // above applies this once it is.
        pendingSeekRef.current = hotspot.targetTime;
      }
    };

    // clickAction only means something when there's a real choice to make —
    // 'gallery' with no gallery, or 'navigate' with no target, falls through
    // to the same default priority as if it were unset.
    if (hotspot.clickAction === 'gallery' && hotspot.gallery?.length) {
      openGallery();
      return;
    }
    if (hotspot.clickAction === 'navigate' && (hotspot.targetSlideId || hotspot.targetViewId)) {
      navigate();
      return;
    }
    if (hotspot.gallery?.length) {
      openGallery();
      return;
    }
    navigate();
  }

  const centroid: Point | null = drawingPoints ? centroidOf(drawingPoints) : null;
  const editingCentroid: Point | null = editingHotspot ? centroidOf(pointsFor(editingHotspot)) : null;
  const bounds = drawingPoints ? boundingBoxOf(drawingPoints) : null;
  const editingBounds = editingHotspot ? boundingBoxOf(pointsFor(editingHotspot)) : null;
  const showPopup = pickingTarget || !!editingHotspotId;
  const popupCentroid = editingHotspotId ? editingCentroid : centroid;
  const popupBounds = editingHotspotId ? editingBounds : bounds;
  const dark = slide.style === 'section-starter' || slide.style === 'design';

  const popupKey = editingHotspotId ?? (pickingTarget ? 'drawing' : null);
  if (popupKey !== prevPopupKeyRef.current) {
    prevPopupKeyRef.current = popupKey;
    if (popupDrag !== null) setPopupDrag(null);
  }

  /** The hotspot popup used to be pinned to the shape's own centroid with no
   *  bounds-checking and no height cap — grown over many sessions (label,
   *  target, fill/stroke, zone, adjacency, gallery, space detail…), it could
   *  run off the stage's bottom or side edge and, since the stage itself is
   *  `overflow-hidden`, get silently clipped rather than just spilling onto
   *  the page, and it sat directly on top of the shape it was editing,
   *  hiding it. Now anchors *beside* the shape's bounding box (right of it
   *  by default, left if there isn't room) instead of centered on it, still
   *  clamped so the whole popup stays inside the stage, still capped in
   *  height with its own scrollbar — and a manual drag (see the title row's
   *  handlers below) can override this computed spot, itself still clamped
   *  to the stage for the same reason. Uses `stageSize` (kept fresh by the
   *  ResizeObserver above), not a direct `stageBoxRef.current` read here
   *  during render. */
  function popupPosition(): { left: string; top: string; maxHeight?: string } {
    if (!popupCentroid) return { left: '0', top: '0' };
    if (!stageSize) return { left: `${popupCentroid.x * 100}%`, top: `${popupCentroid.y * 100}%` };
    const POPUP_WIDTH = 240; // matches the popup's own w-60
    const GAP = 16; // clearance from the shape's own edge
    const MARGIN = 8;
    const maxHeight = stageSize.height * 0.85;
    const halfW = Math.min(POPUP_WIDTH / 2, stageSize.width / 2);
    const halfH = Math.min(maxHeight / 2, stageSize.height / 2);

    let centerX: number;
    let centerY: number;
    if (popupBounds) {
      const boxMinX = popupBounds.minX * stageSize.width;
      const boxMaxX = popupBounds.maxX * stageSize.width;
      const boxMinY = popupBounds.minY * stageSize.height;
      const boxMaxY = popupBounds.maxY * stageSize.height;
      const roomRight = stageSize.width - boxMaxX;
      const fitsRight = roomRight >= GAP + halfW + MARGIN;
      centerX = fitsRight ? boxMaxX + GAP + halfW : boxMinX - GAP - halfW;
      centerY = (boxMinY + boxMaxY) / 2;
    } else {
      centerX = popupCentroid.x * stageSize.width;
      centerY = popupCentroid.y * stageSize.height;
    }

    let left = Math.min(Math.max(centerX, MARGIN + halfW), stageSize.width - MARGIN - halfW);
    let top = Math.min(Math.max(centerY, MARGIN + halfH), stageSize.height - MARGIN - halfH);

    if (popupDrag) {
      left = Math.min(Math.max(left + popupDrag.x, MARGIN + halfW), stageSize.width - MARGIN - halfW);
      top = Math.min(Math.max(top + popupDrag.y, MARGIN + halfH), stageSize.height - MARGIN - halfH);
    }

    return { left: `${left}px`, top: `${top}px`, maxHeight: `${maxHeight}px` };
  }

  /** Drag handlers for the popup's own title row — pointer-capture pattern
   *  matching the north-point handle and freeform-element drags elsewhere
   *  in this file. Every handler stops propagation: the title row sits
   *  inside the stage box, which owns its own pointer handlers for drawing,
   *  and `drawable()` can still be true while editing an existing hotspot
   *  (a tool can stay armed across edits) — an unguarded drag would risk
   *  bubbling into "start a new shape". */
  function startPopupDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // No active pointer to capture; the drag still tracks via move events.
    }
    popupDragRef.current = { startX: e.clientX, startY: e.clientY, startOffset: popupDrag ?? { x: 0, y: 0 } };
  }
  function movePopupDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    const drag = popupDragRef.current;
    if (!drag) return;
    setPopupDrag({ x: drag.startOffset.x + (e.clientX - drag.startX), y: drag.startOffset.y + (e.clientY - drag.startY) });
  }
  function endPopupDrag(e: React.PointerEvent<HTMLDivElement>) {
    e.stopPropagation();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Capture may already be gone; nothing to release.
    }
    popupDragRef.current = null;
  }

  /** Every hotspot actually drawn this frame, mid-transition or not — the
   *  destination stage's own list, each shape-morphed against its outgoing
   *  counterpart when one exists and differs, plus "ghost" entries for a
   *  hotspot that existed on the outgoing stage but not the incoming one
   *  (fading out rather than just vanishing). A hotspot only on the
   *  incoming side fades in; one present on both sides with an unchanged
   *  shape needs no morph math run on it at all. */
  const displayHotspots: { hotspot: ViewHotspot; points: Point[]; fadeOpacity: number; ghost: boolean }[] = (() => {
    const currentList = hotspots.filter((h) => hasEnoughPoints(pointsFor(h), h.shape));
    if (!transitionFrom) return currentList.map((h) => ({ hotspot: h, points: pointsFor(h), fadeOpacity: 1, ghost: false }));

    const fromMap = new Map(transitionFrom.hotspots.map((f) => [f.id, f]));
    const currentIds = new Set(currentList.map((h) => h.id));
    const entries = currentList.map((h) => {
      const from = fromMap.get(h.id);
      const to = pointsFor(h);
      if (!from) return { hotspot: h, points: to, fadeOpacity: transitionProgress, ghost: false };
      const samePoints = from.points.length === to.length && from.points.every((p, i) => p.x === to[i].x && p.y === to[i].y);
      return { hotspot: h, points: samePoints ? to : morphShapes(from.points, to, transitionProgress), fadeOpacity: 1, ghost: false };
    });
    for (const from of transitionFrom.hotspots) {
      if (currentIds.has(from.id)) continue;
      const ghost = allHotspots.find((h) => h.id === from.id);
      if (ghost) entries.push({ hotspot: ghost, points: from.points, fadeOpacity: 1 - transitionProgress, ghost: true });
    }

    // Burst/merge: a leftover with no same-id match that names a *different*
    // leftover as its parentHotspotId morphs out of (or into) that parent's
    // shape instead of fading independently. Only when explicitly turned on
    // — unset/'fade' never reaches this, so every existing project's
    // transitions are byte-identical to before this feature existed.
    if (active.splitAnimation === 'burst') {
      // "Leftover" means no same-id match on the other side — distinguished
      // by membership in fromMap/currentIds (already computed above), not by
      // fadeOpacity/ghost values, since a same-id 1:1 morph can also land on
      // fadeOpacity 1 and must never be re-grouped here.
      const leftoverFadeIns = entries.filter((e) => !e.ghost && !fromMap.has(e.hotspot.id));
      const leftoverGhosts = entries.filter((e) => e.ghost);

      // Split: one leftover ghost is the parent; 2+ leftover fade-ins name it.
      const childrenByParent = new Map<string, typeof leftoverFadeIns>();
      for (const e of leftoverFadeIns) {
        const parentId = e.hotspot.parentHotspotId;
        if (!parentId) continue;
        const list = childrenByParent.get(parentId);
        if (list) list.push(e);
        else childrenByParent.set(parentId, [e]);
      }
      for (const [parentId, children] of childrenByParent) {
        if (children.length < 2) continue;
        const parent = leftoverGhosts.find((g) => g.hotspot.id === parentId);
        if (!parent) continue;
        // Replace each child's entry in place — never append alongside it,
        // or it would render both its plain fade-in and this burst at once.
        for (const child of children) {
          entries[entries.indexOf(child)] = { ...child, points: morphShapes(parent.points, child.points, transitionProgress), fadeOpacity: 1 };
        }
      }

      // Merge — the reverse direction: one leftover fade-in is the target;
      // 2+ leftover ghosts name it as their parentHotspotId.
      const exitingByTarget = new Map<string, typeof leftoverGhosts>();
      for (const e of leftoverGhosts) {
        const parentId = e.hotspot.parentHotspotId;
        if (!parentId) continue;
        const list = exitingByTarget.get(parentId);
        if (list) list.push(e);
        else exitingByTarget.set(parentId, [e]);
      }
      for (const [targetId, exiting] of exitingByTarget) {
        if (exiting.length < 2) continue;
        const target = leftoverFadeIns.find((e) => e.hotspot.id === targetId);
        if (!target) continue;
        // Keeps each exiting hotspot's own fade-out opacity (1 - t) — only
        // its points change, so it visibly converges onto the target's
        // shape while fading, rather than popping away at the last instant.
        for (const leaving of exiting) {
          entries[entries.indexOf(leaving)] = { ...leaving, points: morphShapes(leaving.points, target.points, transitionProgress) };
        }
      }
    }

    return entries;
  })();
  // Fades the active auto-overlay in on the same clock as the shape morph
  // above, matching Sidvin's own choice to fade its label layer rather than
  // cut it — 1 outside a transition, or when the overlay kind is unchanged
  // across it (nothing to fade). A transition that *changes* which overlay
  // kind applies (rather than just toggling one on/off) shows the outgoing
  // kind disappear instantly rather than cross-fading two different paints
  // at once — a deliberate simplification, not attempted here.
  const overlayFadeIn = !transitionFrom || transitionFrom.overlay === activeOverlay ? 1 : transitionProgress;

  return (
    // `h-full min-h-0`: this fills exactly the 720px the slide has to give
    // (the `base` wrapper in the root component is `h-full overflow-hidden`
    // for this layout specifically, so there's a genuine, fixed budget to
    // fill instead of growing past it) — `min-h-0` is what lets a flex item
    // actually shrink below its content's natural size, overriding the
    // flexbox default that would otherwise ignore that budget. Everything
    // below shares it: the chrome rows opt out with `shrink-0`, so the
    // plan/seating row is the one thing that actually gives, sizing the
    // plan by whatever height is left rather than the reverse.
    <div className="flex h-full min-h-0 flex-col">
      <div className="mb-2 flex shrink-0 items-center">
        <Title slide={slide} editable={editable} dark={dark} />
      </div>
      {/* The Zoom/pan · North · Calibrate · drawing-tools toolbar that used
          to render here now lives in the Properties panel (see the
          registration effect below and PropertiesPanel.tsx's "Linked View
          Tools" section) — moved off the canvas per direct feedback that it
          didn't belong on the slide itself. This row now goes straight from
          the title to the view tabs. */}
      <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
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
      </div>
      {(active.stages?.length || editable) && active.kind !== 'walkthrough' && (
        active.kind === 'layout' ? (
          // The Sidvin-style plan-evolution stepper — scoped to Layout
          // views specifically. Render/Axo also use stages for
          // non-progression purposes (a day/night toggle, a camera angle),
          // where a linear progress bar would misrepresent what switching
          // stages means, so those kinds keep the plain pill row below.
          <div className="mb-3 shrink-0">
            <PlanTimeline
              stages={active.stages ?? []}
              activeStageId={activeStage?.id}
              editable={editable}
              onSelect={selectStage}
              onAddStage={() => {
                cancelDrawing();
                if (!active.stages?.length) {
                  // A fresh Layout view's first "+ Stage" click offers the
                  // whole suggested progression at once, not one generically
                  // -named stage at a time — still free-text labels
                  // underneath (renamable, same as any other stage), just a
                  // starting point matching the ask's own phrasing.
                  const fresh = ['Zoning', 'Walls', 'Circulation', 'Furniture'].map((label) => ({ id: makeId('stage'), label }));
                  setView(active.id, { stages: fresh });
                  setActiveStageId(fresh[0].id);
                } else {
                  const stage = { id: makeId('stage'), label: `Stage ${active.stages.length + 1}` };
                  setView(active.id, { stages: [...active.stages, stage] });
                  setActiveStageId(stage.id);
                }
              }}
              onRenameStage={(id, label) => setView(active.id, { stages: (active.stages ?? []).map((s) => (s.id === id ? { ...s, label } : s)) })}
            />
          </div>
        ) : null
      )}
      {editable && active.kind === 'layout' && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium text-[var(--ink-3)]">Split style:</span>
          {([
            ['fade', 'Fade'],
            ['burst', 'Burst'],
          ] as const).map(([style, label]) => (
            <button
              key={style}
              onClick={() => setView(active.id, { splitAnimation: style })}
              title="How a hotspot with no same-id match on the other stage animates when it names (or is named by) a parent zone via 'Parent zone' in the hotspot popup"
              className={`flex items-center gap-1.5 rounded-full border px-2 py-1 text-[11px] font-semibold transition ${
                (active.splitAnimation ?? 'fade') === style
                  ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                  : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
              }`}
            >
              <SplitStylePreviewIcon variant={style} />
              {label}
            </button>
          ))}
        </div>
      )}
      {(active.stages?.length || editable) && active.kind !== 'walkthrough' && active.kind !== 'layout' && (
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5">
            {active.stages?.map((s) => (
              <button
                key={s.id}
                onClick={() => {
                  // Same reasoning as selectView: a hotspot mid-edit, or a
                  // half-drawn shape, belongs to the stage it was started on —
                  // switching away should cancel it, not leave it dangling
                  // against a filtered hotspot list that may no longer include it.
                  cancelDrawing();
                  setActiveStageId(s.id);
                }}
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
                  cancelDrawing();
                  setActiveStageId(stage.id);
                }}
                className="rounded-full border border-dashed border-[var(--line)] px-2.5 py-1 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--accent)] hover:text-[var(--accent)]"
              >
                + Stage
              </button>
            )}
          </div>
      )}
      {activeOverlay === 'zoning' && !overlayHidden && zoneCategories.length > 0 && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          {zoneCategories.map((z) => (
            <span key={z} className="flex items-center gap-1 text-[11px] text-[var(--ink-2)]">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: zoneColor(z) }} />
              {z}
            </span>
          ))}
        </div>
      )}
      {editable && active.kind !== 'walkthrough' && active.kind !== 'layout' && (
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-1.5 text-[var(--ink)]">
          <input
            value={active.musicUrl ?? ''}
            onChange={(e) => setView(active.id, { musicUrl: e.target.value || undefined })}
            placeholder="Background music URL (optional)"
            title="A looping ambient track for this view — fades in on arrival, out on leaving"
            className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11px] outline-none"
          />
          <input
            value={active.keyPlanImage?.url ?? ''}
            onChange={(e) =>
              setView(active.id, { keyPlanImage: e.target.value ? { url: e.target.value, arrowDeg: active.keyPlanImage?.arrowDeg } : undefined })
            }
            placeholder="Key plan image URL (optional)"
            title="A small orientation crop of the plan, floated over this view's stage"
            className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-2 py-1 text-[11px] outline-none"
          />
          {active.keyPlanImage && (
            <input
              type="number"
              value={active.keyPlanImage.arrowDeg ?? ''}
              onChange={(e) =>
                setView(active.id, {
                  keyPlanImage: { url: active.keyPlanImage!.url, arrowDeg: e.target.value ? Number(e.target.value) : undefined },
                })
              }
              placeholder="Arrow °"
              title="Camera-direction arrow rotation, in degrees"
              className="w-16 rounded-md border border-[var(--line)] px-2 py-1 text-[11px] outline-none"
            />
          )}
        </div>
      )}
      {/* `min-h-0 flex-1` on the row: with the chrome rows above all opting
          out via `shrink-0`, this row is the one thing that actually claims
          "whatever's left" of the 720px budget. The plan box's own size is
          computed in JS (`fitSize`, see where it's declared) rather than
          left to `flex-1`+`aspect-video`, which don't combine reliably — see
          that comment for why. `justify-center` on the row absorbs whatever
          horizontal space the computed fit doesn't claim. */}
      <div ref={rowRef} className="flex min-h-0 flex-1 justify-center gap-4">
      <div
        ref={stageBoxRef}
        className={`relative min-w-0 select-none overflow-hidden ${fitSize ? '' : 'aspect-video h-full'} ${
          drawing ? 'cursor-crosshair' : zoomPanActive && viewportZoom > 1 ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
        style={fitSize ? { width: fitSize.width, height: fitSize.height } : undefined}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={() => setCursor(null)}
      >
      <div
        className="h-full w-full transition-transform duration-100 ease-out"
        style={{ transform: `scale(${viewportZoom}) translate(${viewportPanX}%, ${viewportPanY}%)` }}
      >
        {/* A ghost of the outgoing stage's image, fading out underneath the
            real (already-switched) MediaBox below fading in — skipped
            entirely as a free no-op when adjacent stages resolve to the
            same url (plausible: Zoning/Walls/Circulation sharing one plan
            render), so an unchanged image never animates. Plain <img>, not
            a second MediaBox: this layer is a fading photograph, not
            something the editor's upload/adjust affordances should ever
            reach. */}
        {transitionFrom && transitionFrom.url && transitionFrom.url !== stageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={transitionFrom.url}
            alt=""
            style={{ ...imageStyle(transitionFrom.transform), opacity: 1 - transitionProgress }}
            className={`pointer-events-none absolute inset-0 h-full w-full rounded-lg ${transitionFrom.isPdfPlan ? 'bg-white object-contain' : 'object-cover'}`}
          />
        )}
        <MediaBox
          url={stageUrl}
          kind={active.kind === 'walkthrough' ? 'video' : 'image'}
          editable={editable}
          onChangeUrl={(url) =>
            // A new plan is a new scale: keeping the old calibration would
            // silently report confident, wrong measurements. Same for the snap
            // geometry, which describes the plan being replaced.
            setStage({ url, calibration: undefined, geometry: undefined, isPdfPlan: undefined })
          }
          onPdfPlan={
            active.kind === 'walkthrough'
              ? undefined
              : ({ imageUrl, geometry }) =>
                  // One patch, not three: these all live in the same `views`
                  // array, and separate writes in one tick clobber each other.
                  setStage({ url: imageUrl, geometry, isPdfPlan: true, calibration: undefined, transform: undefined })
          }
          fit={isPdfPlan ? 'contain' : 'cover'}
          transform={stageTransform}
          onChangeTransform={(t) => setStage({ transform: t })}
          // A PDF plan's geometry and calibration are both fixed to the plan as
          // rendered, so re-cropping it would silently desync both.
          allowAdjust={tool === null && !isPdfPlan}
          className="h-full w-full"
          style={transitionFrom && transitionFrom.url !== stageUrl ? { opacity: transitionProgress } : undefined}
          mediaRef={active.kind === 'walkthrough' ? videoRef : undefined}
        />

        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          {activeOverlay === 'circulation' &&
            !overlayHidden &&
            adjacencyPairs.map(({ a, b }) => {
              const ca = centroidOf(pointsFor(a));
              const cb = centroidOf(pointsFor(b));
              if (!ca || !cb) return null;
              return (
                <g key={`${a.id}|${b.id}`} opacity={overlayFadeIn}>
                  <line
                    x1={ca.x * 100}
                    y1={ca.y * 100}
                    x2={cb.x * 100}
                    y2={cb.y * 100}
                    vectorEffect="non-scaling-stroke"
                    className="stroke-[var(--accent)]"
                    strokeWidth={2}
                    strokeLinecap="round"
                    opacity={0.85}
                  />
                  {[ca, cb].map((p, i) => (
                    <circle key={i} cx={p.x * 100} cy={p.y * 100} r={0.9} vectorEffect="non-scaling-stroke" className="fill-[var(--accent)]" />
                  ))}
                </g>
              );
            })}
          {/* The whole snapped-to line, not just the point marker below — a
              corner reads as a point either way, but a wall you're about to
              measure along should light up as a line, the way a real CAD
              tool's object-snap does. */}
          {pickMode && snapHit?.kind === 'edge' && snapHit.segment && (
            <line
              x1={snapHit.segment.x1 * 100}
              y1={snapHit.segment.y1 * 100}
              x2={snapHit.segment.x2 * 100}
              y2={snapHit.segment.y2 * 100}
              vectorEffect="non-scaling-stroke"
              className="stroke-[var(--accent)]"
              strokeWidth={2.5}
              opacity={0.7}
            />
          )}
          {pickPoints.length > 0 && (
            <g>
              {pickPoints.length === 2 && (
                <line
                  x1={pickPoints[0].x * 100}
                  y1={pickPoints[0].y * 100}
                  x2={pickPoints[1].x * 100}
                  y2={pickPoints[1].y * 100}
                  vectorEffect="non-scaling-stroke"
                  className="stroke-[var(--accent)]"
                  strokeWidth={1.75}
                  strokeDasharray="4,3"
                />
              )}
              {pickPoints.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x * 100}
                  cy={p.y * 100}
                  r={1.1}
                  vectorEffect="non-scaling-stroke"
                  className="fill-white stroke-[var(--accent)]"
                  strokeWidth={1.5}
                />
              ))}
            </g>
          )}
          {displayHotspots.map(({ hotspot: h, points, fadeOpacity, ghost }) => {
            const isHot = !ghost && (hoveredHotspotId === h.id || hoveredRowHotspotIds.includes(h.id));
            // Zoning repaints every space by its zone rather than its authored
            // colour — an unzoned space stays visible but reads as unassigned
            // rather than quietly joining whichever zone it looks nearest.
            const zoning = activeOverlay === 'zoning' && !overlayHidden;
            const zone = zoning ? h.zoneCategory?.trim() : undefined;
            const paint = zoning ? (zone ? zoneColor(zone) : '#94a3b8') : undefined;
            const baseFillOpacity = zoning ? (zone ? 0.38 : 0.1) : (h.fillOpacity ?? DEFAULT_FILL_OPACITY);
            const baseStrokeWidth = zoning ? 1.25 : (h.strokeWidth ?? DEFAULT_STROKE_WIDTH);
            return (
            <path
              key={`${h.id}${ghost ? '-ghost' : ''}`}
              d={shapePath(points, h.shape)}
              vectorEffect="non-scaling-stroke"
              fill={paint ?? h.fillColor ?? DEFAULT_FILL}
              fillOpacity={(isHot ? Math.min(1, baseFillOpacity * 1.8) : baseFillOpacity) * fadeOpacity * (zoning ? overlayFadeIn : 1)}
              stroke={paint ?? h.strokeColor ?? DEFAULT_STROKE}
              strokeWidth={isHot ? baseStrokeWidth * 1.6 : baseStrokeWidth}
              strokeOpacity={fadeOpacity * (zoning ? overlayFadeIn : 1)}
              className={ghost || drawing ? 'pointer-events-none' : 'pointer-events-auto cursor-pointer transition-[fill-opacity,stroke-width]'}
              onMouseEnter={() => !ghost && !drawing && setHoveredHotspotId(h.id)}
              onMouseLeave={() => setHoveredHotspotId((cur) => (cur === h.id ? null : cur))}
              onClick={(e) => {
                if (ghost) return;
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
            );
          })}
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
                  or spline shows the edge you're about to commit. */}
              {isClickTool(tool) && cursor && !pickingTarget && (
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

              {/* Vertex markers — one per placed point, which is meaningful
                  for a handful of clicks but not for a freehand trace's
                  hundreds of raw samples, so it's excluded there. */}
              {tool !== 'freehand' &&
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

        {/* Every overlay label is HTML rather than SVG <text>: the hotspot
            SVG above is stretched with preserveAspectRatio="none", which
            would squash anything drawn as type inside it. Sitting inside the
            same transformed wrapper keeps labels pinned to the plan when a
            viewer zooms. */}
        {dimensionsOn &&
          calibration &&
          displayHotspots
            .filter((d) => !d.ghost)
            .map(({ hotspot: h, points }) => {
            const c = centroidOf(points);
            const areaNorm = shapeArea(points, h.shape);
            if (!c || areaNorm <= 0) return null;
            return (
              <span
                key={h.id}
                className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white"
                style={{ left: `${c.x * 100}%`, top: `${c.y * 100}%` }}
              >
                {h.label ? `${h.label} · ` : ''}
                {formatArea(realArea(areaNorm, FRAME_ASPECT, calibration), calibration.unit)}
              </span>
            );
          })}

        {pickPoints.length === 2 && (
          <span
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded bg-[var(--accent)] px-1.5 py-0.5 text-[9px] font-semibold text-white"
            style={{
              left: `${((pickPoints[0].x + pickPoints[1].x) / 2) * 100}%`,
              top: `${((pickPoints[0].y + pickPoints[1].y) / 2) * 100}%`,
            }}
          >
            {calibration && pickMode === 'measure'
              ? formatMeasure(realDistance(pickPoints[0], pickPoints[1], FRAME_ASPECT, calibration), calibration.unit)
              : 'Enter the real distance →'}
          </span>
        )}

        {/* Drawn as HTML rather than into the overlay <svg>: that one is
            viewBox 0 0 100 100 with preserveAspectRatio="none", so a square
            marker would come out visibly oblong. */}
        {pickMode && snapHit && (
          <span
            className={`pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-1/2 border-2 border-[var(--accent)] bg-white/80 ${
              // A corner reads as a box, a point along a wall as a dot, so it
              // is obvious which of the two you are about to commit.
              snapHit.kind === 'vertex' ? 'h-2.5 w-2.5' : 'h-2 w-2 rounded-full'
            }`}
            style={{ left: `${snapHit.point.x * 100}%`, top: `${snapHit.point.y * 100}%` }}
          />
        )}

        {/* Its own click-capture layer rather than threading another mode
            through the drawing/pan pointer handlers below — those already
            juggle three gestures, and a measurement is a self-contained one. */}
        {pickMode && (
          <div
            className="absolute inset-0 z-20 cursor-crosshair"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => {
              const next = resolvePick(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
              setSnapHit(next.snap);
            }}
            onPointerLeave={() => setSnapHit(null)}
            onClick={(e) => {
              const { point } = resolvePick(e.currentTarget.getBoundingClientRect(), e.clientX, e.clientY);
              // A third click starts a fresh measurement rather than doing
              // nothing — the common case is measuring several things in a row.
              setPickPoints((cur) => (cur.length >= 2 ? [point] : [...cur, point]));
            }}
          />
        )}
      </div>

        {/* One shared row, not each control independently `absolute`-offset
            against the next — that pattern only worked as long as exactly
            two things (mute, "Tap for sound") ever shared this corner, and
            "Tap for sound"'s own `right-12` already only holds because it
            assumes the mute button's exact width. A flex row lays out
            whichever of these are actually present with no offset to keep
            in sync, and gives north an honest "aligned with the others"
            rather than an eyeballed match. */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-2">
          {stageUrl && active.kind !== 'walkthrough' && (
            <div
              className="pointer-events-none flex h-8 w-8 items-center justify-center rounded-full bg-black/60 p-1 shadow-lg"
              style={{ transform: `rotate(${displayNorthDeg}deg)` }}
              title={`North is ${Math.round(displayNorthDeg)}° clockwise from up`}
            >
              <svg viewBox="0 0 40 40" className="h-full w-full">
                <circle cx="20" cy="21" r="17" fill="none" stroke="white" strokeOpacity="0.85" strokeWidth="1.5" />
                {/* Arrow points up toward the N label, shaft below — the arrow
                    itself rotates with the angle; the label rotates with it,
                    which is correct: it's naming whichever direction the arrow
                    is now pointing, not staying pinned to true up. */}
                <line x1="20" y1="31" x2="20" y2="17" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <path d="M20 12 L24 19 L20 16.5 L16 19 Z" fill="white" />
                <text x="20" y="10" textAnchor="middle" fontSize="8" fontWeight="700" fill="white">
                  N
                </text>
              </svg>
            </div>
          )}

          {stageUrl && active.kind !== 'walkthrough' && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                if (!calibration) return;
                setDimensionsOn((cur) => {
                  const next = !cur;
                  setPickMode(next ? 'measure' : null);
                  setPickPoints([]);
                  return next;
                });
              }}
              disabled={!calibration}
              title={calibration ? 'Toggle calibrated dimensions and click-to-measure' : 'Calibrate this plan first'}
              className={`rounded-md px-2.5 py-1.5 text-[11px] font-medium text-white ${
                !calibration ? 'cursor-not-allowed bg-black/40 opacity-60' : dimensionsOn ? 'bg-[var(--accent)] hover:opacity-90' : 'bg-black/60 hover:bg-black/75'
              }`}
            >
              Dimensions
            </button>
          )}

          {activeOverlay && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => setOverlayHidden((cur) => !cur)}
              title={overlayHidden ? `Show the ${activeOverlay} overlay` : `Hide the ${activeOverlay} overlay for a moment`}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/75"
            >
              {overlayHidden ? '🙈' : '👁'}
            </button>
          )}

          {zoomPanActive && viewportZoom > 1 && (
            <button
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => {
                setViewportZoom(1);
                setViewportPanX(0);
                setViewportPanY(0);
              }}
              className="rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/85"
            >
              Reset zoom
            </button>
          )}

          {active.musicUrl && (
            <>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio ref={musicAudioRef} src={active.musicUrl} className="hidden" />
              <button
                onClick={() => {
                  const audio = musicAudioRef.current;
                  const next = !musicMuted;
                  setMusicMuted(next);
                  if (audio) {
                    audio.muted = next;
                    if (!next && musicBlocked) {
                      setMusicBlocked(false);
                      void audio.play().catch(() => setMusicBlocked(true));
                    }
                  }
                }}
                title={musicMuted ? 'Unmute background music' : 'Mute background music'}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/75"
              >
                {musicMuted ? '🔇' : '🔊'}
              </button>
              {musicBlocked && !musicMuted && (
                <button
                  onClick={() => void musicAudioRef.current?.play().catch(() => setMusicBlocked(true))}
                  className="rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/75"
                >
                  Tap for sound
                </button>
              )}
            </>
          )}
        </div>

        {drawing && !pickingTarget && (
          <div onPointerDown={(e) => e.stopPropagation()} className="absolute left-2 top-2 z-20 flex items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white">
            {isClickTool(tool) && drawingPoints ? (
              <>
                <span>
                  {drawingPoints.length} point{drawingPoints.length === 1 ? '' : 's'}
                </span>
                <button onClick={undoPoint} className="underline decoration-white/50 hover:decoration-white">
                  Undo
                </button>
                <button
                  onClick={() => finishShape(drawingPoints!)}
                  disabled={drawingPoints.length < 3}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 font-semibold disabled:opacity-40"
                >
                  {drawingPoints.length < 3 ? `Finish (${3 - drawingPoints.length} more)` : canClose ? 'Click first point' : 'Finish'}
                </button>
              </>
            ) : (
              <span>{LINKED_VIEW_DRAW_TOOLS.find((t) => t.key === tool)?.hint}</span>
            )}
            {/* Shift has no effect on a freehand trace — a continuous gesture,
                not discrete points to constrain — so the hint would mislead. */}
            {tool !== 'freehand' && (
              <span className={ortho ? 'font-semibold text-[#7fd1ff]' : 'text-white/50'}>
                {ortho
                  ? tool === 'rect'
                    ? '⇧ square'
                    : tool === 'ellipse'
                      ? '⇧ circle'
                      : '⇧ 45° locked'
                  : '⇧ to constrain'}
              </span>
            )}
            <button onClick={cancelDrawing} className="underline decoration-white/50 hover:decoration-white">
              Cancel
            </button>
          </div>
        )}

        {/* The calibration pick's own mini-form — reuses the drawing-hint
            bar's exact visual pattern just above, floating over the stage
            instead of living in a pill row (that row is gone now that
            reaching a stage is what turns its overlay on). Bottom-right:
            the one corner none of top-left (drawing hint), top-right
            (badge row) or bottom-left (key plan) already claim. */}
        {pickMode === 'calibrate' && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="absolute bottom-3 right-3 z-20 flex items-center gap-2 rounded-md bg-black/75 px-2.5 py-1.5 text-[11px] font-medium text-white"
          >
            {pickPoints.length === 2 ? (
              <>
                <input
                  autoFocus
                  type="number"
                  value={pendingCalDistance}
                  onChange={(e) => setPendingCalDistance(e.target.value)}
                  placeholder="Distance"
                  title="How far apart those two points are in the real world"
                  className="w-16 rounded border border-white/30 bg-black/40 px-1.5 py-0.5 text-[11px] text-white outline-none placeholder:text-white/50"
                />
                <input
                  value={pendingCalUnit}
                  onChange={(e) => setPendingCalUnit(e.target.value)}
                  placeholder="m"
                  title="Unit — shown after every measurement"
                  className="w-10 rounded border border-white/30 bg-black/40 px-1.5 py-0.5 text-[11px] text-white outline-none placeholder:text-white/50"
                />
                <button
                  onClick={() => {
                    const cal = calibrationFrom(pickPoints[0], pickPoints[1], FRAME_ASPECT, Number(pendingCalDistance), pendingCalUnit.trim() || 'm');
                    if (!cal) return;
                    setCalibration(cal);
                    setPickMode(null);
                    setPickPoints([]);
                  }}
                  className="rounded bg-[var(--accent)] px-2 py-0.5 font-semibold"
                >
                  Set scale
                </button>
              </>
            ) : (
              <span>Click two points a known distance apart</span>
            )}
            <button
              onClick={() => {
                setPickMode(null);
                setPickPoints([]);
              }}
              className="underline decoration-white/50 hover:decoration-white"
            >
              Cancel
            </button>
          </div>
        )}

        {active.keyPlanImage && (
          <div
            className={`absolute bottom-3 left-3 z-20 overflow-hidden rounded-md border-2 border-white/85 shadow-lg transition-all ${
              !keyPlanVisible ? 'h-8 w-8' : keyPlanExpanded ? 'h-56 w-56' : 'h-20 w-20'
            }`}
          >
            {keyPlanVisible ? (
              <button onClick={() => setKeyPlanExpanded((v) => !v)} title="Key plan — click to expand" className="block h-full w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={active.keyPlanImage.url}
                  alt="Key plan"
                  style={active.keyPlanImage.arrowDeg != null ? { transform: `rotate(${active.keyPlanImage.arrowDeg}deg)` } : undefined}
                  className="h-full w-full object-cover"
                />
              </button>
            ) : (
              <button onClick={() => setKeyPlanVisible(true)} title="Show key plan" className="flex h-full w-full items-center justify-center bg-black/60 text-[10px] text-white">
                ▤
              </button>
            )}
            {keyPlanVisible && (
              <button
                onClick={() => setKeyPlanVisible(false)}
                title="Hide key plan"
                className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[9px] text-white"
              >
                ✕
              </button>
            )}
          </div>
        )}

        {showPopup && popupCentroid && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={popupPosition()}
            className="absolute z-20 w-60 -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-[var(--line)] bg-white p-3 text-[var(--ink)] shadow-xl"
          >
            <div
              onPointerDown={startPopupDrag}
              onPointerMove={movePopupDrag}
              onPointerUp={endPopupDrag}
              title="Drag to move"
              className="-m-1 mb-0.5 cursor-grab select-none rounded p-1 text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)] active:cursor-grabbing"
            >
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

            {editingHotspotId && !!activeStage && !!active.stages?.length && (
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Shape on {activeStage.label}</span>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-[var(--ink-2)]">
                    {editingHotspot?.pointsByStage?.[activeStage.id] ? 'Custom shape for this stage' : 'Uses the base shape'}
                  </span>
                  <button
                    onClick={() => editingHotspot && startRedrawShape(editingHotspot)}
                    className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--ink-3)]"
                  >
                    Redraw for this stage
                  </button>
                  {editingHotspot?.pointsByStage?.[activeStage.id] && (
                    <button
                      onClick={() => editingHotspot && clearShapeOverride(editingHotspot)}
                      className="rounded-full border border-[var(--line)] px-2 py-0.5 text-[11px] font-medium text-[var(--ink-3)] hover:border-[var(--ink-3)]"
                    >
                      Clear override
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="mb-2">
              <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Zone</span>
              <input
                value={pendingZoneCategory}
                onChange={(e) => setPendingZoneCategory(e.target.value)}
                placeholder="e.g. Workstations, Meeting, Support"
                title="Groups this space in the Zoning overlay — spaces sharing a zone name share a colour"
                list={`zones-${active.id}`}
                className="w-full rounded-md border border-[var(--line)] bg-white px-2 py-1 text-xs outline-none"
              />
              {/* Existing zones offered as suggestions, so a second "Meeting"
                  is one keystroke rather than a near-miss like "meeting ". */}
              <datalist id={`zones-${active.id}`}>
                {[...new Set(allHotspots.map((h) => h.zoneCategory?.trim()).filter(Boolean))].map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
            </div>

            {allHotspots.some((h) => h.id !== editingHotspotId) && (
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">Adjacent to</span>
                <div className="flex flex-wrap gap-1">
                  {allHotspots
                    .filter((h) => h.id !== editingHotspotId)
                    .map((h) => {
                      const on = pendingAdjacentIds.includes(h.id);
                      return (
                        <button
                          key={h.id}
                          onClick={() =>
                            setPendingAdjacentIds((prev) => (on ? prev.filter((id) => id !== h.id) : [...prev, h.id]))
                          }
                          className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                            on
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                              : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                          }`}
                        >
                          {h.label || 'Untitled'}
                        </button>
                      );
                    })}
                </div>
              </div>
            )}

            {allHotspots.some((h) => h.id !== editingHotspotId) && (
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">
                  Parent zone
                </span>
                <div className="flex flex-wrap gap-1">
                  <button
                    onClick={() => setPendingParentId('')}
                    title="This hotspot has no parent zone"
                    className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                      !pendingParentId
                        ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                    }`}
                  >
                    None
                  </button>
                  {allHotspots
                    .filter((h) => h.id !== editingHotspotId)
                    .map((h) => {
                      const on = pendingParentId === h.id;
                      return (
                        <button
                          key={h.id}
                          onClick={() => setPendingParentId((cur) => (cur === h.id ? '' : h.id))}
                          title="On a plan-evolution transition, this hotspot bursts out of (or merges into) this parent's shape instead of fading independently — see the Burst/Fade toggle near the timeline"
                          className={`rounded-full border px-2 py-0.5 text-[11px] transition ${
                            on
                              ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                              : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                          }`}
                        >
                          {h.label || 'Untitled'}
                        </button>
                      );
                    })}
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

            {pendingGallery.length > 0 && (
              <div className="mb-2 flex gap-1.5">
                <input
                  value={pendingKeyPlanUrl}
                  onChange={(e) => setPendingKeyPlanUrl(e.target.value)}
                  placeholder="Key plan image URL (optional)"
                  title="A small orientation crop shown in this hotspot's own gallery"
                  className="min-w-0 flex-1 rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
                />
                {pendingKeyPlanUrl && (
                  <input
                    type="number"
                    value={pendingKeyPlanArrowDeg}
                    onChange={(e) => setPendingKeyPlanArrowDeg(e.target.value)}
                    placeholder="Arrow °"
                    className="w-16 rounded-md border border-[var(--line)] px-2 py-1.5 text-xs outline-none"
                  />
                )}
              </div>
            )}

            {pendingGallery.length > 0 && pendingTarget && (
              <div className="mb-2">
                <span className="mb-1 block text-[10px] font-semibold text-[var(--ink-3)]">On click</span>
                <div className="flex gap-1.5">
                  {(['gallery', 'navigate'] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      onClick={() => setPendingClickAction((cur) => (cur === action ? '' : action))}
                      className={`flex-1 rounded-md border px-2 py-1 text-[11px] font-medium transition ${
                        pendingClickAction === action
                          ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]'
                          : 'border-[var(--line)] text-[var(--ink-3)] hover:border-[var(--ink-3)]'
                      }`}
                    >
                      {action === 'gallery' ? 'Open gallery' : 'Jump to target'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-2 border-t border-[var(--line)] pt-2">
              <button
                type="button"
                onClick={() => setSpaceDetailOpen((v) => !v)}
                className="mb-1.5 flex w-full items-center justify-between text-[10px] font-bold uppercase tracking-wide text-[var(--ink-3)]"
              >
                <span>Space Detail — surfaces on click, no navigating away</span>
                <span>{spaceDetailOpen ? '−' : '+'}</span>
              </button>
              {spaceDetailOpen && (
                <div className="flex flex-col gap-1.5">
                  <input
                    value={pendingConceptTitle}
                    onChange={(e) => setPendingConceptTitle(e.target.value)}
                    placeholder="Concept title (optional)"
                    className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <textarea
                    value={pendingConceptBody}
                    onChange={(e) => setPendingConceptBody(e.target.value)}
                    placeholder="Concept summary — a couple of lines, not the full slide"
                    rows={2}
                    className="w-full resize-none rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <input
                    value={pendingConceptImage}
                    onChange={(e) => setPendingConceptImage(e.target.value)}
                    placeholder="Concept image URL (optional)"
                    className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <input
                    value={pendingWalkthroughUrl}
                    onChange={(e) => setPendingWalkthroughUrl(e.target.value)}
                    placeholder="Walkthrough video URL (optional)"
                    className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <input
                    value={pendingBoqNote}
                    onChange={(e) => setPendingBoqNote(e.target.value)}
                    placeholder="BOQ note (placeholder — real table coming later)"
                    className="w-full rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <textarea
                    value={pendingSpaceNote}
                    onChange={(e) => setPendingSpaceNote(e.target.value)}
                    placeholder="Anything else about this space (optional)"
                    rows={2}
                    className="w-full resize-none rounded-md border border-[var(--line)] px-2 py-1 text-xs outline-none"
                  />
                  <p className="text-[10px] text-[var(--ink-3)]">
                    {editingHotspot && occupancyFor(editingHotspot.id)
                      ? 'Occupancy is linked via the Seating Capacity table and will show automatically.'
                      : 'Link this hotspot to a Seating Capacity row to also show occupancy here.'}
                  </p>
                </div>
              )}
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
            startIndex={spaceDetailGalleryIndex ?? 0}
            keyPlanImage={lightboxHotspot.keyPlanImage}
            onClose={() => {
              setLightboxHotspotId(null);
              setSpaceDetailGalleryIndex(null);
            }}
          />
        ) : null;
      })()}
      {(() => {
        const spaceHotspot = hotspots.find((h) => h.id === spaceDetailHotspotId);
        return spaceHotspot ? (
          <SpaceDetailOverlay
            label={spaceHotspot.label}
            detail={spaceHotspot.spaceDetail}
            gallery={spaceHotspot.gallery}
            occupancy={occupancyFor(spaceHotspot.id)}
            onOpenGallery={(index) => {
              setSpaceDetailGalleryIndex(index);
              setLightboxHotspotId(spaceHotspot.id);
            }}
            onClose={() => setSpaceDetailHotspotId(null)}
          />
        ) : null;
      })()}
      {/* One stable ref target for the fit-size computation above, regardless
          of which branch below renders (or neither) — its own width is what
          `recompute()` subtracts from the row's width to get the plan's
          available space, so it has to exist unconditionally, not live
          inside whichever conditional branch happens to be active. */}
      <div ref={asideRef} className="shrink-0">
      {active.seatingZones?.length || (editable && !showHotspotList) ? (
        <SeatingTable
          view={active}
          hotspots={hotspots}
          editable={editable}
          hoveredHotspotId={hoveredHotspotId}
          onHoverHotspots={setHoveredRowHotspotIds}
          onChangeView={(patch) => setView(active.id, patch)}
          onSelectHotspot={(id) => {
            const h = hotspots.find((x) => x.id === id);
            if (h) jumpTo(h);
          }}
        />
      ) : (
        showHotspotList && (
          <HotspotSidePanel
            hotspots={hotspots.filter((h) => h.listEntry)}
            hoveredId={hoveredHotspotId}
            onHover={setHoveredHotspotId}
            onSelect={(h) => (editable ? startEditingHotspot(h) : jumpTo(h))}
          />
        )
      )}
      </div>
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
            className={`rounded-[var(--deck-radius-md)] p-5 shadow-[var(--deck-shadow-sm)] ${tinted ? 'bg-[var(--accent-wash)]' : 'bg-white border border-[var(--line)]'}`}
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
  // A custom background (color and/or image) replaces the style's own
  // white/dark-veil default entirely, rather than layering under it — a
  // slide with one either shows its own flat color, or the style's usual
  // look, never both fighting for the same pixels.
  const bg = slide.background;
  const hasCustomBg = !!(bg?.color || bg?.imageUrl);

  const entry = slide.animation?.entry ?? 'none';
  const animClass = animate && entry !== 'none' ? `slide-anim-${entry}` : '';

  const base = (
    <div
      className={`relative flex ${
        slide.layout === 'linked-views' ? 'h-full overflow-hidden' : 'min-h-full'
      } w-full flex-col justify-center px-16 pb-14 pt-10 ${animClass} ${
        hasCustomBg ? '' : dark ? 'bg-[var(--ink)] [background-image:radial-gradient(120%_90%_at_15%_-10%,var(--dark-veil-1),var(--dark-veil-2)_60%)]' : 'bg-white'
      }`}
      style={
        {
          ...(bg?.color ? { backgroundColor: bg.color } : {}),
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
      {bg?.imageUrl && (
        <div className="absolute inset-0 -z-10 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element -- background fill, not a content image; no next/image benefit here */}
          <img src={bg.imageUrl} alt="" className="h-full w-full object-cover" />
          {!!bg.imageOpacity && <div className="absolute inset-0 bg-black" style={{ opacity: bg.imageOpacity }} />}
        </div>
      )}
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
      ) : slide.layout === 'freeform' ? (
        <FreeformSlide slide={slide} editable={editable} />
      ) : slide.layout === 'blank' ? (
        slide.fields.imageUrl || editable ? (
          // Full-bleed, edge-to-edge — deliberately escapes the base
          // wrapper's own px-16/py padding (an absolutely positioned
          // element's containing block is its relative ancestor's padding
          // edge, not inside it) so an "as is" imported slide image shows
          // with no added chrome around it. Still a real MediaBox, so an
          // imported "as is" slide can be replaced/re-cropped/adjusted like
          // any other image slot, not just displayed read-only.
          <MediaBox
            url={slide.fields.imageUrl ?? ''}
            kind="image"
            editable={editable}
            onChangeUrl={(url) => updateField('imageUrl', url)}
            transform={slide.fields.imageTransform}
            onChangeTransform={(t) => updateField('imageTransform', t)}
            className="absolute inset-0 h-full w-full"
            square
          />
        ) : null
      ) : slide.layout === 'concept' ? (
        <ConceptBody slide={slide} editable={editable} animate={animate} dark={dark} />
      ) : (
        <>
          <Kicker slide={slide} editable={editable} />
          {/* Linked Views renders its own Title, sharing its row with the
              per-view toolbar (zoom/pan, north point, drawing tools). */}
          {slide.layout !== 'linked-views' && <Title slide={slide} editable={editable} dark={dark} />}
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
