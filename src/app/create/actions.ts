"use server";

import { buildAppleMusicUrl } from "@/lib/apple-music";
import { insertCard } from "@/lib/cards";
import { createPhotoUploadUrl, getPhotoPublicUrl, verifyUploadedPhoto } from "@/lib/storage";
import {
  createCardSchema,
  fieldErrors,
  photoUploadRequestSchema,
  type CardFieldErrors,
  type CreateCardInput,
} from "@/lib/validation";

type ActionFailure = {
  ok: false;
  error: string;
  code?: "photo_invalid";
  fieldErrors?: CardFieldErrors;
};

type ActionResult<T> = ({ ok: true } & T) | ActionFailure;

export async function requestPhotoUpload(input: {
  contentType: string;
  size: number;
}): Promise<ActionResult<{ key: string; uploadUrl: string }>> {
  const parsed = photoUploadRequestSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message };
  }

  try {
    const { key, uploadUrl } = await createPhotoUploadUrl(parsed.data.contentType, parsed.data.size);
    return { ok: true, key, uploadUrl };
  } catch (error) {
    console.error("Failed to presign photo upload", error);
    return { ok: false, error: "Photo uploads are unavailable right now. Please try again." };
  }
}

export async function createCard(input: CreateCardInput): Promise<ActionResult<{ cardId: string }>> {
  const parsed = createCardSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Please fix the highlighted fields.", fieldErrors: fieldErrors(parsed.error) };
  }

  const { photoKey, appleMusic, timeZone, cardColor, ...fields } = parsed.data;

  try {
    if (photoKey && !(await verifyUploadedPhoto(photoKey))) {
      return {
        ok: false,
        code: "photo_invalid",
        error: "The photo upload could not be verified. Please choose the photo again.",
      };
    }

    const cardId = await insertCard({
      ...fields,
      photoUrl: photoKey ? getPhotoPublicUrl(photoKey) : null,
      appleMusicUrl: appleMusic ? buildAppleMusicUrl(appleMusic) : null,
      timeZone,
      cardColor,
    });
    return { ok: true, cardId };
  } catch (error) {
    console.error("Failed to create card", error);
    return { ok: false, error: "We couldn't save your card. Please try again." };
  }
}
