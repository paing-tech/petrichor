"use client";

import { useEffect, useState } from "react";
import { ArrowUpRightIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListeningPlayer } from "@/components/card/listening-player";

// The card page's player, under the card: Spotify's player (full songs on desktop for
// signed-in Premium listeners, previews otherwise) and a play button. Playing turns the page
// black (listening mode): Spotify and the caption row give way to the song's YouTube video in
// the middle, with its controls in the corner and the card waiting small beside them.

export type ListenSources = {
  title: string;
  artist: string;
  appleMusicUrl: string | null;
  spotifyTrackId: string | null;
  youtubeVideoId: string | null;
  /** The YouTube video's width ÷ height, if known. */
  youtubeAspect: number | null;
};

/** Spotify's compact player height (its sizes are 80, 152 and 352px); not cropped, per its terms. */
const SPOTIFY_HEIGHT = "h-[80px]";
/** The video plays at its own shape, from square (art tracks) to 16:9 (music videos). */
const playerAspect = (aspect: number | null) =>
  Math.min(16 / 9, Math.max(1, aspect ?? 16 / 9));

export function ListenPanel({ sources }: { sources: ListenSources }) {
  const [playing, setPlaying] = useState(false);

  // Listening mode: the page goes black (see globals.css and the card page), like the home page
  // while its song plays, and so do the phone's browser bars.
  useEffect(() => {
    if (!playing) return;
    document.documentElement.setAttribute("data-listening", "");
    const theme = document.querySelector<HTMLMetaElement>(
      'meta[name="theme-color"]',
    );
    const day = theme?.content;
    if (theme) theme.content = "#000000";
    window.scrollTo({ top: 0, behavior: "smooth" });
    return () => {
      document.documentElement.removeAttribute("data-listening");
      if (theme && day) theme.content = day;
    };
  }, [playing]);

  // Nothing to play here: the song's own page on Apple Music, if there is one.
  if (!sources.spotifyTrackId && !sources.youtubeVideoId) {
    return sources.appleMusicUrl ? (
      <Button
        asChild
        size="lg"
        variant="outline"
        className="bg-background h-11 w-full"
      >
        <a
          href={sources.appleMusicUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Listen on Apple Music <ArrowUpRightIcon />
        </a>
      </Button>
    ) : null;
  }

  if (playing && sources.youtubeVideoId) {
    return (
      <ListeningPlayer
        videoId={sources.youtubeVideoId}
        aspect={playerAspect(sources.youtubeAspect)}
        title={sources.title}
        artist={sources.artist}
        onClose={() => setPlaying(false)}
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3">
      {sources.spotifyTrackId && (
        <iframe
          src={`https://open.spotify.com/embed/track/${sources.spotifyTrackId}`}
          title={`${sources.title} by ${sources.artist} on Spotify`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`${SPOTIFY_HEIGHT} w-full rounded-xl border-0 bg-transparent`}
        />
      )}
      {sources.youtubeVideoId && (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={`Play ${sources.title}`}
          className="bg-foreground text-background grid size-11 place-items-center justify-self-start rounded-full transition-transform active:scale-95"
        >
          <PlayIcon className="size-4 translate-x-px fill-current" />
        </button>
      )}
    </div>
  );
}

/** Holds the player's place while the song's matches load, so the page doesn't jump. */
export function ListenPanelSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-3" aria-hidden>
      <div className={`bg-muted ${SPOTIFY_HEIGHT} animate-pulse rounded-xl`} />
      <div className="bg-muted size-11 animate-pulse rounded-full" />
    </div>
  );
}
