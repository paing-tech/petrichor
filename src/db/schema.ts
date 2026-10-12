import { sql } from "drizzle-orm";
import { check, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";

export const cards = pgTable(
  "cards",
  {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: text("card_id").notNull().unique(),
  songTitle: text("song_title").notNull(),
  artistName: text("artist_name").notNull(),
  photoUrl: text("photo_url"),
  appleMusicUrl: text("apple_music_url"),
  lyricsExcerpt: text("lyrics_excerpt"),
  message: text("message"),
  senderName: text("sender_name"),
  // A short note about the occasion: "Birthday party", "Graduation", "Singapore".
  moment: text("moment"),
  // The sender's IANA time zone, so the printed date matches their calendar day.
  timeZone: text("time_zone"),
  cardColor: text("card_color").notNull().default("#ffffff"),
  // Fill for the photo area on cards without a photo; NULL means the default earth gradient.
  photoAreaColor: text("photo_area_color"),
  // Numbered editions: identical cards created together, each with its own card ID,
  // printed as "edition_number of edition_size". edition_id links the set.
  // The size range check below mirrors MAX_EDITION_SIZE in src/lib/validation.ts
  // (20); keep the two in sync. Raise both if larger editions are offered.
  editionId: uuid("edition_id").notNull().defaultRandom(),
  editionNumber: integer("edition_number").notNull().default(1),
  editionSize: integer("edition_size").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  },
  (table) => [
    unique("cards_edition_number_unique").on(table.editionId, table.editionNumber),
    check("cards_edition_size_range", sql`${table.editionSize} between 1 and 20`),
    check("cards_edition_number_range", sql`${table.editionNumber} between 1 and ${table.editionSize}`),
  ],
);

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
