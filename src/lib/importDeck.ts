import { makeId } from './id';
import type { Slide, SlideLayout, SlideStyleKind, StatItem, MergeItem } from '@/types/slide';

// PDF import: rasterize each page with pdf.js, send the image to the
// /api/import-slide route (Gemini vision → our Slide schema), one page at a
// time. Kept synchronous/sequential on purpose for this first cut — no
// queue, no storage bucket, nothing survives past the import call itself.

export type ImportProgress = (current: number, total: number) => void;

interface GeminiSlideResult {
  layout?: string;
  style?: string;
  kickerEyebrow?: string;
  kickerLabel?: string;
  title?: string;
  body?: string;
  leftColumn?: string;
  rightColumn?: string;
  subtitle?: string;
  stats?: { value: string; label: string }[];
  items?: { label: string }[];
  result?: string;
  statValue?: string;
  statLabel?: string;
  caption?: string;
}

const VALID_LAYOUTS: SlideLayout[] = [
  'blank',
  'title-only',
  'title-content',
  'title-stats',
  'two-content',
  'title-slide',
  'merge-diagram',
  'stat-hero',
];
const VALID_STYLES: SlideStyleKind[] = ['standard', 'section-starter', 'company', 'design'];

function toSlide(result: GeminiSlideResult): Slide {
  const layout = VALID_LAYOUTS.includes(result.layout as SlideLayout) ? (result.layout as SlideLayout) : 'title-content';
  const style = VALID_STYLES.includes(result.style as SlideStyleKind) ? (result.style as SlideStyleKind) : 'standard';

  const stats: StatItem[] | undefined = result.stats?.map((s) => ({ id: makeId('stat'), value: s.value, label: s.label }));
  const items: MergeItem[] | undefined = result.items?.map((it) => ({ id: makeId('item'), label: it.label }));

  return {
    id: makeId('slide'),
    layout,
    style,
    fields: {
      kickerEyebrow: result.kickerEyebrow,
      kickerLabel: result.kickerLabel,
      title: result.title,
      body: result.body,
      leftColumn: result.leftColumn,
      rightColumn: result.rightColumn,
      subtitle: result.subtitle,
      stats,
      items,
      result: result.result,
      statValue: result.statValue,
      statLabel: result.statLabel,
      caption: result.caption,
    },
    animation: { entry: 'none', duration: 600, delay: 0 },
  };
}

async function renderPdfPageToBase64(pdf: import('pdfjs-dist').PDFDocumentProxy, pageNumber: number): Promise<string> {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get canvas context.');
  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas.toDataURL('image/png').split(',')[1];
}

async function requestSlideFromImage(imageBase64: string): Promise<Slide> {
  const res = await fetch('/api/import-slide', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Import request failed (${res.status})`);
  }
  const result: GeminiSlideResult = await res.json();
  return toSlide(result);
}

export async function importSlidesFromPdf(file: File, onProgress?: ImportProgress): Promise<Slide[]> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const slides: Slide[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    try {
      const imageBase64 = await renderPdfPageToBase64(pdf, i);
      const slide = await requestSlideFromImage(imageBase64);
      slides.push(slide);
    } catch (err) {
      console.error(`Failed to import page ${i}:`, err);
      slides.push({
        id: makeId('slide'),
        layout: 'title-only',
        style: 'standard',
        fields: { title: `Page ${i} (import failed)` },
        animation: { entry: 'none', duration: 600, delay: 0 },
      });
    }
    onProgress?.(i, pdf.numPages);
  }

  return slides;
}
