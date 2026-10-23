ALTER TABLE "cards" ADD COLUMN "clip_video_id" text;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "clip_start" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "clip_end" integer;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_clip_check" CHECK (("cards"."clip_video_id" is null and "cards"."clip_start" is null and "cards"."clip_end" is null) or ("cards"."clip_video_id" is not null and "cards"."clip_start" >= 0 and "cards"."clip_end" > "cards"."clip_start"));