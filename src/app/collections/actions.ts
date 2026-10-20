"use server";

import { getAccount } from "@/lib/auth/account";
import {
  appendCollectionPhotos,
  getOwnedCollectionSize,
  insertCollection,
} from "@/lib/collections";
import { createPhotoUploadUrl, verifyUploadedPhoto } from "@/lib/storage";
import {
  addCollectionPhotosSchema,
  collectionUploadRequestSchema,
  createCollectionSchema,
  MAX_COLLECTION_PHOTOS,
  MAX_ORIGINAL_BYTES,
  type CollectionPhotoInput,
} from "@/lib/validation";

type ActionResult<T> = ({ ok: true } & T) | { ok: false; error: string };

/** Uploads are checked this many at a time. */
const VERIFY_BATCH = 10;

async function requireOwner() {
  const account = await getAccount();
  return account?.profile ? account.user.id : null;
}

/** Presigned upload URLs for a batch of files (each photo's original and its preview). */
export async function requestCollectionUploads(input: {
  files: { contentType: string; size: number }[];
}): Promise<ActionResult<{ uploads: { key: string; uploadUrl: string }[] }>> {
  if (!(await requireOwner())) return { ok: false, error: "Sign in to add photos." };
  const parsed = collectionUploadRequestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    const uploads = await Promise.all(
      parsed.data.files.map((file) => createPhotoUploadUrl(file.contentType, file.size, "collections")),
    );
    return { ok: true, uploads };
  } catch (error) {
    console.error("Failed to presign collection uploads", error);
    return { ok: false, error: "Photo uploads are unavailable right now. Please try again." };
  }
}

/** Confirms every uploaded file exists and really is the image its name says. */
async function verifyPhotos(photos: CollectionPhotoInput[]) {
  const keys = photos.flatMap((photo) => [photo.originalKey, photo.previewKey]);
  if (new Set(keys).size !== keys.length) return false;
  for (let i = 0; i < keys.length; i += VERIFY_BATCH) {
    const results = await Promise.all(
      keys.slice(i, i + VERIFY_BATCH).map((key) => verifyUploadedPhoto(key, MAX_ORIGINAL_BYTES)),
    );
    if (results.includes(false)) return false;
  }
  return true;
}

export async function createCollection(input: {
  title: string;
  photos: CollectionPhotoInput[];
}): Promise<ActionResult<{ collectionId: string }>> {
  const ownerUserId = await requireOwner();
  if (!ownerUserId) return { ok: false, error: "Sign in to create a collection." };
  const parsed = createCollectionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };

  try {
    if (!(await verifyPhotos(parsed.data.photos))) {
      return { ok: false, error: "Some photos didn't upload correctly. Please choose them again." };
    }
    const collectionId = await insertCollection(ownerUserId, parsed.data.title, parsed.data.photos);
    return { ok: true, collectionId };
  } catch (error) {
    console.error("Failed to create collection", error);
    return { ok: false, error: "We couldn't save your collection. Please try again." };
  }
}

export async function addCollectionPhotos(input: {
  collectionId: string;
  photos: CollectionPhotoInput[];
}): Promise<ActionResult<{ added: number }>> {
  const ownerUserId = await requireOwner();
  if (!ownerUserId) return { ok: false, error: "Sign in to add photos." };
  const parsed = addCollectionPhotosSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const { collectionId, photos } = parsed.data;

  try {
    const size = await getOwnedCollectionSize(collectionId, ownerUserId);
    if (!size) return { ok: false, error: "This collection couldn't be found." };
    if (size.photoCount + photos.length > MAX_COLLECTION_PHOTOS) {
      const room = MAX_COLLECTION_PHOTOS - size.photoCount;
      return {
        ok: false,
        error:
          room > 0
            ? `This collection has room for ${room} more photo${room === 1 ? "" : "s"}.`
            : `This collection is full (${MAX_COLLECTION_PHOTOS} photos).`,
      };
    }
    if (!(await verifyPhotos(photos))) {
      return { ok: false, error: "Some photos didn't upload correctly. Please choose them again." };
    }
    await appendCollectionPhotos(collectionId, size.nextPosition, photos);
    return { ok: true, added: photos.length };
  } catch (error) {
    console.error("Failed to add collection photos", error);
    return { ok: false, error: "We couldn't save these photos. Please try again." };
  }
}
