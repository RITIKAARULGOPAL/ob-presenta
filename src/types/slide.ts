// Presenta — core slide data model.
//
// A slide is never raw markup. It's { layout, style, fields, animation } —
// this is the one architectural decision the whole app depends on: it's what
// makes undo/redo, versioning, and export possible without a diff engine.

export type SlideLayout =
  | 'blank'
  | 'title-only'
  | 'title-content'
  | 'title-stats'
  | 'two-content'
  | 'title-slide'
  | 'merge-diagram'
  | 'stat-hero'
  | 'concept'
  | 'linked-views'
  | 'site-locus'
  | 'material-compare'
  | 'orbit'
  | 'occupancy-chart';

export type SlideStyleKind = 'standard' | 'section-starter' | 'company' | 'design';

export interface StatItem {
  id: string;
  value: string;
  label: string;
}

export interface MergeItem {
  id: string;
  label: string;
}

/** An orbit-diagram node — a MergeItem plus an optional photo, since the
 *  reference pattern's nodes are photo-filled circles, not plain text chips. */
export interface OrbitNode extends MergeItem {
  imageUrl?: string;
}

/** occupancy-chart layout: one bar. `value` out of `capacity` when given
 *  (percentage-filled bar); just `value` scaled against the slide's own max
 *  when `capacity` is absent. */
export interface OccupancyZone {
  id: string;
  label: string;
  value: number;
  capacity?: number;
}

export type LinkedViewKind = 'layout' | 'render' | 'walkthrough' | 'axo';

/** A structured row shown in a hotspot's side list, and/or as its caption in
 *  a gallery. Presence of a `listEntry` anywhere on a view is what turns on
 *  that view's side-list UI — see LinkedView.showHotspotList. */
export interface HotspotListEntry {
  id: string;
  label: string;
  /** Short figure shown next to the label, e.g. "24 sqm" or "Seats 8". */
  value?: string;
  description?: string;
}

/** One image in a hotspot's own gallery — a lightweight lightbox, not the
 *  full crop/rotate ImageTransform editor every other image slot gets. */
export interface HotspotGalleryImage {
  id: string;
  url: string;
  caption?: string;
}

export interface ViewHotspot {
  id: string;
  /** Polygon outlining the linked region — each vertex relative to the image, 0–1. At least 3 points. */
  points: { x: number; y: number }[];
  /** A view within this same slide. Mutually exclusive with targetSlideId. */
  targetViewId?: string;
  /** Another slide in the deck — e.g. a zone on a plan pointing at the concept
   *  that explains it. Mutually exclusive with targetViewId. */
  targetSlideId?: string;
  /** How the stored points become an outline. Absent means straight edges,
   *  which is every region drawn before shapes were distinguished. 'ellipse'
   *  stores two corner points; 'spline' is retained for regions traced with
   *  the freehand tool that has since been removed. */
  shape?: 'polygon' | 'spline' | 'ellipse';
  /** Seconds — only meaningful when the target view is a walkthrough video. */
  targetTime?: number;
  /** All optional — fall back to a default accent look when unset. */
  fillColor?: string;
  /** 0–1 */
  fillOpacity?: number;
  strokeColor?: string;
  strokeWidth?: number;
  /** Name shown in this hotspot's side-list row and gallery/lightbox title.
   *  Unset on every hotspot drawn before this existed — those keep working as
   *  plain click-to-navigate regions with no label anywhere. */
  label?: string;
  /** Turns this hotspot into a row in its view's side list (see
   *  LinkedView.showHotspotList). Lives on the hotspot itself, not a parallel
   *  array, so there's nothing to keep in sync by id. */
  listEntry?: HotspotListEntry;
  /** A mini image set opened on click — the axo-style "zone gallery". */
  gallery?: HotspotGalleryImage[];
  /** Small cropped orientation thumbnail shown in the gallery/lightbox corner
   *  (a key-plan crop with a camera-direction arrow). */
  keyPlanImage?: { url: string; arrowDeg?: number };
  /** Which of the view's stages this hotspot is active on. Absent = every
   *  stage — the correct default both for hotspots drawn before stages
   *  existed and for a view that never defines any. */
  stageIds?: string[];
  /** What a click does when both a gallery and a nav target are set. Only
   *  needs setting to override the default: 'gallery' if one is present,
   *  else 'navigate'. */
  clickAction?: 'navigate' | 'gallery';
  /** An occupancy-chart zone this hotspot represents — only meaningful
   *  alongside targetSlideId when that slide's layout is 'occupancy-chart'.
   *  Lets a click jump to the chart slide and highlight the matching bar. */
  targetZoneId?: string;
}

