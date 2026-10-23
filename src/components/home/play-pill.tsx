"use client";

import { PlayIcon } from "lucide-react";
import { useListening } from "@/components/home/listening";
import { MarqueeText } from "@/components/ui/marquee-text";

/**
 * Under the home page's card, like the play pill on a card's page: the song (scrolling if it's
 * long) and a play icon at its right end, in one bordered pill; a tap anywhere on it plays.
 * Hidden while the song plays, when the corner player takes over.
 */
export function HomePlayPill({ title, artist }: { title: string; artist: string }) {
  const listening = useListening();
  return (
    <button
      type="button"
      onClick={listening?.toggle}
      aria-label={`Play ${title} by ${artist}`}
      className="hover:bg-muted/60 bg-background flex h-12 w-full items-center gap-3 rounded-full border pr-3 pl-5 text-left transition-colors active:scale-[0.99]"
    >
      <MarqueeText className="font-outfit min-w-0 flex-1 text-sm">
        {title} · <span className="text-muted-foreground">{artist}</span>
      </MarqueeText>
      <PlayIcon aria-hidden className="size-5 shrink-0 translate-x-px fill-current" />
    </button>
  );
}
