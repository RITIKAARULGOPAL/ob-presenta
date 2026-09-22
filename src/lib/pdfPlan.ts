import type { PlanGeometry } from '@/types/slide';

// ---------------------------------------------------------------------------
// Turning an uploaded PDF floor plan into (a) a picture to show and (b) the
// drawing's real line geometry, so measurements can snap to the walls the
// architect actually drew instead of to wherever a cursor happened to land.
//
// A plan issued as a PDF is vector: the exact wall coordinates are in the file.
// Rasterising it and measuring by eye throws that away and then asks the user
// to supply the precision back by hand.
// ---------------------------------------------------------------------------

/** Line art, not photographs: a plan is thin dark lines on white, which is
 *  exactly the case JPEG handles worst — ringing smears the very edges you are
 *  trying to click. PNG is lossless here and usually *smaller* for line art. */
const PLAN_MIME = 'image/png';

/** Wide enough that walls stay clean at the 3–4x zoom precise picking needs.
 *  This lands in the project row, so it is a real cost — see the note in
 *  imageFile.ts about data URLs being the interim storage approach. */
export const PLAN_TARGET_WIDTH = 2400;

/** Geometry is stored per plan and rides along in the project row next to a
 *  ~1MB image, so it gets a budget. Over the cap, the *longest* segments are
 *  kept: walls matter, hatching and fill noise do not. */
const MAX_SEGMENTS = 12000;
const MAX_VERTICES = 20000;

/** Below this (in frame-normalised units) a segment is sub-pixel at any sane
 *  render size — hatching, stipple, glyph outlines. Keeping them would bloat
 *  the payload and make snapping grab noise instead of walls. */
const MIN_SEGMENT = 0.0008;

/** Vertices land on a grid this fine before deduping (~0.5px at 2400px), which
 *  collapses the many coincident endpoints a CAD export typically emits. */
const VERTEX_GRID = 0.0002;

/** Segments per curve. Four keeps a door swing recognisable without letting a
 *  plan full of arcs dominate the segment budget. */
const CURVE_SAMPLES = 4;

export interface PdfPlanPage {
  /** 1-based, matching pdf.js. */
  pageNumber: number;
  imageUrl: string;
  geometry: PlanGeometry;
}

type PdfDoc = import('pdfjs-dist').PDFDocumentProxy;

/** Opens a PDF for inspection. The caller decides which page to use, so this
 *  deliberately stops at "how many pages are there". */
export async function loadPdfDocument(file: File): Promise<PdfDoc> {
  const pdfjsLib = await import('pdfjs-dist');
  // Same worker wiring as importDeck.ts — one pattern, not two.
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();
  const arrayBuffer = await file.arrayBuffer();
  return pdfjsLib.getDocument({ data: arrayBuffer }).promise;
}

/** Extracts geometry first, then renders.
 *
 *  The order is not incidental: pdf.js caches a page's operator list and
 *  **replaces the raw path data with a `Path2D` the first time the page is
 *  rendered**. Rendering first leaves nothing to read and yields silently
 *  empty geometry. */
export async function preparePdfPlan(doc: PdfDoc, pageNumber: number, frameAspect: number): Promise<PdfPlanPage> {
  const geometry = await extractPlanGeometry(doc, pageNumber, frameAspect);
  const imageUrl = await renderPlanPage(doc, pageNumber);
  return { pageNumber, imageUrl, geometry };
}

/** Rasterises one page wide enough to zoom into. */
export async function renderPlanPage(doc: PdfDoc, pageNumber: number, targetWidth = PLAN_TARGET_WIDTH): Promise<string> {
  const page = await doc.getPage(pageNumber);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / base.width });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Could not get a canvas context to render the PDF.');
  // PDF pages are transparent where nothing is drawn; a plan wants paper white.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: context, viewport, canvas }).promise;
  return canvas.toDataURL(PLAN_MIME);
}

// --- matrix helpers, PDF's [a,b,c,d,e,f] convention -------------------------

type Matrix = [number, number, number, number, number, number];

function multiply(m: Matrix, n: readonly number[]): Matrix {
  return [
    m[0] * n[0] + m[2] * n[1],
    m[1] * n[0] + m[3] * n[1],
    m[0] * n[2] + m[2] * n[3],
    m[1] * n[2] + m[3] * n[3],
    m[0] * n[4] + m[2] * n[5] + m[4],
    m[1] * n[4] + m[3] * n[5] + m[5],
  ];
}

