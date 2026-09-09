/** Turns a picked image file into a downscaled PNG data URL.
 *
 * Data URLs rather than uploaded files is the interim approach until Supabase
 * Storage is wired in (see the file-storage gap in the tech stack doc). It
 * needs no infrastructure, and it actually helps PDF/PPTX export: the
 * rasterizer never has to fetch a remote image, so there's no CORS to trip on.
 *
 * PNG (not JPEG) because logos need transparency. Downscaling matters — the
 * Officebanao source files were 9126px wide for something rendered at 16px.
 */
export async function fileToDataUrl(file: File, maxWidth = 400): Promise<string> {
  return encodeImage(file, { maxWidth, mime: 'image/png' });
}

/** A picked photo, plan or render, sized for a slide.
 *
 * JPEG, not PNG: a 1400px PNG of a render is several megabytes, and base64 adds
 * another third on top — every deck load pulls the whole slides blob, so that
 * cost is paid on every open. JPEG at this quality lands around 300–500KB.
 * Photographs don't need the alpha channel that made PNG right for logos.
 *
 * This is still the interim approach — see the file-storage gap in the tech
 * stack doc. A real Supabase Storage bucket is the actual fix; this at least
 * means nobody has to host an image somewhere first.
 */
export async function fileToSlideImage(file: File): Promise<string> {
  return encodeImage(file, { maxWidth: 1400, mime: 'image/jpeg', quality: 0.82 });
}

async function encodeImage(
  file: File,
  { maxWidth, mime, quality }: { maxWidth: number; mime: string; quality?: number },
): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a canvas context to resize the image.');
  // JPEG has no alpha, so transparency would composite to black without this.
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL(mime, quality);
}

/** Rough byte size of a data URL, for telling the user what a picture costs. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  return Math.round((dataUrl.length - comma - 1) * 0.75);
}
