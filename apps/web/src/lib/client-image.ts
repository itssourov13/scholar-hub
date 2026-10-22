// Cover image upload size limit.
//
// Vercel's serverless functions reject request bodies over ~4.5MB with a
// 413, so we validate the file size in the browser and ask the admin to
// shrink it themselves rather than silently failing after a save.
export const MAX_COVER_IMAGE_BYTES = 4 * 1024 * 1024;

export function formatFileSize(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Read an image file and return a downscaled, JPEG-compressed data URL.
 *
 * Used for the CV profile photo, which is stored inline in the CV's JSONB
 * `data` (no separate upload/storage). Resizing to a small max dimension keeps
 * the stored string small (~tens of KB) so it comfortably fits the save
 * request and DB row. Runs entirely in the browser.
 *
 * @param file    The user-selected image file.
 * @param maxDim  Longest-edge cap in pixels (default 400 — plenty for a headshot).
 * @param quality JPEG quality 0–1 (default 0.85).
 */
export async function fileToResizedDataUrl(
  file: File,
  maxDim = 400,
  quality = 0.85,
): Promise<string> {
  const rawDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Could not read the selected file."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load the selected image."));
    image.src = rawDataUrl;
  });

  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return rawDataUrl;
  ctx.drawImage(img, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", quality);
}
