"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { HeadphonesIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import { useListening } from "@/components/home/listening";
import { cn } from "@/lib/utils";

const u = (px: number) => `calc(var(--u) * ${px})`;
/** Trims a line's box to its capitals and baseline, so spacing is measured between letters. */
const TRIM: CSSProperties = { textBox: "trim-both cap alphabetic" };

/**
 * The play/pause button for the home page's song (inside a ListeningProvider), in the
 * current text color: round with a ring by default, or just the icon with `ring={false}`.
 * Sized in card units by default, for a CollectibleCard's `titleAccessory` (keep it under
 * the title's ~33-unit line); pass `size` in any CSS length to use it elsewhere.
 */
export function AudioPlayButton({
  label,
  size = u(26),
  iconSize = u(11),
  ring = true,
  className,
}: {
  label: string;
  size?: string;
  iconSize?: string;
  ring?: boolean;
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
        "flex shrink-0 items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current",
        ring && "ring-1 ring-current",
        className,
      )}
      style={{ width: size, height: size }}
    >
      {playing ? (
        <PauseIcon className="shrink-0 fill-current" style={icon} />
      ) : (
        // Nudged right so the triangle looks centered.
        <PlayIcon className="shrink-0 fill-current" style={{ ...icon, marginLeft: `calc(${iconSize} * 0.14)` }} />
      )}
    </button>
  );
}

/**
 * Bottom-left of the window while the song plays, in white: the title and artist, a
 * headphones note, previous / play-pause / next, and the song's progress. Slides up a little
 * as it fades in.
 */
export function NowPlaying() {
  const listening = useListening();
  const shown = listening?.dark ?? false;
  const barRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  // Move the progress bar every frame while it's on screen (smoother than timeupdate).
  useEffect(() => {
    if (!shown || !listening) return;
    let frame = 0;
    const draw = () => {
      const audio = listening.audio();
      const progress = audio && audio.duration ? audio.currentTime / audio.duration : 0;
      if (barRef.current) barRef.current.style.width = `${progress * 100}%`;
      trackRef.current?.setAttribute("aria-valuenow", String(Math.round(progress * 100)));
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shown, listening]);

  if (!listening) return null;
  const { track } = listening;
  const control =
    "flex items-center justify-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div
      className={cn(
        "fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 z-10 w-64 text-white transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none sm:bottom-8 sm:left-8",
        shown ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
      inert={!shown}
      aria-hidden={!shown}
    >
      {/* Each line is trimmed to its letters (text-box), so the gaps between them are equal:
          baseline of one line to the capitals of the next. Long text is clipped only sideways,
          so descenders below the trimmed box still show. */}
      <div className="flex flex-col gap-4">
        <p className="overflow-x-clip font-serif text-3xl leading-none tracking-tight text-ellipsis whitespace-nowrap" style={TRIM}>
          {track.title}
        </p>
        <p className="font-outfit overflow-x-clip text-sm leading-none text-ellipsis whitespace-nowrap text-white/70" style={TRIM}>
          {track.artist}
        </p>
        <p className="font-outfit text-xs leading-none text-white/60" style={TRIM}>
          {/* Inline (so the line can be trimmed); negative margins keep the icon from making
              the line taller than its letters. */}
          <HeadphonesIcon className="-my-1 mr-1.5 inline-block size-3.5 align-[0.05em]" aria-hidden />
          Headphones recommended
        </p>
      </div>

      <div className="mt-3 flex items-center gap-5">
        <button type="button" onClick={listening.previous} aria-label="Previous" className={cn(control, "size-8")}>
          <SkipBackIcon className="size-4 fill-current" />
        </button>
        <AudioPlayButton label={track.title} ring={false} size="2.5rem" iconSize="1.4rem" />
        <button
          type="button"
          onClick={listening.next}
          disabled={!listening.hasNext}
          aria-label="Next"
          className={cn(control, "size-8")}
        >
          <SkipForwardIcon className="size-4 fill-current" />
        </button>
      </div>

      <div
        ref={trackRef}
        role="progressbar"
        aria-label="Song progress"
        aria-valuemin={0}
        aria-valuemax={100}
        className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-white/25"
      >
        <div ref={barRef} className="h-full w-0 rounded-full bg-white" />
      </div>
    </div>
  );
}
