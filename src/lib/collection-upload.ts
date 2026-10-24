import { requestCollectionUploads } from "@/app/photos/actions";
import { PHOTO_TYPES, type CollectionPhotoInput } from "@/lib/validation";

/** Longest side of the preview shown while browsing, in px. */
const PREVIEW_EDGE = 1200;
const PREVIEW_QUALITY = 0.85;
/** Quality for photos the browser has to convert (e.g. HEIC from a Mac) to keep them. */
const CONVERTED_QUALITY = 0.95;
/** Phones refuse canvases much larger than this (in pixels), so conversions stay under it. */
const MAX_CANVAS_PIXELS = 16_000_000;
/** Files uploaded at once. */
const UPLOAD_CONCURRENCY = 4;

type Prepared = { original: Blob; preview: Blob; width: number; height: number };

/** Decodes an image file, upright (the browser applies its rotation). */
async function decode(file: File) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    throw new Error(`“${file.name}” couldn't be read. Try a JPEG or PNG.`);
  } finally {
    URL.revokeObjectURL(url);
  }
  return image;
}

function encode(image: HTMLImageElement, scale: number, quality: number): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("A photo couldn't be prepared."))),
      "image/jpeg",
      quality,
    ),
  );
}

/**
 * The original is kept exactly as chosen when it's a JPEG, PNG or WebP; other formats the
 * browser can open (HEIC on a Mac, say) are converted to a high-quality JPEG.
 */
async function prepare(file: File): Promise<Prepared> {
  const image = await decode(file);
  const width = image.naturalWidth;
  const height = image.naturalHeight;
  const original =
    file.type in PHOTO_TYPES
      ? file
      : await encode(image, Math.min(1, Math.sqrt(MAX_CANVAS_PIXELS / (width * height))), CONVERTED_QUALITY);
  const preview = await encode(image, Math.min(1, PREVIEW_EDGE / Math.max(width, height)), PREVIEW_QUALITY);
  return { original, preview, width, height };
}

async function inPool<T>(items: T[], limit: number, run: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await run(items[next++]);
    }),
  );
}

/**
 * Prepares and uploads photos, reporting how many are done; returns what to save with the
 * collection. Throws an Error with a message to show if anything fails.
 */
export async function uploadCollectionPhotos(
  files: File[],
  onProgress: (done: number, total: number) => void,
): Promise<CollectionPhotoInput[]> {
  const total = files.length;
  onProgress(0, total);

  const prepared: Prepared[] = [];
  for (const file of files) prepared.push(await prepare(file));

  const blobs = prepared.flatMap((photo) => [photo.original, photo.preview]);
  const slots = await requestCollectionUploads({
    files: blobs.map((blob) => ({ contentType: blob.type, size: blob.size })),
  });
  if (!slots.ok) throw new Error(slots.error);

  let done = 0;
  await inPool(prepared.map((_, i) => i), UPLOAD_CONCURRENCY, async (i) => {
    for (const j of [i * 2, i * 2 + 1]) {
      const response = await fetch(slots.uploads[j].uploadUrl, {
        method: "PUT",
        body: blobs[j],
        headers: { "Content-Type": blobs[j].type },
      }).catch(() => null);
      if (!response?.ok) throw new Error("Some photos didn't upload. Check your connection and try again.");
    }
    onProgress(++done, total);
  });

  return prepared.map((photo, i) => ({
    originalKey: slots.uploads[i * 2].key,
    previewKey: slots.uploads[i * 2 + 1].key,
    width: photo.width,
    height: photo.height,
  }));
}
