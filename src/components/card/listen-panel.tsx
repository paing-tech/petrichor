"use client";

import { ArrowUpRightIcon, OrbitIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { YouTubeSpace } from "@/components/card/youtube-space";

// The card page's player, under the card: Spotify's player (full songs on desktop for
// signed-in Premium listeners, previews otherwise) and, below it, the Immersive Space: the
// full-screen night sky with the song's YouTube video.

export type ListenSources = {
  title: string;
  artist: string;
  appleMusicUrl: string | null;
  spotifyTrackId: string | null;
  youtubeVideoId: string | null;
};

/** Spotify's compact player height (its sizes are 80, 152 and 352px); not cropped, per its terms. */
const SPOTIFY_HEIGHT = "h-[80px]";

export function ListenPanel({ sources }: { sources: ListenSources }) {
  // Nothing to play here: the song's own page on Apple Music, if there is one.
  if (!sources.spotifyTrackId && !sources.youtubeVideoId) {
    return sources.appleMusicUrl ? (
      <Button asChild size="lg" variant="outline" className="bg-background h-11 w-full">
        <a href={sources.appleMusicUrl} target="_blank" rel="noopener noreferrer">
          Listen on Apple Music <ArrowUpRightIcon />
        </a>
      </Button>
    ) : null;
  }

  return (
    <div className="grid w-full grid-cols-1 gap-2">
      {sources.spotifyTrackId && (
        <iframe
          src={`https://open.spotify.com/embed/track/${sources.spotifyTrackId}`}
          title={`${sources.title} by ${sources.artist} on Spotify`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`${SPOTIFY_HEIGHT} w-full rounded-xl border-0 bg-transparent`}
        />
      )}
      {sources.youtubeVideoId && (
        <YouTubeSpace
          videoId={sources.youtubeVideoId}
          title={`${sources.title} by ${sources.artist} on YouTube`}
          songTitle={sources.title}
          artist={sources.artist}
          trigger={(openSpace) => (
            <Button size="lg" className="h-11 w-full" onClick={openSpace}>
              <OrbitIcon /> Immersive Space
            </Button>
          )}
        />
      )}
    </div>
  );
}

/** Holds the player's place while the song's matches load, so the page doesn't jump. */
export function ListenPanelSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-2" aria-hidden>
      <div className={`bg-muted ${SPOTIFY_HEIGHT} animate-pulse rounded-xl`} />
      <div className="bg-muted h-11 animate-pulse rounded-md" />
    </div>
  );
}
