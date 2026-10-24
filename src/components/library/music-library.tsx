"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRightIcon } from "lucide-react";
import { ListeningCardControl } from "@/components/card/listening-card";
import { ListeningPlayer } from "@/components/card/listening-player";
import { useListeningMode } from "@/components/card/listening-store";
import { CollectibleCard, type CollectibleCardData } from "@/components/collectible-card";
import { FlipCard } from "@/components/flip-card";
import { DEFAULT_CARD_COLOR, tonalPhotoArea } from "@/lib/card-color";

export type LibraryTrack = {
  card: CollectibleCardData;
  youtubeVideoId: string | null;
  /** The video's width ÷ height (null if unknown: 16:9 is assumed). */
  videoAspect: number | null;
  /** The part of the song the creator chose (seconds), on this video. */
  clip: { start: number; end: number } | null;
};

/** The video plays at its own shape, from square (art tracks) to 16:9 (music videos). */
const playerAspect = (aspect: number | null) => Math.min(16 / 9, Math.max(1, aspect ?? 16 / 9));

/**
 * The songs of the user's keepsakes, each with its card. Tapping one opens the card page's
 * player over the list (listening mode), with the small card beside the song: tap it for the
 * message. The chevron closes it and the list is back where it was.
 */
export function MusicLibrary({ tracks }: { tracks: LibraryTrack[] }) {
  const [open, setOpen] = useState<LibraryTrack | null>(null);
  useListeningMode(!!open);

  // The list behind stays put while the player is open.
  useEffect(() => {
    if (!open) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflow;
    };
  }, [open]);

  return (
    <>
      {/* Out of sight (but keeping its scroll place) while a song plays over it. */}
      <ul className="divide-y divide-white/10 [html[data-listening]_&]:invisible">
        {tracks.map((track) => {
          const { card } = track;
          const playable = !!track.youtubeVideoId;
          return (
            <li key={card.cardId} className="flex items-center gap-3 py-3">
              <button
                type="button"
                disabled={!playable}
                onClick={() => setOpen(track)}
                className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
              >
                {/* The keepsake's photo (or its photo area's colour). */}
                <span
                  className="relative size-14 shrink-0 overflow-hidden rounded-md"
                  style={{ background: card.photoAreaColor ?? tonalPhotoArea(card.cardColor ?? DEFAULT_CARD_COLOR) }}
                >
                  {card.photoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={card.photoUrl} alt="" className="size-full object-cover" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-serif text-lg">{card.songTitle}</span>
                  <span className="block truncate text-sm text-white/60">
                    {card.artistName}
                    {card.moment && <> · {card.moment}</>}
                  </span>
                </span>
                {!playable && <span className="shrink-0 text-xs text-white/50">Not on YouTube</span>}
              </button>
              <Link
                href={`/c/${card.cardId}`}
                aria-label={`View the ${card.songTitle} card`}
                className="shrink-0 p-1 text-white/60 hover:text-white"
              >
                <ArrowUpRightIcon className="size-4" />
              </Link>
            </li>
          );
        })}
      </ul>

      {open?.youtubeVideoId && (
        <ListeningPlayer
          key={open.card.cardId}
          videoId={open.youtubeVideoId}
          aspect={playerAspect(open.videoAspect)}
          title={open.card.songTitle}
          artist={open.card.artistName}
          message={open.card.message ?? null}
          signature={open.card.senderName ?? null}
          clip={open.clip}
          card={
            <ListeningCardControl>
              <FlipCard
                front={<CollectibleCard card={open.card} className="max-w-none" />}
                back={<CollectibleCard card={open.card} face="back" className="max-w-none" />}
              />
            </ListeningCardControl>
          }
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
