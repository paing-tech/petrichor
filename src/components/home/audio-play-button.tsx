"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { HeadphonesIcon, PauseIcon, PlayIcon, SkipBackIcon, SkipForwardIcon } from "lucide-react";
import { useListening } from "@/components/home/listening";
import { cn } from "@/lib/utils";

const u = (px: number) => `calc(var(--u) * ${px})`;

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
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
  const thumbRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  // While dragging the bar: the share of the song being chosen (shown instead of the song's own).
  const scrub = useRef<number | null>(null);

  // Move the progress bar every frame while it's on screen (smoother than timeupdate).
  useEffect(() => {
    if (!shown || !listening) return;
    let frame = 0;
    const draw = () => {
      const audio = listening.audio();
      const duration = audio && audio.duration ? audio.duration : 0;
      const progress = scrub.current ?? (duration ? audio!.currentTime / duration : 0);
      if (barRef.current) barRef.current.style.width = `${progress * 100}%`;
      if (thumbRef.current) thumbRef.current.style.left = `${progress * 100}%`;
      const track = trackRef.current;
      if (track) {
        track.setAttribute("aria-valuemax", String(Math.round(duration)));
        track.setAttribute("aria-valuenow", String(Math.round(progress * duration)));
        track.setAttribute("aria-valuetext", `${formatTime(progress * duration)} of ${formatTime(duration)}`);
      }
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [shown, listening]);

  /** The share of the song under the pointer, along the bar. */
  const shareAt = (event: ReactPointerEvent<HTMLDivElement>) => {
    const bar = event.currentTarget.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - bar.left) / bar.width));
  };
  /** Jumps to a share of the song (0–1). */
  const seekTo = (share: number) => {
    const audio = listening?.audio();
    if (audio && audio.duration) audio.currentTime = Math.min(1, Math.max(0, share)) * audio.duration;
  };

  if (!listening) return null;
  const { track } = listening;
  const control =
    "flex items-center justify-center rounded-full transition-opacity hover:opacity-70 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

  return (
    <div
      className={cn(
        // Phones: full width with the same 24px margin each side, so the progress bar reaches
        // across. Larger screens: a 256px block in the corner.
        "fixed right-6 bottom-[max(1.5rem,env(safe-area-inset-bottom))] left-6 z-10 text-white transition-[opacity,translate] duration-700 ease-out motion-reduce:transition-none sm:right-auto sm:bottom-8 sm:left-8 sm:w-64",
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

      {/* Tap or drag to move through the song (or use the arrow keys). A 24px-tall target around
          the thin line; its dot shows while dragging, hovering or focused. */}
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label="Song position"
        aria-valuemin={0}
        // Kept up to date (with the maximum and the spoken time) by the drawing loop above.
        aria-valuenow={0}
        onKeyDown={(event) => {
          const audio = listening.audio();
          if (!audio || !audio.duration) return;
          const step = 5 / audio.duration;
          const now = audio.currentTime / audio.duration;
          const to =
            event.key === "ArrowRight" || event.key === "ArrowUp" ? now + step
            : event.key === "ArrowLeft" || event.key === "ArrowDown" ? now - step
            : event.key === "Home" ? 0
            : event.key === "End" ? 1
            : null;
          if (to === null) return;
          event.preventDefault();
          seekTo(to);
        }}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          scrub.current = shareAt(event);
        }}
        onPointerMove={(event) => {
          if (scrub.current !== null) scrub.current = shareAt(event);
        }}
        onPointerUp={(event) => {
          if (scrub.current === null) return;
          seekTo(shareAt(event));
          scrub.current = null;
        }}
        onPointerCancel={() => {
          scrub.current = null;
        }}
        className="group/bar relative mt-1 flex h-6 w-full cursor-pointer touch-none items-center outline-none"
      >
        <div className="h-0.5 w-full overflow-hidden rounded-full bg-white/25 transition-[height] group-hover/bar:h-1 group-active/bar:h-1">
          <div ref={barRef} className="h-full w-0 rounded-full bg-white" />
        </div>
        <div
          ref={thumbRef}
          aria-hidden
          className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 scale-0 rounded-full bg-white transition-transform group-hover/bar:scale-100 group-focus-visible/bar:scale-100 group-active/bar:scale-100"
        />
      </div>
    </div>
  );
}
