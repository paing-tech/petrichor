import { z } from "zod";

// Shared by the client form and the server actions; keep free of server-only imports.

// Message and lyrics limits are sized so the text fits the card without truncation.
export const LIMITS = {
  // Catalog titles like "Song (feat. …) [Remastered 2009]" can run long.
  songTitle: 200,
  artistName: 200,
  lyricsExcerpt: 100,
  message: 120,
  senderName: 40,
  location: 40,
} as const;

export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

export const PHOTO_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

export type PhotoContentType = keyof typeof PHOTO_TYPES;

export const CARD_ID_PATTERN = /^P-[0-9A-HJKMNP-TV-Z]{26}$/;

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

export const cardFieldsSchema = z.object({
  songTitle: requiredText("Song title", LIMITS.songTitle),
  artistName: requiredText("Artist name", LIMITS.artistName),
  lyricsExcerpt: optionalText("Lyrics", LIMITS.lyricsExcerpt),
  message: optionalText("Message", LIMITS.message),
  senderName: optionalText("Your name", LIMITS.senderName),
  location: optionalText("Location", LIMITS.location),
});

export type CardFieldsInput = z.input<typeof cardFieldsSchema>;
export type CardFields = z.output<typeof cardFieldsSchema>;
export type CardFieldErrors = Partial<Record<keyof CardFieldsInput, string>>;

export const PHOTO_KEY_PATTERN =
  /^uploads\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

// The song picked from search. Only IDs are accepted; the server builds the
// Apple Music URL itself so a client can't smuggle in an arbitrary link.
const appleMusicTrackSchema = z.object({
  storefront: z.string().regex(/^[a-z]{2}$/),
  collectionId: z.string().regex(/^\d{1,15}$/),
  trackId: z.string().regex(/^\d{1,15}$/),
});

function isValidTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

export const createCardSchema = cardFieldsSchema.extend({
  photoKey: z
    .string()
    .regex(PHOTO_KEY_PATTERN, "Invalid photo reference")
    .nullable(),
  appleMusic: appleMusicTrackSchema.nullable(),
  timeZone: z.string().max(64).refine(isValidTimeZone, "Invalid time zone").nullable(),
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
