CREATE TABLE "song_matches" (
	"song_key" text PRIMARY KEY NOT NULL,
	"spotify_track_id" text,
	"spotify_checked_at" timestamp with time zone,
	"youtube_video_id" text,
	"youtube_checked_at" timestamp with time zone
);
