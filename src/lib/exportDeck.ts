import { createRoot } from 'react-dom/client';
import { createElement } from 'react';
import * as htmlToImage from 'html-to-image';
import { jsPDF } from 'jspdf';
import { SlideRenderer } from '@/components/SlideRenderer';
import type { Project } from '@/types/slide';

// Export renders each slide off-screen at a fixed 16:9 pixel size, rasterizes
// it with html-to-image, then assembles the images into a PDF or PPTX. This
// reuses SlideRenderer directly so exported output always matches what the
// editor/presenter show — no second layout engine to keep in sync. PDF/PPTX
// are frozen-frame formats, so each slide is captured in its settled (post-
// animation) state; entrance animations don't carry over by design.

const SLIDE_W = 1280;
const SLIDE_H = 720;

export type ExportProgress = (current: number, total: number) => void;

function sanitizeFilename(name: string): string {
  return name.trim().replace(/[^a-z0-9-_ ]/gi, '').replace(/\s+/g, '-').slice(0, 80) || 'presenta-deck';
}

async function captureSlides(project: Project, onProgress?: ExportProgress): Promise<string[]> {
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '-99999px';
  container.style.width = `${SLIDE_W}px`;
  container.style.height = `${SLIDE_H}px`;
  container.style.overflow = 'hidden';
  document.body.appendChild(container);

  const root = createRoot(container);
  const images: string[] = [];

  try {
    await document.fonts.ready;

    for (let i = 0; i < project.slides.length; i++) {
      const slide = project.slides[i];
      root.render(createElement(SlideRenderer, { slide, editable: false }));
      // Two frames: one for React to commit, one for layout/paint to settle.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const dataUrl = await htmlToImage.toPng(container, {
        width: SLIDE_W,
        height: SLIDE_H,
        pixelRatio: 2,
        cacheBust: true,
      });
      images.push(dataUrl);
      onProgress?.(i + 1, project.slides.length);
    }
  } finally {
    root.unmount();
    container.remove();
  }

  return images;
}

export async function exportToPdf(project: Project, onProgress?: ExportProgress): Promise<void> {
  const images = await captureSlides(project, onProgress);
  // Passing both `orientation` and a custom pixel `format` array makes jsPDF
  // swap the dimensions a second time, silently producing a portrait canvas
  // the wrong size for our image draws — the format array alone is enough.
  const pdf = new jsPDF({ unit: 'px', format: [SLIDE_W, SLIDE_H] });

  images.forEach((dataUrl, i) => {
    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H]);
    pdf.addImage(dataUrl, 'PNG', 0, 0, SLIDE_W, SLIDE_H);
  });

  pdf.save(`${sanitizeFilename(project.name)}.pdf`);
}

export async function exportToPptx(project: Project, onProgress?: ExportProgress): Promise<void> {
  const images = await captureSlides(project, onProgress);
  const PptxGenJS = (await import('pptxgenjs')).default;
  const pres = new PptxGenJS();

  pres.defineLayout({ name: 'PRESENTA_16X9', width: 13.333, height: 7.5 });
  pres.layout = 'PRESENTA_16X9';

  for (const dataUrl of images) {
    const slide = pres.addSlide();
    slide.addImage({ data: dataUrl, x: 0, y: 0, w: 13.333, h: 7.5 });
  }

  await pres.writeFile({ fileName: `${sanitizeFilename(project.name)}.pptx` });
}
