import type { CSSProperties } from 'react';
import type { FontPairing, TypographySettings } from '@/types/slide';

/** A deck's headline face, deck-wide — same shape as accentColor: optional,
 * one choice, applies to every slide. The body face (Geist) stays fixed
 * across all four; the display face is what actually carries a pairing's
 * personality on a slide, since it's what titles and kickers render in.
 *
 * Each `cssVar` names a family next/font/google already loaded at build time
 * in layout.tsx — next/font needs a static import per family, so this list
 * is necessarily closed rather than a free-form font name. `default`
 * resolves to Archivo, matching every deck created before this existed. */
export const FONT_PAIRINGS: { key: FontPairing; label: string; cssVar: string; sample: string }[] = [
  { key: 'default', label: 'Studio', cssVar: 'var(--font-archivo)', sample: 'Aa' },
  { key: 'editorial', label: 'Editorial', cssVar: 'var(--font-fraunces)', sample: 'Aa' },
  { key: 'structural', label: 'Structural', cssVar: 'var(--font-big-shoulders)', sample: 'Aa' },
  { key: 'classic', label: 'Classic', cssVar: 'var(--font-playfair)', sample: 'Aa' },
];

export function resolveFontVar(key: FontPairing | undefined): string {
  return FONT_PAIRINGS.find((f) => f.key === key)?.cssVar ?? FONT_PAIRINGS[0].cssVar;
}

// ---------------------------------------------------------------------------
// Typography: size, weight, body face, tracking. Each is a per-slide
// override over a project-wide default over a built-in fallback — the same
// two-layer shape as brand/brandOverride, just four independent axes instead
// of one. See resolveTypography below for how the three layers combine.
// ---------------------------------------------------------------------------

export const TYPE_SCALES: { key: NonNullable<TypographySettings['scale']>; label: string; multiplier: number }[] = [
  { key: 'compact', label: 'Compact', multiplier: 0.85 },
  { key: 'standard', label: 'Standard', multiplier: 1 },
  { key: 'bold', label: 'Bold', multiplier: 1.15 },
];

export const HEADLINE_WEIGHTS: { key: NonNullable<TypographySettings['weight']>; label: string; value: number }[] = [
  { key: 'regular', label: 'Regular', value: 500 },
  { key: 'bold', label: 'Bold', value: 800 },
];

/** Body face choices for the deck's running text — kickers, descriptions,
 * captions, everything that isn't a headline. Independent of the headline
 * pairing above: you can run Editorial headlines over Geist body copy, or
 * Studio headlines over Source Serif body copy. */
export const BODY_FONTS: { key: NonNullable<TypographySettings['bodyFont']>; label: string; cssVar: string }[] = [
  { key: 'geist', label: 'Geist', cssVar: 'var(--font-geist-sans)' },
  { key: 'plexSans', label: 'IBM Plex Sans', cssVar: 'var(--font-plex-sans)' },
  { key: 'sourceSerif', label: 'Source Serif', cssVar: 'var(--font-source-serif)' },
];

export const TRACKINGS: { key: NonNullable<TypographySettings['tracking']>; label: string; value: string }[] = [
  { key: 'tight', label: 'Tight', value: '-0.02em' },
  { key: 'normal', label: 'Normal', value: '0em' },
  { key: 'wide', label: 'Wide', value: '0.03em' },
];

const BUILT_IN_DEFAULTS: Required<TypographySettings> = {
  scale: 'standard',
  weight: 'bold',
  bodyFont: 'geist',
  tracking: 'normal',
};

/** Combines a slide's override, the project's default and the built-in
 * fallback into one resolved value per axis — slide wins, then project,
 * then the built-in. Also returns the actual CSS values (multiplier, weight
 * number, CSS var, letter-spacing) each key resolves to, so callers don't
 * need to re-look those up themselves. */
export function resolveTypography(project: TypographySettings | undefined, slideOverride: TypographySettings | undefined) {
  const scale = slideOverride?.scale ?? project?.scale ?? BUILT_IN_DEFAULTS.scale;
  const weight = slideOverride?.weight ?? project?.weight ?? BUILT_IN_DEFAULTS.weight;
  const bodyFont = slideOverride?.bodyFont ?? project?.bodyFont ?? BUILT_IN_DEFAULTS.bodyFont;
  const tracking = slideOverride?.tracking ?? project?.tracking ?? BUILT_IN_DEFAULTS.tracking;

  return {
    scale,
    weight,
    bodyFont,
    tracking,
    scaleMultiplier: TYPE_SCALES.find((s) => s.key === scale)!.multiplier,
    weightValue: HEADLINE_WEIGHTS.find((w) => w.key === weight)!.value,
    bodyFontVar: BODY_FONTS.find((b) => b.key === bodyFont)!.cssVar,
    trackingValue: TRACKINGS.find((t) => t.key === tracking)!.value,
  };
}

/** A headline element's font-size, weight and letter-spacing, all resolved
 * through the three CSS custom properties SlideRenderer sets on the slide's
 * base container (--type-scale, --headline-weight, --headline-tracking) —
 * so every headline reads the same live variables rather than each carrying
 * its own copy of the resolved value. `baseRem` is that ONE element's normal
 * (Standard-scale) size — text-3xl is 1.875, text-4xl 2.25, text-5xl 3,
 * text-8xl 6, matching the Tailwind size classes this replaces. */
export function headlineStyle(baseRem: number): CSSProperties {
  return {
    fontSize: `calc(${baseRem}rem * var(--type-scale, 1))`,
    fontWeight: 'var(--headline-weight, 800)' as unknown as number,
    letterSpacing: 'var(--headline-tracking, 0em)',
  };
}