function applyMatrix(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

/** How a `contain`-fitted image sits inside the 16:9 stage frame.
 *
 *  Baked in here, once, at upload — so stored geometry is already in the same
 *  0–1 frame space as hotspots and calibration, and snapping at runtime needs
 *  no aspect maths at all. */
function containFit(imageAspect: number, frameAspect: number) {
  if (imageAspect > frameAspect) {
    const height = frameAspect / imageAspect;
    return { scaleX: 1, scaleY: height, offsetX: 0, offsetY: (1 - height) / 2 };
  }
  const width = imageAspect / frameAspect;
  return { scaleX: width, scaleY: 1, offsetX: (1 - width) / 2, offsetY: 0 };
}

/** Reads a page's vector paths into frame-normalised points and segments.
 *
 *  Returns empty geometry for a scanned/raster PDF, which has no paths to
 *  read — the caller is expected to say so rather than leave the user
 *  wondering why nothing snaps. */
export async function extractPlanGeometry(doc: PdfDoc, pageNumber: number, frameAspect: number): Promise<PlanGeometry> {
  const pdfjsLib = await import('pdfjs-dist');
  const OPS = pdfjsLib.OPS;

  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const opList = await page.getOperatorList();

  const fit = containFit(viewport.width / viewport.height, frameAspect);
  const toFrame = (px: number, py: number): [number, number] => [
    fit.offsetX + (px / viewport.width) * fit.scaleX,
    fit.offsetY + (py / viewport.height) * fit.scaleY,
  ];

  let ctm = viewport.transform.slice() as Matrix;
  const stack: Matrix[] = [];
  const vertices: [number, number][] = [];
  const segments: [number, number, number, number][] = [];

  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];

    if (fn === OPS.save) {
      stack.push(ctm);
      continue;
    }
    if (fn === OPS.restore) {
      ctm = stack.pop() ?? ctm;
      continue;
    }
    if (fn === OPS.transform) {
      ctm = multiply(ctm, args as number[]);
      continue;
    }
    if (fn !== OPS.constructPath) continue;

    // args is [paintOp, data, minMax]; data[0] holds the path. It is a
    // **Float32Array**, so Array.isArray() is false for it — a check that
    // silently finds no geometry at all.
    const raw = (args as [number, unknown[], unknown])[1]?.[0];
    if (!ArrayBuffer.isView(raw) && !Array.isArray(raw)) continue;
    const d = raw as ArrayLike<number>;

    // Flat draw-ops buffer: 0 moveTo(x,y) · 1 lineTo(x,y) · 2 cubic(6 args)
    // · 3 quadratic(4 args) · 4 closePath. (pdf.js makePathFromDrawOPS.)
    let cx = 0;
    let cy = 0;
    let startX = 0;
    let startY = 0;
    let j = 0;
    // The cursor is tracked twice on purpose: in frame space for emitting
    // geometry, and in PDF space because curve sampling needs the start point
    // in the same space as its own control points.
    let pdfCursor: [number, number] = [0, 0];
    const toVertex = (x: number, y: number): [number, number] => {
      const p = toFrame(...applyMatrix(ctm, x, y));
      vertices.push(p);
      pdfCursor = [x, y];
      return p;
    };

    while (j < d.length) {
      const op = d[j++];
      if (op === 0) {
        const [nx, ny] = toVertex(d[j++], d[j++]);
        cx = startX = nx;
        cy = startY = ny;
      } else if (op === 1) {
        const [nx, ny] = toVertex(d[j++], d[j++]);
        segments.push([cx, cy, nx, ny]);
        cx = nx;
        cy = ny;
      } else if (op === 2 || op === 3) {
        // Curves (doors, curved walls) get flattened into a few segments so
        // they stay snappable instead of collapsing to a chord. The curve is
        // sampled in PDF space against its own control points, then each
        // sample is transformed — sampling after transforming would need the
        // control points mapped anyway, and this keeps the maths textbook.
        const cubic = op === 2;
        const [c1x, c1y] = [d[j++], d[j++]];
        const [c2x, c2y] = cubic ? [d[j++], d[j++]] : [c1x, c1y];
        const [ex, ey] = [d[j++], d[j++]];
        // Start point in PDF space, recovered by inverting nothing: track it
        // alongside the transformed cursor.
        const [sxPdf, syPdf] = pdfCursor;
        for (let t = 1; t <= CURVE_SAMPLES; t++) {
          const u = t / CURVE_SAMPLES;
          const v = 1 - u;
          const px = cubic
            ? v * v * v * sxPdf + 3 * v * v * u * c1x + 3 * v * u * u * c2x + u * u * u * ex
            : v * v * sxPdf + 2 * v * u * c1x + u * u * ex;
          const py = cubic
            ? v * v * v * syPdf + 3 * v * v * u * c1y + 3 * v * u * u * c2y + u * u * u * ey
            : v * v * syPdf + 2 * v * u * c1y + u * u * ey;
          const [nx, ny] = toFrame(...applyMatrix(ctm, px, py));
          segments.push([cx, cy, nx, ny]);
          cx = nx;
          cy = ny;
        }
        // Only the curve's endpoint is a real corner; interior samples are
        // approximation points and would pollute vertex snapping.
        vertices.push([cx, cy]);
        pdfCursor = [ex, ey];
      } else if (op === 4) {
        if (cx !== startX || cy !== startY) segments.push([cx, cy, startX, startY]);
        cx = startX;
        cy = startY;
      } else {
        // Unknown op: the buffer is position-dependent, so we cannot resync.
        break;
      }
    }
  }

  return decimate(vertices, segments);
}

/** Trims the payload to something that can live in a project row without
 *  hurting what snapping is actually for. */
function decimate(
  vertices: [number, number][],
  segments: [number, number, number, number][],
): PlanGeometry {
  const kept = segments.filter(([x1, y1, x2, y2]) => Math.hypot(x2 - x1, y2 - y1) >= MIN_SEGMENT);
  kept.sort((a, b) => Math.hypot(b[2] - b[0], b[3] - b[1]) - Math.hypot(a[2] - a[0], a[3] - a[1]));
  const truncated = kept.length > MAX_SEGMENTS || vertices.length > MAX_VERTICES;
  const finalSegments = kept.slice(0, MAX_SEGMENTS);

  const seen = new Set<string>();
  const flatVertices: number[] = [];
  for (const [x, y] of vertices) {
    if (x < -0.02 || x > 1.02 || y < -0.02 || y > 1.02) continue; // off-page
    const key = `${Math.round(x / VERTEX_GRID)},${Math.round(y / VERTEX_GRID)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    flatVertices.push(round(x), round(y));
    if (flatVertices.length >= MAX_VERTICES * 2) break;
  }

  const flatSegments: number[] = [];
  for (const [x1, y1, x2, y2] of finalSegments) {
    flatSegments.push(round(x1), round(y1), round(x2), round(y2));
  }

  return { vertices: flatVertices, segments: flatSegments, truncated: truncated || undefined };
}

function round(n: number): number {
  return Math.round(n * 10000) / 10000;
}
