import { z } from "zod";

// Shared by the client form and the server actions; keep free of server-only imports.

export const LIMITS = {
  songTitle: 100,
  artistName: 100,
  songUrl: 500,
  lyricsExcerpt: 150,
  message: 220,
  senderName: 40,
} as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoContentType = keyof typeof PHOTO_TYPES;

export const CARD_ID_PATTERN = /^P-[0-9A-HJKMNP-TV-Z]{26}$/;

const SONG_URL_HOSTS = [
  "open.spotify.com",
  "spotify.link",
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtu.be",
];

const requiredText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`);

// Empty inputs become null so the database stores NULL rather than "".
const optionalText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((v) => v || null);

const songUrl = z
  .string()
  .trim()
  .max(LIMITS.songUrl, "Song link is too long")
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && SONG_URL_HOSTS.includes(url.hostname);
    } catch {
      return false;
    }
  }, "Use a Spotify or YouTube link (https://…)")
  .transform((v) => v || null);

export const cardFieldsSchema = z.object({
  songTitle: requiredText("Song title", LIMITS.songTitle),
  artistName: requiredText("Artist name", LIMITS.artistName),
  songUrl,
  lyricsExcerpt: optionalText("Lyrics", LIMITS.lyricsExcerpt),
  message: optionalText("Message", LIMITS.message),
  senderName: optionalText("Your name", LIMITS.senderName),
});

export type CardFieldsInput = z.input<typeof cardFieldsSchema>;
export type CardFields = z.output<typeof cardFieldsSchema>;
export type CardFieldErrors = Partial<Record<keyof CardFieldsInput, string>>;

export const PHOTO_KEY_PATTERN =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

export const createCardSchema = cardFieldsSchema.extend({
  photoKey: z
    .string()
    .regex(PHOTO_KEY_PATTERN, "Invalid photo reference")
    .nullable(),
});

export type CreateCardInput = z.input<typeof createCardSchema>;

export const photoUploadRequestSchema = z.object({
  contentType: z.enum(Object.keys(PHOTO_TYPES) as [PhotoContentType, ...PhotoContentType[]], {
    error: "Photo must be a JPEG, PNG, or WebP image",
  }),
  size: z
    .number()
    .int()
    .positive("Photo is empty")
    .max(MAX_PHOTO_BYTES, "Photo must be 5 MB or smaller"),
});

export function validatePhotoFile(file: File): string | null {
  const result = photoUploadRequestSchema.safeParse({
    contentType: file.type,
    size: file.size,
  });
  return result.success ? null : result.error.issues[0].message;
}

export function fieldErrors(error: z.ZodError): CardFieldErrors {
  const errors: CardFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof CardFieldsInput;
    errors[key] ??= issue.message;
  }
  return errors;
}
