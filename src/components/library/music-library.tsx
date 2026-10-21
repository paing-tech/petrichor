"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon, AudioLinesIcon } from "lucide-react";
import { EARTH_PHOTO_AREA } from "@/lib/card-color";
import { cn } from "@/lib/utils";

export type LibraryTrack = {
  cardId: string;
  songTitle: string;
  artistName: string;
  moment: string | null;
  photoUrl: string | null;
  photoAreaColor: string | null;
  youtubeVideoId: string | null;
};

/**
 * The songs of the user's keepsakes, each with its card, and one YouTube player above them
 * that plays whichever is picked. The player stays on screen (sticky) while it plays, and plays
 * only when a song is picked, per YouTube's embed rules.
 */
export function MusicLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [current, setCurrent] = useState(() => tracks.find((t) => t.youtubeVideoId) ?? null);
  // The first song is only cued; picking one starts it.
  const [picked, setPicked] = useState(false);

  return (
    <div className="grid gap-6">
      {current?.youtubeVideoId && (
        <div className="bg-background sticky top-0 z-10 -mx-4 grid gap-3 px-4 pt-2 pb-3 sm:mx-0 sm:px-0">
          <iframe
            key={current.cardId}
            src={`https://www.youtube-nocookie.com/embed/${current.youtubeVideoId}?playsinline=1&rel=0${picked ? "&autoplay=1" : ""}`}
            title={`${current.songTitle} by ${current.artistName} on YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            // YouTube requires its player to be at least 200px tall.
            className="aspect-video min-h-[200px] w-full rounded-xl border-0 bg-black"
          />
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-serif text-xl">{current.songTitle}</p>
              <p className="text-muted-foreground truncate text-sm">{current.artistName}</p>
            </div>
            <Link
              href={`/c/${current.cardId}`}
              className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
            >
              View card <ArrowUpRightIcon className="size-3" />
            </Link>
          </div>
        </div>
      )}

      <ul className="divide-y">
        {tracks.map((track) => {
          const playing = current?.cardId === track.cardId;
          const playable = !!track.youtubeVideoId;
          return (
            <li key={track.cardId} className="flex items-center gap-3 py-3">
              <button
                type="button"
                disabled={!playable}
                onClick={() => {
                  setCurrent(track);
                  setPicked(true);
                }}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                {/* The keepsake's photo (or its photo area's colour). */}
                <span
                  className="relative size-14 shrink-0 overflow-hidden rounded-md"
                  style={{ background: track.photoAreaColor ?? EARTH_PHOTO_AREA }}
                >
                  {track.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.photoUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block truncate font-serif text-lg", playing && "underline underline-offset-4")}>
                    {track.songTitle}
                  </span>
                  <span className="text-muted-foreground block truncate text-sm">
                    {track.artistName}
                    {track.moment && <> · {track.moment}</>}
                  </span>
                </span>
                {playing && picked ? (
                  <AudioLinesIcon className="size-4 shrink-0" aria-label="Now playing" />
                ) : !playable ? (
                  <span className="text-muted-foreground shrink-0 text-xs">Not on YouTube</span>
                ) : null}
              </button>
              <Link
                href={`/c/${track.cardId}`}
                aria-label={`View the ${track.songTitle} card`}
                className="text-muted-foreground hover:text-foreground shrink-0 p-1"
              >
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
