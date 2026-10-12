import "server-only";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { cards, type Card } from "@/db/schema";
import { generateCardId } from "@/lib/card-id";
import type { CardFields } from "@/lib/validation";

export type PublicCard = Omit<Card, "id">;

/** Cards are immutable once created, so a lookup can be cached indefinitely. */
export async function getCardByCardId(cardId: string): Promise<PublicCard | null> {
  "use cache";
  cacheLife("max");
  cacheTag(`card:${cardId}`);

  const [card] = await getDb()
    .select({
      cardId: cards.cardId,
      songTitle: cards.songTitle,
      artistName: cards.artistName,
      photoUrl: cards.photoUrl,
      appleMusicUrl: cards.appleMusicUrl,
      lyricsExcerpt: cards.lyricsExcerpt,
      message: cards.message,
      senderName: cards.senderName,
      location: cards.location,
      timeZone: cards.timeZone,
      cardColor: cards.cardColor,
      photoAreaColor: cards.photoAreaColor,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .where(eq(cards.cardId, cardId))
    .limit(1);
  return card ?? null;
}

const MAX_ID_ATTEMPTS = 3;

export async function insertCard(
  fields: CardFields & {
    photoUrl: string | null;
    appleMusicUrl: string | null;
    timeZone: string | null;
    cardColor: string;
    photoAreaColor: string | null;
  },
) {
  // A 128-bit collision is practically impossible, but retrying keeps the unique
  // constraint from ever surfacing to a user as a failed save.
  for (let attempt = 1; ; attempt++) {
    const cardId = generateCardId();
    try {
      await getDb().insert(cards).values({ ...fields, cardId });
      return cardId;
    } catch (error) {
      if (attempt >= MAX_ID_ATTEMPTS || !isUniqueViolation(error)) throw error;
    }
  }
}

function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
