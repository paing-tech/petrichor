import "server-only";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { cacheLife, cacheTag } from "next/cache";
import { getDb } from "@/db";
import { cardDeliveries, cardOwnerships, cards, type Card } from "@/db/schema";
import { generateCardId } from "@/lib/card-id";
import { generateClaimToken, hashClaimToken } from "@/lib/claim-token";
import type { CardFields } from "@/lib/validation";

// What pages can see: the card's content only. No internal keys, edition link,
// creator, owner or claim data (ownership is read separately, per request).
export type PublicCard = Omit<
  Card,
  "id" | "editionId" | "creatorUserId" | "ownerUserId" | "claimTokenHash" | "lyricsExcerpt"
>;

/** Card content never changes once created, so a lookup can be cached indefinitely. */
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
      message: cards.message,
      senderName: cards.senderName,
      moment: cards.moment,
      timeZone: cards.timeZone,
      cardColor: cards.cardColor,
      photoAreaColor: cards.photoAreaColor,
      youtubeVideoId: cards.youtubeVideoId,
      editionNumber: cards.editionNumber,
      editionSize: cards.editionSize,
      createdAt: cards.createdAt,
    })
    .from(cards)
    .where(eq(cards.cardId, cardId))
    .limit(1);
  return card ?? null;
}

/** How one copy of an edition starts out. */
export type CopyPlan =
  /** Owned by the signed-in creator straight away ("for myself"). */
  | { kind: "owned"; ownerUserId: string }
  /** Sent to an account; owned once the recipient accepts. */
  | { kind: "delivered"; recipientUserId: string }
  /** Unowned until someone opens its claim link and keeps it. */
  | { kind: "claimable" };

export type CreatedCopy = {
  cardId: string;
  editionNumber: number;
  /** Only for claimable copies: the secret for the claim link. Never stored. */
  claimToken: string | null;
};

const MAX_ID_ATTEMPTS = 3;

/**
 * Creates an edition: one card per copy plan, numbered 1…N, each with its own card
 * ID, plus its ownership record or delivery. Runs as one database transaction, so
 * either the whole edition is saved or nothing is.
 */
export async function insertEdition(
  fields: CardFields & {
    photoUrl: string | null;
    appleMusicUrl: string | null;
    timeZone: string | null;
    cardColor: string;
    photoAreaColor: string | null;
    youtubeVideoId: string | null;
  },
  { creatorUserId, copies }: { creatorUserId: string | null; copies: CopyPlan[] },
): Promise<CreatedCopy[]> {
  const editionId = randomUUID();
  const editionSize = copies.length;

  // A collision of 128-bit card IDs (or 256-bit claim codes) is practically
  // impossible, but retrying keeps a unique constraint from ever failing a save.
  for (let attempt = 1; ; attempt++) {
    const planned = copies.map((plan, i) => {
      const claimToken = plan.kind === "claimable" ? generateClaimToken() : null;
      return {
        plan,
        claimToken,
        row: {
          ...fields,
          id: randomUUID(),
          cardId: generateCardId(),
          editionId,
          editionNumber: i + 1,
          editionSize,
          creatorUserId,
          ownerUserId: plan.kind === "owned" ? plan.ownerUserId : null,
          claimTokenHash: claimToken ? hashClaimToken(claimToken) : null,
        },
      };
    });

    const ownerships = planned.flatMap(({ plan, row }) =>
      plan.kind === "owned" ? [{ cardId: row.id, userId: plan.ownerUserId, acquiredVia: "created" }] : [],
    );
    const deliveries = planned.flatMap(({ plan, row }) =>
      plan.kind === "delivered"
        ? [{ cardId: row.id, senderUserId: creatorUserId, recipientUserId: plan.recipientUserId }]
        : [],
    );

    const db = getDb();
    try {
      await db.batch([
        db.insert(cards).values(planned.map((p) => p.row)),
        ...(ownerships.length ? [db.insert(cardOwnerships).values(ownerships)] : []),
        ...(deliveries.length ? [db.insert(cardDeliveries).values(deliveries)] : []),
      ]);
      return planned.map(({ row, claimToken }) => ({
        cardId: row.cardId,
        editionNumber: row.editionNumber,
        claimToken,
      }));
    } catch (error) {
      if (attempt >= MAX_ID_ATTEMPTS || !isUniqueViolation(error)) throw error;
    }
  }
}

export function isUniqueViolation(error: unknown): boolean {
  for (let e = error; e && typeof e === "object"; e = (e as { cause?: unknown }).cause) {
    if ((e as { code?: unknown }).code === "23505") return true;
  }
  return false;
}
