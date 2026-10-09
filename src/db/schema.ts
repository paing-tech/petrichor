import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const cards = pgTable("cards", {
  id: uuid("id").primaryKey().defaultRandom(),
  cardId: text("card_id").notNull().unique(),
  songTitle: text("song_title").notNull(),
  artistName: text("artist_name").notNull(),
  songUrl: text("song_url"),
  photoUrl: text("photo_url"),
  lyricsExcerpt: text("lyrics_excerpt"),
  message: text("message"),
  senderName: text("sender_name"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Card = typeof cards.$inferSelect;
export type NewCard = typeof cards.$inferInsert;
