import "server-only";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getDb } from "@/db";
import { cardDeliveries, cards, profiles } from "@/db/schema";
import { generateClaimToken, hashClaimToken } from "@/lib/claim-token";
import type { PublicProfile } from "@/lib/profiles";

const cardContent = {
  cardId: cards.cardId,
  songTitle: cards.songTitle,
  artistName: cards.artistName,
  photoUrl: cards.photoUrl,
  message: cards.message,
  senderName: cards.senderName,
  moment: cards.moment,
  timeZone: cards.timeZone,
  cardColor: cards.cardColor,
  photoAreaColor: cards.photoAreaColor,
  editionNumber: cards.editionNumber,
  editionSize: cards.editionSize,
  createdAt: cards.createdAt,
};

const ownerProfiles = alias(profiles, "owner_profile");

export type CardOwnership = {
  owner: PublicProfile | null;
  /** Whether the card can still be kept with a claim link. */
  claimable: boolean;
  /** The account a pending delivery is waiting on, if any. */
  pendingDelivery: { id: string; recipientUserId: string } | null;
};

/** Current ownership of a card. Read per request, never cached with the card. */
export async function getCardOwnership(cardId: string): Promise<CardOwnership | null> {
  const db = getDb();
  const [row] = await db
    .select({
      internalId: cards.id,
      claimTokenHash: cards.claimTokenHash,
      owner: {
        userId: ownerProfiles.userId,
        username: ownerProfiles.username,
        displayName: ownerProfiles.displayName,
        avatarUrl: ownerProfiles.avatarUrl,
      },
    })
    .from(cards)
    .leftJoin(ownerProfiles, eq(ownerProfiles.userId, cards.ownerUserId))
    .where(eq(cards.cardId, cardId))
    .limit(1);
  if (!row) return null;

  const [pending] = await db
    .select({ id: cardDeliveries.id, recipientUserId: cardDeliveries.recipientUserId })
    .from(cardDeliveries)
    .where(and(eq(cardDeliveries.cardId, row.internalId), eq(cardDeliveries.status, "pending")))
    .limit(1);

  return {
    owner: row.owner?.userId ? row.owner : null,
    claimable: row.claimTokenHash !== null,
    pendingDelivery: pending ?? null,
  };
}

/** Whether a claim code is the current one for this unowned card. */
export async function isValidClaimToken(cardId: string, token: string) {
  const [row] = await getDb()
    .select({ cardId: cards.cardId })
    .from(cards)
    .where(and(eq(cards.cardId, cardId), eq(cards.claimTokenHash, hashClaimToken(token)), isNull(cards.ownerUserId)))
    .limit(1);
  return Boolean(row);
}

/**
 * Keeps an unowned card for `userId`. One statement: the card is only taken if the
 * code still matches and nobody owns it, so two people can't both claim it.
 */
export async function claimCard(cardId: string, token: string, userId: string): Promise<boolean> {
  const result = await getDb().execute(sql`
    with claimed as (
      update cards
      set owner_user_id = ${userId}, claim_token_hash = null
      where card_id = ${cardId} and claim_token_hash = ${hashClaimToken(token)} and owner_user_id is null
      returning id
    )
    insert into card_ownerships (card_id, user_id, acquired_via)
    select id, ${userId}, 'claimed' from claimed
    returning card_id
  `);
  return result.rows.length > 0;
}

/** The recipient accepts a delivery: the card becomes theirs, atomically. */
export async function acceptDelivery(deliveryId: string, userId: string): Promise<boolean> {
  const result = await getDb().execute(sql`
    with accepted as (
      update card_deliveries
      set status = 'accepted', responded_at = now()
      where id = ${deliveryId} and recipient_user_id = ${userId} and status = 'pending'
      returning card_id
    ), owned as (
      update cards
      set owner_user_id = ${userId}, claim_token_hash = null
      where id in (select card_id from accepted) and owner_user_id is null
      returning id
    )
    insert into card_ownerships (card_id, user_id, acquired_via)
    select id, ${userId}, 'accepted' from owned
    returning card_id
  `);
  return result.rows.length > 0;
}

