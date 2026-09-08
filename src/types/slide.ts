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
  targetViewId: string;
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
  views?: LinkedView[];
}

export type AnimationEntry = 'none' | 'fadeUp' | 'fadeIn' | 'scaleIn' | 'slideLeft';

export interface SlideAnimation {
  entry: AnimationEntry;
  duration: number;
  delay: number;
}

export interface Slide {
  id: string;
  layout: SlideLayout;
  style: SlideStyleKind;
  fields: SlideFields;
  animation: SlideAnimation;
}

export interface Project {
  id: string;
  name: string;
  client: string;
  preparedBy: string;
  date: string;
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
