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
  | 'freeform';

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

export type LinkedViewKind = 'layout' | 'render' | 'walkthrough' | 'axo';

/** One row of a view's seating/capacity table — modeled on the reference
 *  deck's "Seating Capacity" panel (sidvin-design-deck/index4.html): an
 *  Area/Required/Achieved table grouped by zone, embedded beside the plan
 *  it describes rather than off on a separate slide, and two-way hover-
 *  linked to the plan's own hotspots. A row may link to zero hotspots (an
 *  inert row, e.g. "Waiting Lounge" with no distinct callout), exactly one,
 *  or several (e.g. a "Total Workstations" group row and its two breakdown
 *  sub-rows can all point at the same "workhall" hotspot). */
export interface SeatingRow {
  id: string;
  label: string;
  /** Free text, not always a number — the reference shows '—' for figures
   *  the source data doesn't break out this way. Absent = show '—'. */
  required?: string;
  achieved: string;
  /** Shown only while this row (or a hotspot it links to) is hovered — a
   *  contextual aside, not a permanently-listed description. */
  note?: string;
  /** Visual treatment: 'group' is a bold sub-header row (e.g. a combined
   *  total), 'sub' is an indented breakdown under one. Absent = a plain row. */
  kind?: 'row' | 'group' | 'sub';
  /** Hotspot ids on this same view this row highlights on hover, and vice
   *  versa. Absent/empty = inert (no plan link). */
  hotspotIds?: string[];
}

export interface SeatingZone {
  id: string;
  name: string;
  rows: SeatingRow[];
}

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

/** A small cropped orientation thumbnail — "you are here" on the overall
 *  plan — with an optional camera-direction arrow. Shared shape between a
 *  hotspot's own gallery/lightbox corner and a linked view's Render/Axo
 *  stage (see LinkedView.keyPlanImage), matching the reference deck's own
 *  single key-plan treatment reused across both. */
export interface KeyPlanImage {
  url: string;
  arrowDeg?: number;
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
  keyPlanImage?: KeyPlanImage;
  /** Which of the view's stages this hotspot is active on. Absent = every
   *  stage — the correct default both for hotspots drawn before stages
   *  existed and for a view that never defines any. */
  stageIds?: string[];
  /** What a click does when both a gallery and a nav target are set. Only
   *  needs setting to override the default: 'gallery' if one is present,
   *  else 'navigate'. Ignored once `spaceDetail` has any content, or a
   *  seating row links here — those always take over the click (see
   *  SpaceDetailOverlay), since the whole point is staying on the plan
   *  rather than jumping anywhere. */
  clickAction?: 'navigate' | 'gallery';
  /** Everything about this one space, surfaced together on click instead of
   *  navigating away — mid-pitch, without losing the plan or flipping back
   *  through the deck to find which concept justified this space. Every
   *  field is independent; the overlay only renders sections that have
   *  content. Renders reuse `gallery` above rather than duplicating it;
   *  occupancy reuses a linked SeatingRow (via its `hotspotIds`) rather than
   *  storing a second copy of the same number. */
  spaceDetail?: SpaceDetail;
}

/** A short standalone card for the space-detail overlay — deliberately not
 *  a live preview of the actual concept slide (that was considered and
 *  rejected): this is its own lighter summary, written for this popup. */
export interface SpaceConceptSummary {
  title: string;
  body: string;
  imageUrl?: string;
}

/** Bill of Quantities — parked as a placeholder section for now (a real
 *  editable line-item table is a future phase); `note` is just a manual
 *  text placeholder until that lands. */
export interface SpaceBoq {
  note?: string;
}

export interface SpaceDetail {
  concept?: SpaceConceptSummary;
  /** Only meaningful alongside a `gallery` walkthrough clip — separate from
   *  a view's own shared walkthrough tab, since this one is specific to just
   *  this space. */
  walkthroughUrl?: string;
  boq?: SpaceBoq;
  /** Free-form extra — "everything pertaining to the space" that doesn't
   *  fit the other named sections. */
  note?: string;
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
  /** Looping ambient background track played while this view is active —
   *  matches the reference deck's render/axo viewer having its own mutable
   *  background music, faded in on arrival and out on leaving. URL only,
   *  same reasoning as every other media field in this file: no server-side
   *  storage, so a base64 track would bloat the project row. */
  musicUrl?: string;
  /** Still shown in place of a `walkthrough` view's video wherever it cannot
   *  play — export, rail thumbnails, dot previews. Without one an exported
   *  walkthrough view is an empty frame, and (before the render was gated) a
   *  cross-origin clip could take the whole export down. */
  posterUrl?: string;
  /** "You are here" orientation crop shown floating over this view's stage
   *  (Render/Axo, typically) — toggleable, and click-to-expand, matching the
   *  reference deck's key-plan card. Fresh per view; never carries an
   *  expanded state over from the last one shown. */
  keyPlanImage?: KeyPlanImage;
  /** Whether to show the hotspot side list at all. Unset = show it exactly
   *  when at least one hotspot has a listEntry — compute that default with
   *  one shared helper wherever this is read, rather than re-deriving it.
   *  Ignored once `seatingZones` is set — the seating table replaces the
   *  plain side list rather than the two coexisting. */
  showHotspotList?: boolean;
  /** Heading over the seating/capacity table, e.g. "Seating Capacity —
   *  Achieved 300 Pax". Only meaningful alongside `seatingZones`. */
  seatingTitle?: string;
  /** The Area/Required/Achieved table shown beside this view, grouped by
   *  zone and two-way hover-linked to its hotspots (see SeatingRow). Modeled
   *  directly on the reference deck's own "Seating Capacity" panel — this is
   *  what "occupancy" means in this app now, replacing the earlier separate
   *  bar-chart slide + click-jump design. */
  seatingZones?: SeatingZone[];
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