/** The recipient declines; the copy goes back to its creator, who can issue a claim link. */
export async function declineDelivery(deliveryId: string, userId: string): Promise<boolean> {
  const rows = await getDb()
    .update(cardDeliveries)
    .set({ status: "declined", respondedAt: new Date() })
    .where(
      and(
        eq(cardDeliveries.id, deliveryId),
        eq(cardDeliveries.recipientUserId, userId),
        eq(cardDeliveries.status, "pending"),
      ),
    )
    .returning({ id: cardDeliveries.id });
  return rows.length > 0;
}

/**
 * Issues a fresh claim link for an unowned copy the user created that isn't waiting
 * on a recipient (e.g. after a decline, or a lost link). The old link stops working.
 */
export async function reissueClaimLink(cardId: string, userId: string): Promise<string | null> {
  const token = generateClaimToken();
  const result = await getDb().execute(sql`
    update cards
    set claim_token_hash = ${hashClaimToken(token)}
    where card_id = ${cardId}
      and creator_user_id = ${userId}
      and owner_user_id is null
      and not exists (
        select 1 from card_deliveries d where d.card_id = cards.id and d.status = 'pending'
      )
    returning card_id
  `);
  return result.rows.length > 0 ? token : null;
}

/** Cards the user owns, most recently acquired first. */
export async function listCollection(userId: string) {
  return getDb()
    .select(cardContent)
    .from(cards)
    .where(eq(cards.ownerUserId, userId))
    .orderBy(desc(sql`(select max(o.acquired_at) from card_ownerships o where o.card_id = ${cards.id} and o.user_id = ${userId})`));
}

/** The user's collection for the Music Library: newest first, with the song's Apple Music link for matching. */
export async function listLibrary(userId: string) {
  return getDb()
    .select({ ...cardContent, appleMusicUrl: cards.appleMusicUrl, youtubeVideoId: cards.youtubeVideoId })
    .from(cards)
    .where(eq(cards.ownerUserId, userId))
    .orderBy(desc(sql`(select max(o.acquired_at) from card_ownerships o where o.card_id = ${cards.id} and o.user_id = ${userId})`));
}

const senderProfiles = alias(profiles, "sender_profile");

/** Cards sent to the user that are waiting for them to accept or decline. */
export async function listPendingDeliveries(userId: string) {
  return getDb()
    .select({
      deliveryId: cardDeliveries.id,
      sentAt: cardDeliveries.createdAt,
      // Shown only to the recipient, so they know who it's from before accepting.
      sender: { username: senderProfiles.username, displayName: senderProfiles.displayName },
      card: cardContent,
    })
    .from(cardDeliveries)
    .innerJoin(cards, eq(cards.id, cardDeliveries.cardId))
    .leftJoin(senderProfiles, eq(senderProfiles.userId, cardDeliveries.senderUserId))
    .where(and(eq(cardDeliveries.recipientUserId, userId), eq(cardDeliveries.status, "pending")))
    .orderBy(desc(cardDeliveries.createdAt));
}

const recipientProfiles = alias(profiles, "recipient_profile");

export type CreatedCardStatus =
  | { kind: "owned_by_you" }
  | { kind: "owned"; owner: { username: string; displayName: string } }
  | { kind: "pending"; recipient: { username: string; displayName: string } }
  | { kind: "unclaimed" };

/** Cards the user created, newest first, with where each copy stands. Private to the creator. */
export async function listCreated(userId: string) {
  const rows = await getDb()
    .select({
      card: cardContent,
      ownerUserId: cards.ownerUserId,
      owner: { username: ownerProfiles.username, displayName: ownerProfiles.displayName },
      recipient: { username: recipientProfiles.username, displayName: recipientProfiles.displayName },
    })
    .from(cards)
    .leftJoin(ownerProfiles, eq(ownerProfiles.userId, cards.ownerUserId))
    .leftJoin(
      cardDeliveries,
      and(eq(cardDeliveries.cardId, cards.id), eq(cardDeliveries.status, "pending")),
    )
    .leftJoin(recipientProfiles, eq(recipientProfiles.userId, cardDeliveries.recipientUserId))
    .where(eq(cards.creatorUserId, userId))
    .orderBy(desc(cards.createdAt), cards.editionNumber);

  return rows.map(({ card, ownerUserId, owner, recipient }) => {
    let status: CreatedCardStatus;
    if (ownerUserId === userId) status = { kind: "owned_by_you" };
    else if (ownerUserId && owner?.username) status = { kind: "owned", owner };
    else if (recipient?.username) status = { kind: "pending", recipient };
    else status = { kind: "unclaimed" };
    return { card, status };
  });
}
