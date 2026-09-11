import type { FontPairing } from '@/types/slide';

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
