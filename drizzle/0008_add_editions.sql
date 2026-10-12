ALTER TABLE "cards" ADD COLUMN "edition_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "edition_number" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "edition_size" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_edition_number_unique" UNIQUE("edition_id","edition_number");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_edition_size_range" CHECK ("cards"."edition_size" between 1 and 100);--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_edition_number_range" CHECK ("cards"."edition_number" between 1 and "cards"."edition_size");