/** A named mode a linked view can be switched between while editing/viewing
 *  — e.g. "Zoning" vs "Layout" — gating which hotspots are interactive and
 *  optionally swapping the shown image. Absent/empty on a view = the single
 *  implicit stage every view had before this existed. */
export interface LinkedViewStage {
  id: string;
  label: string;
  /** Swaps the view's own image for this stage. Absent = reuse the view's url/transform. */
  url?: string;
  transform?: ImageTransform;
}

export interface LinkedView {
  id: string;
  kind: LinkedViewKind;
  label: string;
  url: string;
  hotspots?: ViewHotspot[];
  /** How this view's own image sits inside its frame — zoom/pan/rotate/opacity. */
  transform?: ImageTransform;
  /** Named modes hotspots/side-panel content can be gated to. */
  stages?: LinkedViewStage[];
  /** Lets the viewer wheel-zoom/drag-pan the image itself, independent of the
   *  authored `transform` crop. A viewer aid, never persisted back onto it. */
  zoomPanEnabled?: boolean;
  /** Whether to show the hotspot side list at all. Unset = show it exactly
   *  when at least one hotspot has a listEntry — compute that default with
   *  one shared helper wherever this is read, rather than re-deriving it. */
  showHotspotList?: boolean;
}

/** How an image sits inside its own frame — the frame itself (position and
 *  size within the slide layout) is untouched; this only affects what part of
 *  the picture shows and how. All optional; absent means "as uploaded":
 *  filling the frame edge to edge, unrotated, fully opaque. Shared by every
 *  image slot in the deck (slide visuals, linked views, the client logo), so
 *  editing behaves the same everywhere. */
export interface ImageTransform {
  /** How far the image is zoomed in past filling the frame. 1 = exactly fills
   *  it (today's default behaviour); higher crops in tighter. Never below 1 —
   *  that would leave gaps at the frame's edges. */
  zoom?: number;
  /** Pan offset, each as a fraction of the frame's own width/height — 0 is
   *  centered. Clamped so the zoomed image can never reveal empty space. */
  panX?: number;
  panY?: number;
  /** Degrees, clockwise, rotates the image in place around the frame's center. */
  rotation?: number;
  /** 0–1. */
  opacity?: number;
}

export interface SlideFields {
  kickerEyebrow?: string;
  kickerLabel?: string;
  title?: string;
  body?: string;
  leftColumn?: string;
  rightColumn?: string;
  stats?: StatItem[];
  items?: MergeItem[];
  result?: string;
  statValue?: string;
  statLabel?: string;
  caption?: string;
  imageUrl?: string;
  /** How the image at imageUrl sits inside its frame — see ImageTransform. */
  imageTransform?: ImageTransform;
  subtitle?: string;
  numeral?: string;
  /** Concept layout: one-line essence under the title. */
  lead?: string;
  /** Concept layout: short scannable cards beside the visual. */
  points?: MergeItem[];
  /** Concept layout: which visual fills the right half. Defaults to the
   *  generated diagram; 'image' hands the slot to a pasted plan or render. */
  visual?: 'diagram' | 'image';
  views?: LinkedView[];
  /** Other slides this one references — a concept pointing at the layout or
   *  design slide that demonstrates it. Ids may go stale if a slide is deleted,
   *  so every reader must tolerate a miss. */
  linkedSlideIds?: string[];

  /** title-slide only: an optional full-bleed looping background video behind
   *  the cover title/subtitle/logo. URL only, like a linked-views walkthrough
   *  — a base64 video would be tens of megabytes in the project row. */
  heroVideoUrl?: string;

  /** site-locus layout: the reveal photo shown when the locus map (imageUrl)
   *  is hovered/tapped. */
  revealImageUrl?: string;
  revealImageTransform?: ImageTransform;
  /** e.g. "10th Floor" — the caption band on the reveal photo. */
  revealLabel?: string;
  /** Site address, shown under the reveal photo. */
  address?: string;
  /** The sun-path/compass diagram shown beside the locus map. */
  compassImageUrl?: string;

