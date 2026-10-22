"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpRightIcon, PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListeningPlayer } from "@/components/card/listening-player";
import { MarqueeText } from "@/components/ui/marquee-text";
import { setMessageShown } from "@/components/card/listening-store";

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
  /** The card's message and signature, read in listening mode. */
  message: string | null;
  signature: string | null;
};

/** The video plays at its own shape, from square (art tracks) to 16:9 (music videos). */
const playerAspect = (aspect: number | null) =>
  Math.min(16 / 9, Math.max(1, aspect ?? 16 / 9));

/** Spotify's compact player height (its sizes are 80, 152 and 352px); not cropped, per its terms. */
const SPOTIFY_HEIGHT = "h-[80px]";
/** The service logos' size, in px: the play pill's height (h-12). */
const LOGO_SIZE = 30;

export function ListenPanel({ sources }: { sources: ListenSources }) {
  const [playing, setPlaying] = useState(false);
  // Spotify's player, opened from its logo beside the play pill.
  const [spotifyOpen, setSpotifyOpen] = useState(false);
  const spotify = useRef<HTMLIFrameElement>(null);

  // On a small phone the player opens past the bottom of the screen: bring all of it into view.
  useEffect(() => {
    if (spotifyOpen) spotify.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [spotifyOpen]);

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
      setMessageShown(false);
      document.documentElement.removeAttribute("data-listening");
      if (theme && day) theme.content = day;
    };
  }, [playing]);

  // Nothing to play here: the song's own page on Apple Music, if there is one.
  if (!sources.youtubeVideoId) {
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
        message={sources.message}
        signature={sources.signature}
        onClose={() => setPlaying(false)}
      />
    );
  }

  return (
    <div className="grid w-full grid-cols-1 gap-3">
      <div className="flex w-full items-center gap-4">
        {sources.youtubeVideoId && (
          // One pill-shaped button: the song (scrolling if it's long) and a play icon at its
          // right end; a tap anywhere on it plays.
          <button
            type="button"
            onClick={() => setPlaying(true)}
            aria-label={`Play ${sources.title} by ${sources.artist}`}
            className="hover:bg-muted/60 flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border pr-3 pl-5 text-left transition-colors active:scale-[0.99]"
          >
            <MarqueeText className="font-outfit min-w-0 flex-1 text-sm">
              {sources.title} · <span className="text-muted-foreground">{sources.artist}</span>
            </MarqueeText>
            <PlayIcon aria-hidden className="size-5 shrink-0 translate-x-px fill-current" />
          </button>
        )}
        {/* The song on other services, beside the pill and as tall as it: Spotify opens its
            player below; Apple Music opens the song in Apple Music (the Music app on iPhone and Mac). */}
        {sources.spotifyTrackId && (
          <button
            type="button"
            onClick={() => setSpotifyOpen((open) => !open)}
            aria-label={spotifyOpen ? "Hide the Spotify player" : "Listen on Spotify"}
            aria-pressed={spotifyOpen}
            className="shrink-0 rounded-full transition-opacity hover:opacity-80 active:scale-95"
          >
            <Image
              src="/icon/Spotify_Primary_Logo_RGB_Green.png"
              alt=""
              width={LOGO_SIZE}
              height={LOGO_SIZE}
              unoptimized
            />
          </button>
        )}
        {sources.appleMusicUrl && (
          <a
            href={sources.appleMusicUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open in Apple Music"
            className="shrink-0 rounded-[22%] transition-opacity hover:opacity-80 active:scale-95"
          >
            <Image
              src="/icon/Apple_Music_Icon_RGB_sm_073120.svg"
              alt=""
              width={LOGO_SIZE}
              height={LOGO_SIZE}
              unoptimized
            />
          </a>
        )}
      </div>
      {spotifyOpen && sources.spotifyTrackId && (
        <iframe
          ref={spotify}
          src={`https://open.spotify.com/embed/track/${sources.spotifyTrackId}`}
          title={`${sources.title} by ${sources.artist} on Spotify`}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          className={`${SPOTIFY_HEIGHT} w-full rounded-xl border-0 bg-transparent`}
        />
      )}
    </div>
  );
}

/** Holds the player's place while the song's matches load, so the page doesn't jump. */
export function ListenPanelSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-3" aria-hidden>
      <div className="bg-muted h-12 animate-pulse rounded-full" />
    </div>
  );
}
