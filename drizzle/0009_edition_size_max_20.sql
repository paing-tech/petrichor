ALTER TABLE "cards" DROP CONSTRAINT "cards_edition_size_range";--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_edition_size_range" CHECK ("cards"."edition_size" between 1 and 20);