  /** material-compare layout: the two images the slider reveals between. */
  compareBeforeUrl?: string;
  compareBeforeTransform?: ImageTransform;
  compareBeforeLabel?: string;
  compareAfterUrl?: string;
  compareAfterTransform?: ImageTransform;
  compareAfterLabel?: string;

  /** orbit layout: nodes orbiting the core, and the core's own default text
   *  (shown until a node is hovered, which swaps it to that node's own copy). */
  orbitNodes?: OrbitNode[];
  orbitCoreTitle?: string;
  orbitCoreBody?: string;

  /** occupancy-chart layout: one bar per zone, and the unit shown in bar
   *  labels (e.g. "people") — defaults to "occupants" when unset. */
  occupancyZones?: OccupancyZone[];
  occupancyUnit?: string;
  /** Which linked-views slide this chart's zones map to by hotspot label —
   *  set once (on first Excel import) so re-imports don't need re-picking.
   *  May go stale if that slide is deleted; tolerate a miss. */
  linkedViewSlideId?: string;
}

/** Set on slides generated from the concept library, so the UI can show what a
 *  slide came from and offer to re-link it. Pillar/concept ids are stable
 *  slugs, not array indices. */
export interface ConceptOrigin {
  pillarId: string;
  /** Unset on a pillar's own section-starter slide. */
  conceptId?: string;
}

export type AnimationEntry = 'none' | 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideLeft';

export interface SlideAnimation {
  entry: AnimationEntry;
  duration: number;
  delay: number;
}

/** SKV (Studiokon Ventures Private Limited) is the parent company, OB
 * (Officebanao) the child — 'both' covers projects the two do jointly. */
export type Brand = 'skv' | 'ob' | 'both';

/** A deck-wide headline face — see src/lib/fonts.ts for what each resolves to. */
export type FontPairing = 'default' | 'editorial' | 'structural' | 'classic';

/** The four typography axes beyond which face to use — size, weight, body
 * face and letter-spacing, each independently settable. Every field is
 * optional at both the project and slide level: a slide falls back to the
 * project's choice for whatever it doesn't set, and the project falls back
 * to a built-in default (see resolveTypography in src/lib/fonts.ts) for
 * whatever it doesn't set either — the same two-layer fallback
 * Logo & Copyright already uses for `brand`/`brandOverride`, just with four
 * independent knobs instead of one. */
export interface TypographySettings {
  /** Headline face — only meaningful in a slide's typographyOverride, since
   *  the project's own default lives in the separate `fontFamily` field
   *  (it predates this interface and already has its own DB column). */
  font?: FontPairing;
  scale?: 'compact' | 'standard' | 'bold';
  weight?: 'regular' | 'bold';
  bodyFont?: 'geist' | 'plexSans' | 'sourceSerif';
  tracking?: 'tight' | 'normal' | 'wide';
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  style: SlideStyleKind;
  fields: SlideFields;
  animation: SlideAnimation;
  /** Overrides the project's brand for just this slide; unset = inherit. */
  brandOverride?: Brand;
  /** Per-axis typography overrides for just this slide; each unset key
   *  inherits the project's setting for that axis. */
  typographyOverride?: TypographySettings;
  /** Present when this slide was inserted from the concept library. */
  conceptOrigin?: ConceptOrigin;
  /** Kept in the deck but left out of Presenter and export — for a slide that
   *  belongs to the project but not to this particular telling of it. */
  skipped?: boolean;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  preparedBy: string;
  date: string;
  brand: Brand;
  /** The client's own logo — a downscaled data URL, or any image URL. */
  clientLogo?: string;
  /** How the client logo sits inside its own frame — see ImageTransform. */
  clientLogoTransform?: ImageTransform;
  /** Hex accent for the whole deck, usually pulled from the client logo. */
  accentColor?: string;
  /** Headline face for the whole deck. Undefined means Studio (Archivo). */
  fontFamily?: FontPairing;
  /** Deck-wide defaults for size/weight/body-face/tracking; a slide's own
   *  typographyOverride wins per-axis over these. */
  typography?: TypographySettings;
  slides: Slide[];
  createdAt: number;
  updatedAt: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  client: string;
  date: string;
  updatedAt: number;
}
