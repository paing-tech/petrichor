CREATE TABLE "collection_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"collection_id" uuid NOT NULL,
	"original_key" text NOT NULL,
	"preview_key" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collection_photos_size" CHECK ("collection_photos"."width" > 0 and "collection_photos"."height" > 0)
);
--> statement-breakpoint
CREATE TABLE "collections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "collections_title_length" CHECK (char_length("collections"."title") between 1 and 60)
);
--> statement-breakpoint
ALTER TABLE "collection_photos" ADD CONSTRAINT "collection_photos_collection_id_collections_id_fk" FOREIGN KEY ("collection_id") REFERENCES "public"."collections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collections" ADD CONSTRAINT "collections_owner_user_id_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "neon_auth"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collection_photos_collection_idx" ON "collection_photos" USING btree ("collection_id","position");--> statement-breakpoint
CREATE INDEX "collections_owner_idx" ON "collections" USING btree ("owner_user_id","created_at");