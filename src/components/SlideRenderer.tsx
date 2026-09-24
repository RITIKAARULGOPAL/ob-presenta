'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
import { SeatingTable } from './SeatingTable';
import { Lightbox } from './Lightbox';
import { SpaceDetailOverlay } from './SpaceDetailOverlay';
import { OrbitDiagram } from './OrbitDiagram';
import { SiteLocusDiagram } from './SiteLocusDiagram';
import { MaterialCompare } from './MaterialCompare';
import { ImageAdjustOverlay } from './ImageAdjustOverlay';
import { LogoAdjustOverlay } from './LogoAdjustOverlay';
import { clamp, imageStyle, maxPan, MAX_ZOOM, MIN_ZOOM } from '@/lib/imageTransform';
import { makeId } from '@/lib/id';
import type { Brand, FreeformElement, HotspotGalleryImage, ImageTransform, LinkedView, Slide, ViewHotspot } from '@/types/slide';
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
  animate = false,
  posterUrl,
  onChangeUrl,
  transform,
  onChangeTransform,
  allowAdjust = true,
  className,
  style,
  mediaRef,
  elevated = false,
  square = false,
}: {
  url: string;
  kind: 'image' | 'video';
  editable: boolean;
  /** Same gate as HeroVideo: when false a `kind: 'video'` box renders its
   *  poster (or an empty frame) instead of a real <video>, so an export never
   *  reaches html-to-image's tainted-canvas path. Reachable in practice
   *  whenever a linked-views deck's first view is the walkthrough, since
   *  `activeId` initialises to views[0].
   *
   *  Defaults to false deliberately — matching SlideRenderer's own `animate`.
   *  A future video slot that forgets to pass it shows a still in the editor,
   *  which someone notices in seconds; the opposite default would silently
   *  reintroduce an export that throws. */
  animate?: boolean;
  posterUrl?: string;
  onChangeUrl: (url: string) => void;
  transform?: ImageTransform;
  onChangeTransform?: (t: ImageTransform | undefined) => void;
  allowAdjust?: boolean;
  className?: string;
  style?: React.CSSProperties;
  mediaRef?: React.Ref<HTMLVideoElement>;
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
    <div className={`relative ${className ?? ''}`} style={style}>
      <div
        ref={frameRef}
        className={`relative h-full w-full overflow-hidden bg-black/30 ${square ? '' : elevated ? 'rounded-[var(--radius-lg)] shadow-[var(--shadow-lg)]' : 'rounded-lg'} ${dragging ? 'ring-2 ring-[var(--accent)]' : ''} ${
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
            animate ? (
              <video ref={mediaRef} src={url} poster={posterUrl || undefined} controls className="h-full w-full object-cover" />
            ) : posterUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={posterUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/40">Walkthrough</div>
            )
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
/** The hero video, and its still stand-in.
 *
 *  `animate` is false for export, rail thumbnails and dot previews. In those
 *  cases a real <video> must not reach the DOM at all: html-to-image's
 *  cloneVideoElement draws the current frame to a canvas and calls
 *  toDataURL(), and since every heroVideoUrl is a pasted cross-origin URL by
 *  design, that canvas is tainted and toDataURL() throws — with no try/catch
 *  around it, unlike the iframe path right below it in that library, so it
 *  takes the whole export down rather than just this slide. Rendering the
 *  poster as a plain <img> sidesteps the code path entirely and reuses
 *  settleStage()'s existing <img> wait for free. */
function HeroVideo({
  url,
  posterUrl,
  editable,
  animate,
  onChangeUrl,
  onChangePosterUrl,
}: {
  url?: string;
  posterUrl?: string;
  editable: boolean;
  animate: boolean;
  onChangeUrl: (url: string) => void;
  onChangePosterUrl: (url: string) => void;
}) {
  const [editingUrl, setEditingUrl] = useState(false);
  const [draft, setDraft] = useState(url ?? '');
  const [editingPoster, setEditingPoster] = useState(false);
  const [posterDraft, setPosterDraft] = useState(posterUrl ?? '');

  if (!url && !editable) return null;

  return (
    <>
      {url && (
        <>
          {animate ? (
            // eslint-disable-next-line jsx-a11y/media-has-caption
            <video
              src={url}
              poster={posterUrl || undefined}
              autoPlay
              muted
              loop
              playsInline
              className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
            />
          ) : (
            posterUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={posterUrl}
                alt=""
                className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
              />
            )
          )}
          {/* The scrim only makes sense over something dark. Painting it when
              nothing is behind it is what turned a still export into a grey
              panel with white-on-white text. */}
          {(animate || posterUrl) && (
            <div className="pointer-events-none absolute inset-0 -z-10 bg-black/45" />
          )}
        </>
      )}
      {editable && url && (
        <div className="absolute inset-x-0 -bottom-7 flex justify-center">
          {editingPoster ? (
            <div className="flex items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2 py-1 shadow-lg">
              <input
                autoFocus
                value={posterDraft}
                onChange={(e) => setPosterDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    onChangePosterUrl(posterDraft.trim());
                    setEditingPoster(false);
                  } else if (e.key === 'Escape') {
                    setEditingPoster(false);
                  }
                }}
                placeholder="Paste poster image URL…"
                className="w-56 text-xs text-[var(--ink)] outline-none"
              />
              <button
                onClick={() => {
                  onChangePosterUrl(posterDraft.trim());
                  setEditingPoster(false);
                }}
                className="shrink-0 rounded bg-[var(--accent)] px-2 py-0.5 text-[10px] font-semibold text-white"
              >
                Set
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setPosterDraft(posterUrl ?? '');
                setEditingPoster(true);
              }}
              title="Shown in exports and thumbnails, where the video cannot play"
              className={`rounded-md border border-dashed px-2.5 py-1 text-[10px] font-semibold transition ${
                posterUrl
                  ? 'border-white/30 text-white/70 hover:border-white/60'
                  : 'border-amber-400/70 text-amber-200 hover:border-amber-300'
              }`}
            >
              {posterUrl ? 'Replace poster' : '⚠ Add a poster for export'}
            </button>
          )}
        </div>
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
  // A shape drawn purely for its outline (no fill — the "floor plate"
  // rectangle several of the diagram presets draw on top of everything else
  // to frame the whole plan) must not block clicks meant for whatever it
  // visually sits over. A plain div with no background is still fully
  // hit-testable by default; pointer-events:none is what actually makes it
  // click-through. Known limitation until Stage 3b's element list exists:
  // this also makes such a shape unreachable by direct click, so for now it
  // can only be repositioned by editing the library data it came from.
  const nonInteractive = el.type === 'shape' && (el.fillOpacity ?? 1) === 0;
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
        cursor: editable && !nonInteractive ? 'move' : undefined,
        pointerEvents: nonInteractive ? 'none' : undefined,
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

/** A freeform 'shape' element — a plain filled rectangle by default (the
 *  original, only kind this ever supported: an imported PPTX colour block),
 *  now also an outlined rect/ellipse and a straight connector line, for the
 *  diagram library (docs/template-system) to draw real floor-plan geometry
 *  with: zones that are a tint plus a full-strength border, a dashed
 *  "planting spine" connector, an arrowed entry line. Rendered as plain divs
 *  — deliberately not inline SVG — because html-to-image (exportDeck.ts)
 *  serialises through an SVG foreignObject, where a *nested* <svg> is
 *  exactly what tends to come out wrong; border-radius, dashed borders and a
 *  CSS transform:rotate() all serialise reliably, so those are the palette
 *  this draws from instead. */
function FreeformShape({ el }: { el: Extract<FreeformElement, { type: 'shape' }> }) {
  const fillOpacity = el.fillOpacity ?? 1;
  const strokeWidth = el.strokeWidth ?? 2;

  if (el.kind === 'line') {
    // The wrapper box is the line's axis-aligned bounding box (so drag/snap
    // need no special case for it); the visible line fills that box's width
    // at vertical-center and rotates as one piece with it, so a diagonal
    // connector is still just "a horizontal bar, rotated" underneath.
    const headPx = strokeWidth * 3.2;
    return (
      <div
        className="flex h-full w-full items-center"
        style={el.rotation ? { transform: `rotate(${el.rotation}deg)` } : undefined}
      >
        <div
          className="w-full"
          style={{
            opacity: fillOpacity,
            borderTopWidth: strokeWidth,
            borderTopStyle: el.dashed ? 'dashed' : 'solid',
            borderTopColor: el.color,
          }}
        />
        {el.arrowEnd && (
          <div
            className="shrink-0"
            style={{
              width: 0,
              height: 0,
              opacity: fillOpacity,
              borderTop: `${headPx}px solid transparent`,
              borderBottom: `${headPx}px solid transparent`,
              borderLeft: `${headPx * 1.3}px solid ${el.color}`,
              marginLeft: -1,
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="h-full w-full"
      style={{
        backgroundColor: el.color,
        opacity: fillOpacity,
        border: el.stroke ? `${strokeWidth}px ${el.dashed ? 'dashed' : 'solid'} ${el.stroke}` : undefined,
        borderRadius: el.kind === 'ellipse' ? '50%' : el.radius ? `${el.radius}px` : undefined,
      }}
    />
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
            <FreeformShape el={el} />
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
function LinkedViewsExplorer({ slide, editable, animate = false }: SlideRendererProps) {
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
  /** Which stages the hotspot being drawn/edited is active on. Empty = every
   *  stage (matches `stageIds` being unset on save). */
  const [pendingStageIds, setPendingStageIds] = useState<string[]>([]);
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

  // Fresh key-plan state per view — never carries an expanded card over from
  // whichever view was showing before, matching the reference deck.
  useEffect(() => {
    setKeyPlanVisible(true);
    setKeyPlanExpanded(false);
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
    setPendingConceptTitle(h?.spaceDetail?.concept?.title ?? '');
    setPendingConceptBody(h?.spaceDetail?.concept?.body ?? '');
    setPendingConceptImage(h?.spaceDetail?.concept?.imageUrl ?? '');
    setPendingWalkthroughUrl(h?.spaceDetail?.walkthroughUrl ?? '');
    setPendingBoqNote(h?.spaceDetail?.boq?.note ?? '');
    setPendingSpaceNote(h?.spaceDetail?.note ?? '');
    setSpaceDetailOpen(!!h?.spaceDetail);
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
      spaceDetail: buildSpaceDetail(),
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
              spaceDetail: buildSpaceDetail(),
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
    if (hasRichDetail || occupancyFor(hotspot.id)) {
      setSpaceDetailHotspotId(hotspot.id);
      return;
    }
    if (hotspot.gallery?.length) {
      setLightboxHotspotId(hotspot.id);
      return;
    }
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
      {editable && active.kind !== 'walkthrough' && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
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
          animate={animate}
          posterUrl={active.posterUrl}
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
          {hotspots.filter((h) => hasEnoughPoints(h.points, h.shape)).map((h) => {
            const isHot = hoveredHotspotId === h.id || hoveredRowHotspotIds.includes(h.id);
            return (
            <path
              key={h.id}
              d={shapePath(h.points, h.shape)}
              vectorEffect="non-scaling-stroke"
              fill={h.fillColor ?? DEFAULT_FILL}
              fillOpacity={isHot ? Math.min(1, (h.fillOpacity ?? DEFAULT_FILL_OPACITY) * 1.8) : (h.fillOpacity ?? DEFAULT_FILL_OPACITY)}
              stroke={h.strokeColor ?? DEFAULT_STROKE}
              strokeWidth={isHot ? (h.strokeWidth ?? DEFAULT_STROKE_WIDTH) * 1.6 : (h.strokeWidth ?? DEFAULT_STROKE_WIDTH)}
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
              className="absolute right-2 top-2 z-20 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-sm text-white hover:bg-black/75"
            >
              {musicMuted ? '🔇' : '🔊'}
            </button>
            {musicBlocked && !musicMuted && (
              <button
                onClick={() => void musicAudioRef.current?.play().catch(() => setMusicBlocked(true))}
                className="absolute right-12 top-2 z-20 rounded-full bg-black/60 px-2.5 py-1.5 text-[11px] font-medium text-white hover:bg-black/75"
              >
                Tap for sound
              </button>
            )}
          </>
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
      {active.seatingZones?.length || (editable && !showHotspotList) ? (
        <SeatingTable
          view={active}
          hotspots={hotspots}
          editable={editable}
          hoveredHotspotId={hoveredHotspotId}
          onHoverHotspots={setHoveredRowHotspotIds}
          onChangeView={(patch) => setView(active.id, patch)}
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
      className={`relative flex min-h-full w-full flex-col justify-center px-16 pb-14 pt-10 ${animClass} ${
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
        (() => {
          /* Whether anything dark is *actually painted* behind the cover type
             right now — not merely whether a video URL exists. Keying the text
             colour off the URL alone is what produced white-on-grey covers in
             every export: with no video playing and no poster, the scrim sat
             over the white stage at ~#8c8c8c and the title was still white. */
          const heroDark = !!slide.fields.heroVideoUrl && (animate || !!slide.fields.heroPosterUrl);
          return (
            <div className="relative text-center">
              <HeroVideo
                url={slide.fields.heroVideoUrl}
                posterUrl={slide.fields.heroPosterUrl}
                editable={editable}
                animate={animate}
                onChangeUrl={(url) => updateField('heroVideoUrl', url)}
                onChangePosterUrl={(url) => updateField('heroPosterUrl', url)}
              />
              <div className="relative">
                <Kicker slide={slide} editable={editable} />
                <EditableText
                  editable={editable}
                  value={slide.fields.title ?? ''}
                  onChange={(v) => updateField('title', v)}
                  as="h1"
                  placeholder="Presentation title"
                  style={headlineStyle(3)}
                  className={`font-display outline-none ${heroDark ? 'text-white' : 'text-[var(--accent)]'}`}
                />
                <EditableText
                  editable={editable}
                  value={slide.fields.subtitle ?? ''}
                  onChange={(v) => updateField('subtitle', v)}
                  as="p"
                  placeholder="Subtitle"
                  className={`mx-auto mt-4 max-w-lg outline-none ${heroDark ? 'text-white/80' : 'text-[var(--ink-2)]'}`}
                />
                <ClientLogo editable={editable} dark={dark || heroDark} />
              </div>
            </div>
          );
        })()
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
          {slide.layout === 'linked-views' && <LinkedViewsExplorer slide={slide} editable={editable} animate={animate} />}
          {slide.layout === 'orbit' && <OrbitDiagram slide={slide} editable={editable} animate={animate} />}
          {slide.layout === 'site-locus' && <SiteLocusDiagram slide={slide} editable={editable} animate={animate} />}
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
