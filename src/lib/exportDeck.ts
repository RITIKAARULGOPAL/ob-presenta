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

/** Wait until what's on the stage is actually what we asked for.
 *
 *  Two things here run on their own clock. React 19 commits asynchronously, so
 *  a frame has to pass before the new slide is even in the DOM; and a slide's
 *  images are fetched by the browser rather than by React, so they can still be
 *  decoding after that commit. Rasterizing early yields a frame with its photo
 *  missing — or, since html-to-image serializes whatever it finds, one that
 *  still shows the slide before it. */
async function settleStage(stage: HTMLElement): Promise<void> {
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  await Promise.all(
    Array.from(stage.querySelectorAll('img')).map(
      (img) =>
        new Promise<void>((res) => {
          if (img.complete && img.naturalWidth > 0) return res();
          img.addEventListener('load', () => res(), { once: true });
          img.addEventListener('error', () => res(), { once: true });
        })
    )
  );

  // One more frame, so a just-decoded image is painted before we serialize.
  await new Promise((r) => requestAnimationFrame(r));
}

async function captureSlides(project: Project, onProgress?: ExportProgress): Promise<string[]> {
  // Two elements, and the split matters. html-to-image copies the CAPTURED
  // node's own computed style onto its clone and renders that clone inside an
  // SVG foreignObject — so when the captured node is the one holding
  // `left: -99999px`, the clone lands 99999px outside the frame and every page
  // comes back fully transparent. Keep the hiding on an outer wrapper that is
  // never captured, and give the stage no positioning of its own.
  const wrapper = document.createElement('div');
  wrapper.style.position = 'fixed';
  wrapper.style.top = '0';
  wrapper.style.left = '-99999px';
  wrapper.style.width = `${SLIDE_W}px`;
  wrapper.style.height = `${SLIDE_H}px`;
  wrapper.style.overflow = 'hidden';

  const stage = document.createElement('div');
  stage.style.width = `${SLIDE_W}px`;
  stage.style.height = `${SLIDE_H}px`;
  stage.style.overflow = 'hidden';
  // A slide paints its own background, but an explicit ground here means a
  // transparent PNG can never reach a PDF page or a PPTX picture frame.
  stage.style.background = '#ffffff';

  wrapper.appendChild(stage);
  document.body.appendChild(wrapper);

  const root = createRoot(stage);
  const images: string[] = [];

  try {
    await document.fonts.ready;

    // Skipped slides stay in the project but out of the deliverable.
    const exportable = project.slides.filter((s) => !s.skipped);

    for (let i = 0; i < exportable.length; i++) {
      const slide = exportable[i];
      root.render(createElement(SlideRenderer, { slide, editable: false }));
      await settleStage(stage);

      const dataUrl = await htmlToImage.toPng(stage, {
        width: SLIDE_W,
        height: SLIDE_H,
        pixelRatio: 2,
        cacheBust: true,
      });
      images.push(dataUrl);
      onProgress?.(i + 1, exportable.length);
    }
  } finally {
    root.unmount();
    wrapper.remove();
  }

  return images;
}

export async function exportToPdf(project: Project, onProgress?: ExportProgress): Promise<void> {
  const images = await captureSlides(project, onProgress);
  // jsPDF defaults `orientation` to 'p' whenever it's omitted — not "infer
  // from the format array" — and then swaps a landscape [1280, 720] array to
  // portrait to match. Omitting orientation (the previous code here) produced
  // exactly that: every exported page was a 960×1706.67pt portrait sheet with
  // our 1280×720 landscape image drawn in the top-left corner, not filling
  // it. `orientation: 'l'` has to be passed to the constructor AND to every
  // addPage() call — each one re-runs the same default-to-portrait check.
  const pdf = new jsPDF({ orientation: 'l', unit: 'px', format: [SLIDE_W, SLIDE_H] });

  images.forEach((dataUrl, i) => {
    if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'l');
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
