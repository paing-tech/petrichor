import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: text("card_id").notNull().unique(),
  songTitle: text("song_title").notNull(),
  artistName: text("artist_name").notNull(),
  photoUrl: text("photo_url"),
  appleMusicUrl: text("apple_music_url"),
  lyricsExcerpt: text("lyrics_excerpt"),
  message: text("message"),
  senderName: text("sender_name"),
  location: text("location"),
  // The sender's IANA time zone, so the printed date matches their calendar day.
  timeZone: text("time_zone"),
  cardColor: text("card_color").notNull().default("#ffffff"),
  // Fill for the photo area on cards without a photo; NULL means the default earth gradient.
  photoAreaColor: text("photo_area_color"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