  /** The still shown wherever the hero video cannot play — export, rail
   *  thumbnails, dot previews. Without it those renders have nothing dark
   *  behind the white cover type, so the scrim is suppressed too and the
   *  slide falls back to its normal light treatment rather than going
   *  white-on-grey. URL only, same reasoning as heroVideoUrl. */
  heroPosterUrl?: string;

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

  /** freeform layout: an imported slide's photos/text/shapes, each
   *  independently editable. See FreeformElement. */
  elements?: FreeformElement[];
}

/** Set on slides generated from the concept library, so the UI can show what a
 *  slide came from and offer to re-link it. Pillar/concept ids are stable
 *  slugs, not array indices. */
export interface ConceptOrigin {
  pillarId: string;
  /** Unset on a pillar's own section-starter slide. */
  conceptId?: string;
}

/** One run of styled text within a `FreeformTextElement` paragraph — mirrors
 *  a PowerPoint text run, so a color/weight highlight mid-sentence (e.g. one
 *  pink word inside an otherwise black headline) survives the import. */
export interface FreeformTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
}

export interface FreeformParagraph {
  align: 'left' | 'center' | 'right';
  runs: FreeformTextRun[];
}

/** One independently-editable piece of a `'freeform'` slide — the layout
 *  used for a slide imported "as is" from an external file, where every
 *  photo/text block/shape needs to stay separately editable rather than
 *  collapsing into one flat picture. Position/size are fractions of the
 *  slide canvas (0–1, top-left origin) — same convention as hotspot points
 *  in `ViewHotspot`, not raw pixels, so this holds up at any render scale. */
export type FreeformElement =
  | {
      id: string;
      type: 'image';
      x: number;
      y: number;
      w: number;
      h: number;
      url: string;
      transform?: ImageTransform;
    }
  | {
      id: string;
      type: 'text';
      x: number;
      y: number;
      w: number;
      h: number;
      /** One font size for the whole box — every run inside it was the same
       *  size in the source (only color/weight/italic varied per run). */
      fontSize: number;
      paragraphs: FreeformParagraph[];
      /** A specific font family from the source file (e.g. a monospace
       *  closing statement) — falls back to the deck's own body font when
       *  unset. */
      fontFamily?: string;
    }
  | {
      id: string;
      type: 'shape';
      x: number;
      y: number;
      w: number;
      h: number;
      /** The fill colour. Always present, even when fillOpacity is 0, so a
       *  colour picker always has a real value to show and set. */
      color: string;
      /** 'rect' (default when unset — every shape authored before this
       *  existed was implicitly a plain rectangle, so leaving this absent
       *  must keep rendering exactly as before), 'ellipse', or 'line' (a
       *  straight connector — width is its length, height is ignored). */
      kind?: 'rect' | 'ellipse' | 'line';
      /** Fill opacity specifically — separate from stroke opacity, because
       *  the diagrams this exists for lean hard on "tinted fill, solid
       *  outline" (e.g. a zone at 15% fill with a full-strength border).
       *  Baking this into `color` as rgba() would silently break the native
       *  <input type="color"> editor, which only accepts #rrggbb. */
      fillOpacity?: number;
      /** Outline colour; unset means no outline, matching today's plain
       *  filled rectangle. */
      stroke?: string;
      strokeWidth?: number;
      /** One dashed look (not a configurable pattern) — enough for "this is
       *  a soft connector" vs. "this is a hard edge", which is the only
       *  distinction the source diagrams ever draw. */
      dashed?: boolean;
      /** Corner radius in canvas px (1280-wide canvas). Ignored on 'ellipse'
       *  and 'line'. */
      radius?: number;
      /** Visual rotation in degrees — for a diagonal 'line'. Deliberately
       *  not a second x2/y2 point: every element stays an axis-aligned x/y/
       *  w/h box this way, so the existing drag/snap code (which reads those
       *  four fields off every sibling to compute alignment guides) keeps
       *  working on a 'line' with no special case. */
      rotation?: number;
      /** 'line' only: a solid arrowhead at its end. */
      arrowEnd?: boolean;
    };

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

/** A per-slide override of the layout/style's own default background —
 *  same idea as Google Slides' per-slide Background dialog. All optional;
 *  unset falls back to the style's usual white/dark-veil background. An
 *  image sits behind everything else on the slide (object-cover, no crop
 *  controls — kept simple, unlike the per-element ImageTransform every other
 *  image slot gets); `imageOpacity` is an optional black scrim over it for
 *  text legibility on busy photos, 0–1. Setting a custom color/image doesn't
 *  change what text color a slide's content uses (still driven by
 *  style === 'section-starter' | 'design'), so a dark custom background on
 *  an otherwise-light style needs a light text style too, same as Slides. */
export interface SlideBackground {
  color?: string;
  imageUrl?: string;
  imageOpacity?: number;
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
  /** Per-slide background color/image override — see SlideBackground. */
  background?: SlideBackground;
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
