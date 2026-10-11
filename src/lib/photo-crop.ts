import type { CSSProperties } from "react";

// The card's photo area is 390 × 293. The editor, the live preview and the
// exported image all use the same crop rectangle, so what the sender frames is
// exactly what gets uploaded.

export const PHOTO_ASPECT = 390 / 293;
export const MIN_ZOOM = 1;
export const MAX_ZOOM = 3;
/** Exported width: 3× the card's 390px photo area, enough for high-density screens. */
const EXPORT_WIDTH = 1170;
const EXPORT_QUALITY = 0.9;

/** What the sender controls: zoom level and the point of the photo at the frame's center (0–1). */
export type PhotoView = { zoom: number; centerX: number; centerY: number };

/** The visible part of the photo, as fractions of its width and height. */
export type PhotoCrop = { x: number; y: number; width: number; height: number };

export const DEFAULT_PHOTO_VIEW: PhotoView = { zoom: 1, centerX: 0.5, centerY: 0.5 };

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function cropFromView(imageWidth: number, imageHeight: number, view: PhotoView): PhotoCrop {
  const imageAspect = imageWidth / imageHeight;
  // At zoom 1 the crop is the largest frame-shaped rectangle that fits the photo ("cover").
  let width = imageAspect > PHOTO_ASPECT ? PHOTO_ASPECT / imageAspect : 1;
  let height = imageAspect > PHOTO_ASPECT ? 1 : imageAspect / PHOTO_ASPECT;
  const zoom = clamp(view.zoom, MIN_ZOOM, MAX_ZOOM);
  width /= zoom;
  height /= zoom;
  return {
    x: clamp(view.centerX - width / 2, 0, 1 - width),
    y: clamp(view.centerY - height / 2, 0, 1 - height),
    width,
    height,
  };
}

/** Re-centers a view on its clamped crop so panning past an edge doesn't build up hidden slack. */
export function normalizeView(imageWidth: number, imageHeight: number, view: PhotoView): PhotoView {
  const crop = cropFromView(imageWidth, imageHeight, view);
  return {
    zoom: clamp(view.zoom, MIN_ZOOM, MAX_ZOOM),
    centerX: crop.x + crop.width / 2,
    centerY: crop.y + crop.height / 2,
  };
}

/** Positions an <img> inside a frame-shaped box so only the crop shows. */
export function cropImageStyle(crop: PhotoCrop): CSSProperties {
  return {
    position: "absolute",
    width: `${100 / crop.width}%`,
    height: `${100 / crop.height}%`,
    left: `${(-crop.x / crop.width) * 100}%`,
    top: `${(-crop.y / crop.height) * 100}%`,
    maxWidth: "none",
  };
}

/**
 * Draws the cropped area to a canvas and encodes it as JPEG. Re-encoding also
 * drops the original file's metadata (EXIF), including any GPS location.
 */
export async function exportCroppedPhoto(src: string, crop: PhotoCrop): Promise<Blob> {
  const image = new Image();
  image.src = src;
  await image.decode();

  const sourceWidth = crop.width * image.naturalWidth;
  const sourceHeight = crop.height * image.naturalHeight;
  const width = Math.round(Math.min(EXPORT_WIDTH, sourceWidth));
  const height = Math.round(width / PHOTO_ASPECT);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  // JPEG has no transparency; fill so transparent PNGs don't turn black.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    image,
    crop.x * image.naturalWidth,
    crop.y * image.naturalHeight,
    sourceWidth,
    sourceHeight,
    0,
    0,
    width,
    height,
  );

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not encode photo"))), "image/jpeg", EXPORT_QUALITY),
  );
}

/** Loads an image URL and returns its displayed (EXIF-oriented) size. */
export async function readImageSize(src: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = src;
  await image.decode();
  return { width: image.naturalWidth, height: image.naturalHeight };
}
