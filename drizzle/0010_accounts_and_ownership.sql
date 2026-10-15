CREATE TABLE "card_deliveries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"sender_user_id" uuid,
	"recipient_user_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"responded_at" timestamp with time zone,
	CONSTRAINT "card_deliveries_status" CHECK ("card_deliveries"."status" in ('pending', 'accepted', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "card_ownerships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_id" uuid NOT NULL,
	"user_id" uuid,
	"acquired_via" text NOT NULL,
	"acquired_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "card_ownerships_acquired_via" CHECK ("card_ownerships"."acquired_via" in ('created', 'claimed', 'accepted'))
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar_url" text,
	"searchable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_username_unique" UNIQUE("username"),
	CONSTRAINT "profiles_username_format" CHECK ("profiles"."username" ~ '^[a-z0-9._]{3,20}$'),
	CONSTRAINT "profiles_display_name_length" CHECK (char_length("profiles"."display_name") between 1 and 50)
);
--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "creator_user_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "owner_user_id" uuid;--> statement-breakpoint
ALTER TABLE "cards" ADD COLUMN "claim_token_hash" text;--> statement-breakpoint
ALTER TABLE "card_deliveries" ADD CONSTRAINT "card_deliveries_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_deliveries" ADD CONSTRAINT "card_deliveries_sender_user_id_user_id_fk" FOREIGN KEY ("sender_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_deliveries" ADD CONSTRAINT "card_deliveries_recipient_user_id_user_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_ownerships" ADD CONSTRAINT "card_ownerships_card_id_cards_id_fk" FOREIGN KEY ("card_id") REFERENCES "public"."cards"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "card_ownerships" ADD CONSTRAINT "card_ownerships_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "card_deliveries_one_pending" ON "card_deliveries" USING btree ("card_id") WHERE "card_deliveries"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "card_deliveries_recipient_idx" ON "card_deliveries" USING btree ("recipient_user_id","status");--> statement-breakpoint
CREATE INDEX "card_ownerships_card_idx" ON "card_ownerships" USING btree ("card_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_creator_user_id_user_id_fk" FOREIGN KEY ("creator_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cards_owner_idx" ON "cards" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "cards_creator_idx" ON "cards" USING btree ("creator_user_id");--> statement-breakpoint
ALTER TABLE "cards" ADD CONSTRAINT "cards_claim_token_hash_unique" UNIQUE("claim_token_hash");