import "server-only";
import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, inArray, max, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { collectionPhotos, collections } from "@/db/schema";
import { getPhotoPublicUrl } from "@/lib/storage";
import type { CollectionPhotoInput } from "@/lib/validation";

export type CollectionPhoto = {
  id: string;
  previewUrl: string;
  originalUrl: string;
  width: number;
  height: number;
};

export type CollectionSummary = {
  id: string;
  title: string;
  photoCount: number;
  /** The first photo, shown as the collection's cover. */
  cover: Omit<CollectionPhoto, "originalUrl"> | null;
};

export type CollectionDetail = {
  id: string;
  title: string;
  photos: CollectionPhoto[];
};

/** An account's collections, newest first, each with its cover and photo count. */
export async function listCollections(ownerUserId: string): Promise<CollectionSummary[]> {
  const db = getDb();
  const rows = await db
    .select({ id: collections.id, title: collections.title })
    .from(collections)
    .where(eq(collections.ownerUserId, ownerUserId))
    .orderBy(desc(collections.createdAt));
  if (rows.length === 0) return [];

  const ids = rows.map((row) => row.id);
  const [covers, counts] = await Promise.all([
    db
      .selectDistinctOn([collectionPhotos.collectionId], {
        collectionId: collectionPhotos.collectionId,
        id: collectionPhotos.id,
        previewKey: collectionPhotos.previewKey,
        width: collectionPhotos.width,
        height: collectionPhotos.height,
      })
      .from(collectionPhotos)
      .where(inArray(collectionPhotos.collectionId, ids))
      .orderBy(collectionPhotos.collectionId, asc(collectionPhotos.position)),
    db
      .select({ collectionId: collectionPhotos.collectionId, photoCount: count() })
      .from(collectionPhotos)
      .where(inArray(collectionPhotos.collectionId, ids))
      .groupBy(collectionPhotos.collectionId),
  ]);
  const coverById = new Map(covers.map((cover) => [cover.collectionId, cover]));
  const countById = new Map(counts.map((row) => [row.collectionId, row.photoCount]));

  return rows.map(({ id, title }) => {
    const cover = coverById.get(id);
    return {
      id,
      title,
      photoCount: countById.get(id) ?? 0,
      cover: cover
        ? {
            id: cover.id,
            previewUrl: getPhotoPublicUrl(cover.previewKey),
            width: cover.width,
            height: cover.height,
          }
        : null,
    };
  });
}

/** One collection with its photos in order, or null if it isn't this account's. */
export async function getCollection(
  collectionId: string,
  ownerUserId: string,
): Promise<CollectionDetail | null> {
  const db = getDb();
  const [collection] = await db
    .select({ id: collections.id, title: collections.title })
    .from(collections)
    .where(and(eq(collections.id, collectionId), eq(collections.ownerUserId, ownerUserId)));
  if (!collection) return null;

  const photos = await db
    .select({
      id: collectionPhotos.id,
      originalKey: collectionPhotos.originalKey,
      previewKey: collectionPhotos.previewKey,
      width: collectionPhotos.width,
      height: collectionPhotos.height,
    })
    .from(collectionPhotos)
    .where(eq(collectionPhotos.collectionId, collectionId))
    .orderBy(asc(collectionPhotos.position));

  return {
    ...collection,
    photos: photos.map(({ id, originalKey, previewKey, width, height }) => ({
      id,
      previewUrl: getPhotoPublicUrl(previewKey),
      originalUrl: getPhotoPublicUrl(originalKey),
      width,
      height,
    })),
  };
}

/** Creates a collection with its first photos; returns its ID. */
export async function insertCollection(
  ownerUserId: string,
  title: string,
  photos: CollectionPhotoInput[],
): Promise<string> {
  const db = getDb();
  const id = randomUUID();
  await db.batch([
    db.insert(collections).values({ id, ownerUserId, title }),
    db.insert(collectionPhotos).values(
      photos.map((photo, position) => ({ ...photo, collectionId: id, position })),
    ),
  ]);
  return id;
}

/** Whether this collection belongs to this account, and how many photos it holds. */
export async function getOwnedCollectionSize(
  collectionId: string,
  ownerUserId: string,
): Promise<{ photoCount: number; nextPosition: number } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      photoCount: count(collectionPhotos.id),
      lastPosition: max(collectionPhotos.position),
    })
    .from(collections)
    .leftJoin(collectionPhotos, eq(collectionPhotos.collectionId, collections.id))
    .where(and(eq(collections.id, collectionId), eq(collections.ownerUserId, ownerUserId)))
    .groupBy(collections.id);
  if (!row) return null;
  return { photoCount: row.photoCount, nextPosition: (row.lastPosition ?? -1) + 1 };
}

/** Adds photos to the end of a collection. */
export async function appendCollectionPhotos(
  collectionId: string,
  firstPosition: number,
  photos: CollectionPhotoInput[],
) {
  const db = getDb();
  await db.batch([
    db.insert(collectionPhotos).values(
      photos.map((photo, i) => ({ ...photo, collectionId, position: firstPosition + i })),
    ),
    db
      .update(collections)
      .set({ updatedAt: sql`now()` })
      .where(eq(collections.id, collectionId)),
  ]);
}
