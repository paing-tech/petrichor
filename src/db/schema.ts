import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authUsers } from "./auth-schema";

export const cards = pgTable(
  "cards",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: text("card_id").notNull().unique(),
    songTitle: text("song_title").notNull(),
    artistName: text("artist_name").notNull(),
    photoUrl: text("photo_url"),
    appleMusicUrl: text("apple_music_url"),
    // No longer collected or shown (lyrics are the publishers' to license); kept for old cards.
    lyricsExcerpt: text("lyrics_excerpt"),
    message: text("message"),
    // The signature printed on the card, exactly as typed. NULL when the sender left
    // it blank or chose to send anonymously. Never used as a creator credit.
    senderName: text("sender_name"),
    // A short note about the occasion: "Birthday party", "Graduation", "Singapore".
    moment: text("moment"),
    // The sender's IANA time zone, so the printed date matches their calendar day.
    timeZone: text("time_zone"),
    cardColor: text("card_color").notNull().default("#ffffff"),
    // Fill for the photo area on cards without a photo; NULL means the default earth gradient.
    photoAreaColor: text("photo_area_color"),
    // A YouTube video the creator chose for this card when the song couldn't be found on
    // YouTube (song_matches is shared by every card with the song; this is only this card's).
    youtubeVideoId: text("youtube_video_id"),
    // The part of the song the creator chose to play (seconds), and the YouTube video it was
    // chosen on: times differ between videos, so it only applies while the card plays that one.
    // All three are set together or not at all (see cards_clip_check).
    clipVideoId: text("clip_video_id"),
    clipStart: integer("clip_start"),
    clipEnd: integer("clip_end"),
    // Numbered editions: identical cards created together, each with its own card ID,
    // printed as "edition_number of edition_size". edition_id links the set.
    // The size range check below mirrors MAX_EDITION_SIZE in src/lib/validation.ts
    // (20); keep the two in sync. Raise both if larger editions are offered.
    editionId: uuid("edition_id").notNull().defaultRandom(),
    editionNumber: integer("edition_number").notNull().default(1),
    editionSize: integer("edition_size").notNull().default(1),
    // The account that made the card; NULL if made while signed out. Never shown
    // publicly (reserved for approved template creators later).
    creatorUserId: uuid("creator_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    // The current owner; NULL until the card is kept (claimed or accepted).
    ownerUserId: uuid("owner_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    // SHA-256 of the private claim code for an unowned card. The code itself is
    // only ever in the claim link; cleared once the card is claimed.
    claimTokenHash: text("claim_token_hash").unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("cards_edition_number_unique").on(table.editionId, table.editionNumber),
    check("cards_edition_size_range", sql`${table.editionSize} between 1 and 20`),
    check("cards_edition_number_range", sql`${table.editionNumber} between 1 and ${table.editionSize}`),
    check(
      "cards_clip_check",
      sql`(${table.clipVideoId} is null and ${table.clipStart} is null and ${table.clipEnd} is null) or (${table.clipVideoId} is not null and ${table.clipStart} >= 0 and ${table.clipEnd} > ${table.clipStart})`,
    ),
    index("cards_owner_idx").on(table.ownerUserId),
    index("cards_creator_idx").on(table.creatorUserId),
  ],
);

/** Public identity for an account: shown as the owner under cards and in recipient search. */
export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    // Lowercase handle shown as @username; changeable, links use the account ID.
    username: text("username").notNull().unique(),
    displayName: text("display_name").notNull(),
    avatarUrl: text("avatar_url"),
    // Whether other people can find this account in recipient search.
    searchable: boolean("searchable").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("profiles_username_format", sql`${table.username} ~ '^[a-z0-9._]{3,20}$'`),
    check("profiles_display_name_length", sql`char_length(${table.displayName}) between 1 and 50`),
  ],
);

/** Every time a card changes hands, for ownership history. Claim dates are never shown publicly. */
export const cardOwnerships = pgTable(
  "card_ownerships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id),
    userId: uuid("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    // created: made "for myself" while signed in; claimed: via a claim link; accepted: a delivery.
    acquiredVia: text("acquired_via").notNull(),
    acquiredAt: timestamp("acquired_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("card_ownerships_acquired_via", sql`${table.acquiredVia} in ('created', 'claimed', 'accepted')`),
    index("card_ownerships_card_idx").on(table.cardId),
  ],
);

/** A card sent straight to an account; it's owned only once the recipient accepts. */
export const cardDeliveries = pgTable(
  "card_deliveries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cardId: uuid("card_id")
      .notNull()
      .references(() => cards.id),
    senderUserId: uuid("sender_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    recipientUserId: uuid("recipient_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
  },
  (table) => [
    check("card_deliveries_status", sql`${table.status} in ('pending', 'accepted', 'declined')`),
    // A card can only be waiting on one recipient at a time.
    uniqueIndex("card_deliveries_one_pending").on(table.cardId).where(sql`${table.status} = 'pending'`),
    index("card_deliveries_recipient_idx").on(table.recipientUserId, table.status),
  ],
);

/**
 * A song's matching track on other services, looked up once and reused by every card with
 * that song. Keyed by the Apple Music track ID (or "manual:<title>|<artist>" for songs typed
 * in by hand). A null ID with a checked time means "looked, not found"; it's retried later.
 */
export const songMatches = pgTable("song_matches", {
  songKey: text("song_key").primaryKey(),
  spotifyTrackId: text("spotify_track_id"),
  spotifyCheckedAt: timestamp("spotify_checked_at", { withTimezone: true }),
  youtubeVideoId: text("youtube_video_id"),
  youtubeCheckedAt: timestamp("youtube_checked_at", { withTimezone: true }),
});

/** A set of photos an account keeps together ("Japan trip"). Only its owner can see it. */
export const collections = pgTable(
  "collections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerUserId: uuid("owner_user_id")
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    // Mirrors COLLECTION_TITLE_MAX in src/lib/validation.ts; change both together.
    check("collections_title_length", sql`char_length(${table.title}) between 1 and 60`),
    index("collections_owner_idx").on(table.ownerUserId, table.createdAt),
  ],
);

/**
 * A photo in a collection, stored twice: the original file exactly as uploaded (its own
 * size, shape and quality) and a smaller preview for browsing. Width and height are the
 * original's, upright, so layouts can keep its shape before it loads.
 */
export const collectionPhotos = pgTable(
  "collection_photos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    collectionId: uuid("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    originalKey: text("original_key").notNull(),
    previewKey: text("preview_key").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    // Order within the collection, from 0.
    position: integer("position").notNull(),
    // A line under the photo when it's opened; NULL when there isn't one.
    caption: text("caption"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check("collection_photos_size", sql`${table.width} > 0 and ${table.height} > 0`),
    // Mirrors PHOTO_CAPTION_MAX in src/lib/validation.ts; change both together.
    check("collection_photos_caption_length", sql`char_length(${table.caption}) <= 150`),
    index("collection_photos_collection_idx").on(table.collectionId, table.position),
  ],
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
export type Profile = typeof profiles.$inferSelect;
