import { z } from "zod";
import { CARD_COLOR_PATTERN } from "@/lib/card-color";

// Shared by the client form and the server actions; keep free of server-only imports.

// Message and lyrics limits are sized so the text fits the card without truncation.
export const LIMITS = {
  // Catalog titles like "Song (feat. …) [Remastered 2009]" can run long.
  songTitle: 200,
  artistName: 200,
  lyricsExcerpt: 100,
  message: 160,
  senderName: 40,
  moment: 40,
} as const;

/** The card shows four lines of message; more line breaks would push text past them. */
export const MESSAGE_MAX_LINES = 4;

/**
 * The most numbered copies one card can be created as. Requests for more go
 * through "Contact us". The database enforces the same limit (cards_edition_size_range
 * in src/db/schema.ts); change both together.
 */
export const MAX_EDITION_SIZE = 20;

// Senders can pick a photo of any size; it's cropped and re-encoded in the
// browser, and only that export is uploaded. This caps the export.
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

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
  message: optionalText("Message", LIMITS.message).refine(
    (v) => v === null || v.split("\n").length <= MESSAGE_MAX_LINES,
    `Message can be up to ${MESSAGE_MAX_LINES} lines`,
  ),
  senderName: optionalText("Your name", LIMITS.senderName),
  moment: optionalText("Moment", LIMITS.moment),
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

const hexColor = (label: string) =>
  z
    .string()
    .transform((v) => v.toLowerCase())
    .pipe(z.string().regex(CARD_COLOR_PATTERN, `${label} must be a hex color like #1a2b3c`));

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
  cardColor: hexColor("Card color"),
  photoAreaColor: hexColor("Photo area color").nullable(),
  editionSize: z
    .number()
    .int("Copies must be a whole number")
    .min(1, "Make at least 1 copy")
    .max(MAX_EDITION_SIZE, `You can make up to ${MAX_EDITION_SIZE} copies`),
  /** "self": the creator keeps it. "others": recipients keep it, by account or claim link. */
  audience: z.enum(["self", "others"]),
  /** Leaves the signature off the card, whatever was typed. */
  anonymous: z.boolean(),
  /** Accounts to send copies to directly, in copy order ("others" only). */
  recipientUserIds: z.array(z.uuid()).max(MAX_EDITION_SIZE),
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
    .max(MAX_UPLOAD_BYTES, "Photo must be 10 MB or smaller"),
});

/**
 * Checks a photo the sender picked. Any size and any format the browser can
 * decode is fine; decoding is the real test, so files with an unknown type
 * (empty `type`) are let through to try.
 */
export function validatePhotoFile(file: File): string | null {
  if (file.size === 0) return "This photo is empty.";
  if (file.type && !file.type.startsWith("image/")) return "Choose an image file.";
  return null;
}

export function fieldErrors(error: z.ZodError): CardFieldErrors {
  const errors: CardFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof CardFieldsInput;
    errors[key] ??= issue.message;
  }
  return errors;
}

// Collections -----------------------------------------------------------------

/** Mirrors the collections_title_length check in src/db/schema.ts; change both together. */
export const COLLECTION_TITLE_MAX = 60;
/** The most photos one collection holds. */
export const MAX_COLLECTION_PHOTOS = 100;
/** Collection photos are kept at their original size and quality, up to this. */
export const MAX_ORIGINAL_BYTES = 40 * 1024 * 1024;

export const COLLECTION_PHOTO_KEY_PATTERN =
  /^collections\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp)$/;

const photoContentType = z.enum(Object.keys(PHOTO_TYPES) as [PhotoContentType, ...PhotoContentType[]], {
  error: "Photo must be a JPEG, PNG, or WebP image",
});

/** Upload slots for a batch of photos: an original and a preview for each. */
export const collectionUploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        contentType: photoContentType,
        size: z
          .number()
          .int()
          .positive("Photo is empty")
          .max(MAX_ORIGINAL_BYTES, "Each photo must be 40 MB or smaller"),
      }),
    )
    .min(1, "Choose at least one photo")
    .max(MAX_COLLECTION_PHOTOS * 2, `You can add up to ${MAX_COLLECTION_PHOTOS} photos`),
});

const collectionPhotoSchema = z.object({
  originalKey: z.string().regex(COLLECTION_PHOTO_KEY_PATTERN, "Invalid photo reference"),
  previewKey: z.string().regex(COLLECTION_PHOTO_KEY_PATTERN, "Invalid photo reference"),
  width: z.number().int().min(1).max(100_000),
  height: z.number().int().min(1).max(100_000),
});

export type CollectionPhotoInput = z.input<typeof collectionPhotoSchema>;

const collectionPhotos = z
  .array(collectionPhotoSchema)
  .min(1, "Choose at least one photo")
  .max(MAX_COLLECTION_PHOTOS, `A collection can hold up to ${MAX_COLLECTION_PHOTOS} photos`);

export const createCollectionSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Give your collection a name")
    .max(COLLECTION_TITLE_MAX, `Name must be ${COLLECTION_TITLE_MAX} characters or fewer`),
  photos: collectionPhotos,
});

/** Mirrors the collection_photos_caption_length check in src/db/schema.ts; change both together. */
export const PHOTO_CAPTION_MAX = 150;

export const photoCaptionSchema = z.object({
  photoId: z.uuid(),
  // Empty means no caption, stored as NULL.
  caption: z
    .string()
    .trim()
    .max(PHOTO_CAPTION_MAX, `Caption must be ${PHOTO_CAPTION_MAX} characters or fewer`)
    .transform((v) => v || null),
});

export const addCollectionPhotosSchema = z.object({
  collectionId: z.uuid(),
  photos: collectionPhotos,
});

// Accounts --------------------------------------------------------------------

export const USERNAME_PATTERN = /^[a-z0-9._]{3,20}$/;

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(USERNAME_PATTERN, "Use 3–20 lowercase letters, numbers, dots or underscores");

export const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter your name")
  .max(50, "Name must be 50 characters or fewer");

export const profileInputSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema,
});

export type ProfileInput = z.input<typeof profileInputSchema>;

