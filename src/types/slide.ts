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
  | 'linked-views';

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

export type LinkedViewKind = 'layout' | 'render' | 'walkthrough' | 'axo';

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
}

export interface LinkedView {
  id: string;
  kind: LinkedViewKind;
  label: string;
  url: string;
  hotspots?: ViewHotspot[];
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
