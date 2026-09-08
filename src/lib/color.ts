/** Colour helpers for deriving a presentation's accent from a client logo. */

/** Pulls the most prominent *usable* accent colours out of an image.
 *
 * "Usable" does real work here. Logos are mostly black, white and grey, none of
 * which function as an accent, so near-neutral and near-blown-out pixels are
 * discarded first.
 *
 * The colours that remain are then grouped **by hue family**, not by RGB
 * proximity, and each family is represented by its most vivid member. That
 * matters: sampling the SKV mark by raw RGB frequency returns five muddy
 * yellows (#493808 first, since anti-aliased edge pixels outnumber fill
 * pixels) and buries the actual brand yellow. Grouping by hue collapses all of
 * those into the one swatch a designer would name — #f3b612 — while genuinely
 * different hues still come back separately.
 *
 * A purely black-and-white logo legitimately yields nothing, so callers should
 * handle an empty array rather than treat it as a failure.
 */
export async function extractAccentColors(src: string, count = 5): Promise<string[]> {
  const img = await loadImage(src);

  // Small sample: plenty for dominant-colour work and far quicker than full size.
  const w = 96;
  const h = Math.max(1, Math.round((img.height / img.width) * w));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Could not get a canvas context to read the image.');
  ctx.drawImage(img, 0, 0, w, h);

  const { data } = ctx.getImageData(0, 0, w, h);
  type Family = { n: number; best: { r: number; g: number; b: number; score: number } };
  const families = new Map<number, Family>();

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (data[i + 3] < 200) continue;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = max / 255;
    const saturation = max === 0 ? 0 : (max - min) / max;

    if (saturation < 0.25) continue; // greys, black, white
    if (lightness < 0.15 || lightness > 0.97) continue; // too dark / blown out

    const bin = Math.round(hueOf(r, g, b) / 15); // 15° hue families
    const score = saturation * lightness; // vividness
    const family = families.get(bin);
    if (!family) {
      families.set(bin, { n: 1, best: { r, g, b, score } });
    } else {
      family.n += 1;
      if (score > family.best.score) family.best = { r, g, b, score };
    }
  }

  const hues = [...families.values()]
    .sort((a, b) => b.n - a.n) // most of the image first
    .slice(0, count)
    .map((f) => rgbToHex(f.best.r, f.best.g, f.best.b));

  return padWithTones(hues, count);
}

/** Tops a palette up to `count` with tonal variants of the colours found.
 *
 * A single-hue logo (SKV is just yellow) otherwise offers exactly one choice,
 * and the one vivid swatch isn't always the right accent — bright yellow as
 * title text on white is barely legible, so a deeper shade of the same hue is
 * often the usable option. Shades come before tints for that reason. */
function padWithTones(base: string[], count: number): string[] {
  if (base.length === 0 || base.length >= count) return base.slice(0, count);

  const out = [...base];
  // Deeper first, then lighter — widening each round rather than exhausting
  // one colour's variants before moving on.
  const steps = [
    (hex: string) => shadeWithBlack(hex, 0.25),
    (hex: string) => tintWithWhite(hex, 0.3),
    (hex: string) => shadeWithBlack(hex, 0.5),
    (hex: string) => tintWithWhite(hex, 0.55),
  ];

  for (const step of steps) {
    for (const hex of base) {
      if (out.length >= count) return out;
      const variant = step(hex);
      if (!out.some((existing) => existing.toLowerCase() === variant.toLowerCase())) out.push(variant);
    }
  }
  return out.slice(0, count);
}

/** Hue in degrees, 0–360. */
function hueOf(r: number, g: number, b: number): number {
  const R = r / 255;
  const G = g / 255;
  const B = b / 255;
  const max = Math.max(R, G, B);
  const delta = max - Math.min(R, G, B);
  if (delta === 0) return 0;

  let h: number;
  if (max === R) h = ((G - B) / delta) % 6;
  else if (max === G) h = (B - R) / delta + 2;
  else h = (R - G) / delta + 4;

  h *= 60;
  return h < 0 ? h + 360 : h;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load that image.'));
    img.src = src;
  });
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return null;
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

/** Mixes a colour toward white — used to derive the soft accent tints the slide
 * styles need (tinted fills, hairline borders) from a single accent colour. */
export function tintWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (v: number) => Math.round(v + (255 - v) * amount);
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

/** Mixes a colour toward black, for deeper variants of the same hue. */
export function shadeWithBlack(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const mix = (v: number) => Math.round(v * (1 - amount));
  return rgbToHex(mix(rgb.r), mix(rgb.g), mix(rgb.b));
}

/** Relative luminance per WCAG, 0 (black) to 1 (white). */
function luminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** WCAG contrast ratio between two colours, 1–21. */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}
