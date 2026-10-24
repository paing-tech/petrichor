"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { ArrowUpRightIcon, XIcon } from "lucide-react";
import { DEFAULT_CARD_COLOR, tonalPhotoArea } from "@/lib/card-color";

export type LibraryTrack = {
  cardId: string;
  songTitle: string;
  artistName: string;
  moment: string | null;
  photoUrl: string | null;
  photoAreaColor: string | null;
  cardColor: string | null;
  youtubeVideoId: string | null;
  /** The video's width ÷ height (null if unknown: 16:9 is assumed). */
  videoAspect: number | null;
};

/**
 * The player takes each video's own shape, so it's filled with no black bars, between square
 * (art tracks) and 16:9 (music videos); taller videos sit in a square.
 */
const playerAspect = (aspect: number | null) => Math.min(16 / 9, Math.max(1, aspect ?? 16 / 9));
/** Dragging the sheet down further than this (px) closes it. */
const DISMISS_DISTANCE = 120;
const SHEET_TRANSITION = { type: "spring", damping: 32, stiffness: 320 } as const;

/**
 * The songs of the user's keepsakes, each with its card. Tapping one slides up a sheet with its
 * YouTube player; closing the sheet stops the song (YouTube's player must stay on screen while
 * it plays).
 */
export function MusicLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [open, setOpen] = useState<LibraryTrack | null>(null);

  return (
    <>
      <ul className="divide-y divide-white/10">
        {tracks.map((track) => {
          const playable = !!track.youtubeVideoId;
          return (
            <li key={track.cardId} className="flex items-center gap-3 py-3">
              <button
                type="button"
                disabled={!playable}
                onClick={() => setOpen(track)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                {/* The keepsake's photo (or its photo area's colour). */}
                <span
                  className="relative size-14 shrink-0 overflow-hidden rounded-md"
                  style={{ background: track.photoAreaColor ?? tonalPhotoArea(track.cardColor ?? DEFAULT_CARD_COLOR) }}
                >
                  {track.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={track.photoUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg">{track.songTitle}</span>
                  <span className="block truncate text-sm text-white/60">
                    {track.artistName}
                    {track.moment && <> · {track.moment}</>}
                  </span>
                </span>
                {!playable && <span className="shrink-0 text-xs text-white/50">Not on YouTube</span>}
              </button>
              <Link
                href={`/c/${track.cardId}`}
                aria-label={`View the ${track.songTitle} card`}
                className="shrink-0 p-1 text-white/60 hover:text-white"
              >
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </li>
          );
        })}
      </ul>

      <AnimatePresence>
        {open?.youtubeVideoId && (
          <PlayerSheet key={open.cardId} track={open} onClose={() => setOpen(null)} />
        )}
      </AnimatePresence>
    </>
  );
}

/**
 * A sheet that slides up from the bottom with the song's YouTube player (which starts, since
 * the viewer just picked it). Close with ✕, a tap outside, a swipe down or Escape.
 */
function PlayerSheet({ track, onClose }: { track: LibraryTrack; onClose: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // The page behind stays put while the sheet is open.
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`${track.songTitle}, playing`}>
      <motion.div
        className="absolute inset-0 bg-black/70"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      />
      <motion.div
        className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl bg-neutral-900 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={SHEET_TRANSITION}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.6 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > DISMISS_DISTANCE || info.velocity.y > 600) onClose();
        }}
      >
        {/* Grab handle, and close. */}
        <div className="relative flex h-10 items-center justify-center">
          <span aria-hidden className="h-1 w-10 rounded-full bg-white/25" />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close player"
            className="absolute top-1.5 right-3 grid size-8 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
          >
            <XIcon className="size-4" />
          </button>
        </div>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${track.youtubeVideoId}?playsinline=1&rel=0&autoplay=1`}
          title={`${track.songTitle} by ${track.artistName} on YouTube`}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // YouTube requires its player to be at least 200px tall; it's never covered.
          className="block min-h-[200px] w-full border-0 bg-black"
          style={{ aspectRatio: playerAspect(track.videoAspect) }}
        />
        <div className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <div className="min-w-0">
            <p className="truncate font-serif text-2xl">{track.songTitle}</p>
            <p className="truncate text-sm text-white/60">
              {track.artistName}
              {track.moment && <> · {track.moment}</>}
            </p>
          </div>
          <Link
            href={`/c/${track.cardId}`}
            className="inline-flex shrink-0 items-center gap-1 text-xs text-white/60 hover:text-white"
          >
            View card <ArrowUpRightIcon className="size-3" />
          </Link>
        </div>
      </motion.div>
    </div>
  );
}
