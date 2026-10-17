"use client";

import type { CSSProperties } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";
import { useListening } from "@/components/home/listening";
import { cn } from "@/lib/utils";

const u = (px: number) => `calc(var(--u) * ${px})`;

/**
 * The round play/pause button for the home page's song (inside a ListeningProvider), in the
 * current text color. Sized in card units by default, for a CollectibleCard's
 * `titleAccessory` (keep it under the title's ~33-unit line); pass `size` in any CSS length
 * to use it elsewhere.
 */
export function AudioPlayButton({
  label,
  size = u(26),
  iconSize = u(11),
  className,
}: {
  label: string;
  size?: string;
  iconSize?: string;
  className?: string;
}) {
  const listening = useListening();
  const playing = listening?.playing ?? false;
  const icon: CSSProperties = { width: iconSize, height: iconSize };

  return (
    <button
      type="button"
      onClick={listening?.toggle}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
      aria-pressed={playing}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full ring-1 ring-current transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {playing ? (
        <PauseIcon className="fill-current" style={icon} />
      ) : (
        // Nudged right so the triangle looks centered.
        <PlayIcon className="fill-current" style={{ ...icon, marginLeft: `calc(${iconSize} * 0.14)` }} />
      )}
    </button>
  );
}

/**
 * Bottom-left of the window while the song plays: its title, a pause button and the artist,
 * in white. Slides up a little as it fades in.
 */
export function NowPlaying({ title, artist }: { title: string; artist: string }) {
  const playing = useListening()?.playing ?? false;

  return (
    <div
      className={cn(
        "fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 z-10 text-white transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none sm:bottom-8 sm:left-8",
        playing ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
      inert={!playing}
      aria-hidden={!playing}
    >
      <div className="flex items-center gap-3">
        <p className="font-serif text-3xl leading-tight tracking-tight">{title}</p>
        <AudioPlayButton label={title} size="2rem" iconSize="0.8rem" />
      </div>
      <p className="font-outfit mt-0.5 text-sm text-white/70">{artist}</p>
    </div>
  );
}
