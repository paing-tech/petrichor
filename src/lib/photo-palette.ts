import { rgbToHex, type Rgb } from "@/lib/card-color";

const SAMPLE_SIZE = 64;
/** Colors closer than this (RGB distance) count as the same swatch. */
const MIN_DISTANCE = 60;

const distance = (a: Rgb, b: Rgb) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/**
 * Extracts up to `count` dominant, visually distinct colors from an image file.
 * Runs in the browser on a 64 × 64 downscale, so it takes a few milliseconds.
 */
export async function extractPalette(file: File, count = 4): Promise<string[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return [];
  ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
  bitmap.close();
  const { data } = ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE);

  // Bucket pixels by their top 4 bits per channel, keeping running sums so each
  // bucket's color is the true average of its pixels rather than the bucket corner.
  const buckets = new Map<number, { count: number; r: number; g: number; b: number }>();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { count: 0, r: 0, g: 0, b: 0 };
    bucket.count++;
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    buckets.set(key, bucket);
  }

  // White and black are already presets, so skip colors that are nearly either.
  const excluded: Rgb[] = [
    [255, 255, 255],
    [0, 0, 0],
  ];
  const palette: Rgb[] = [];
  for (const bucket of [...buckets.values()].sort((a, b) => b.count - a.count)) {
    const color: Rgb = [bucket.r / bucket.count, bucket.g / bucket.count, bucket.b / bucket.count];
    if ([...excluded, ...palette].some((c) => distance(c, color) < MIN_DISTANCE)) continue;
    palette.push(color);
    if (palette.length === count) break;
  }
  return palette.map(rgbToHex);
}
