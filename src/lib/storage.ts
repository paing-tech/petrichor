import "server-only";
import { randomUUID } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { getStorageEnv } from "@/lib/env";
import { MAX_UPLOAD_BYTES, PHOTO_TYPES, type PhotoContentType } from "@/lib/validation";

const UPLOAD_URL_TTL_SECONDS = 5 * 60;

let client: S3Client | undefined;

function getClient() {
  const env = getStorageEnv();
  client ??= new S3Client({
    region: "auto",
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
  return client;
}

/**
 * Presigns a single-object PUT. Content-Type and Content-Length are signed,
 * so the browser must upload exactly the type and size that were validated.
 * Card photos go in "uploads/", collection photos in "collections/".
 */
export async function createPhotoUploadUrl(
  contentType: PhotoContentType,
  size: number,
  folder: "uploads" | "collections" = "uploads",
) {
  const key = `${folder}/${randomUUID()}.${PHOTO_TYPES[contentType]}`;
  const uploadUrl = await getSignedUrl(
    getClient(),
    new PutObjectCommand({
      Bucket: getStorageEnv().R2_BUCKET_NAME,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    }),
    {
      expiresIn: UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(["content-type", "content-length"]),
    },
  );
  return { key, uploadUrl };
}

export function getPhotoPublicUrl(key: string) {
  return `${getStorageEnv().R2_PUBLIC_URL}/${key}`;
}

/**
 * Confirms an uploaded object exists, is within the size limit, and that its
 * bytes really are the image format its extension claims.
 */
export async function verifyUploadedPhoto(key: string, maxBytes = MAX_UPLOAD_BYTES): Promise<boolean> {
  const { R2_BUCKET_NAME } = getStorageEnv();
  let header: Uint8Array;
  let totalSize: number;
  try {
    const object = await getClient().send(
      new GetObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Range: "bytes=0-11" }),
    );
    header = await object.Body!.transformToByteArray();
    // Content-Range looks like "bytes 0-11/123456".
    totalSize = Number(object.ContentRange?.split("/")[1]);
  } catch {
    return false;
  }

  const extension = key.split(".").pop();
  const valid =
    Number.isFinite(totalSize) &&
    totalSize <= maxBytes &&
    matchesSignature(header, extension);

  if (!valid) {
    await getClient()
      .send(new DeleteObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key }))
      .catch(() => {});
  }
  return valid;
}

function matchesSignature(bytes: Uint8Array, extension: string | undefined) {
  const startsWith = (sig: number[], offset = 0) =>
    sig.every((b, i) => bytes[offset + i] === b);
  switch (extension) {
    case "jpg":
      return startsWith([0xff, 0xd8, 0xff]);
    case "png":
      return startsWith([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "webp":
      return startsWith([0x52, 0x49, 0x46, 0x46]) && startsWith([0x57, 0x45, 0x42, 0x50], 8);
    default:
      return false;
  }
}
