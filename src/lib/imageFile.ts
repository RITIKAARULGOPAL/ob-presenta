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
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not get a canvas context to resize the image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return canvas.toDataURL('image/png');
}
