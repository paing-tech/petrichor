CREATE TABLE "cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" text NOT NULL,
	"song_title" text NOT NULL,
	"artist_name" text NOT NULL,
	"song_url" text,
	"photo_url" text,
	"lyrics_excerpt" text,
	"message" text,
	"sender_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cards_card_id_unique" UNIQUE("card_id")
);
