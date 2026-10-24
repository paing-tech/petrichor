"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { PauseIcon, PlayIcon, ScissorsIcon } from "lucide-react";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { MarqueeText } from "@/components/ui/marquee-text";
import { cn } from "@/lib/utils";
import { CLIP_MIN_SECONDS } from "@/lib/validation";

export type ClipRange = { start: number; end: number };

/** How long a newly chosen part is: half a minute from where the video is (or to its end). */
const DEFAULT_LENGTH = 30;

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/** A clip's length: "46s", "1m 20s", or "2m". */
const formatLength = (seconds: number) => {
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  return m === 0 ? `${s}s` : s % 60 === 0 ? `${m}m` : `${m}m ${s % 60}s`;
};

/**
 * On the preview: the song as the card will play it (its YouTube video), and, if the creator
 * likes, the part of it the card plays. Closed, it's the song in a pill with a play button, like
 * the card page's; opened, the video plays (YouTube's player, at least 200px tall), with "Choose a
 * part" beneath it. A chosen part shows as a bar whose two handles mark its start and end, with
 * "Start here" / "End here" to set them from wherever the video is, and "Play clip". Times are
 * whole seconds.
 */
export function SongClipPicker({
  videoId,
  songTitle,
  artist,
  clip,
  onChange,
  startOpen = false,
  warning,
  onReplace,
}: {
  videoId: string;
  songTitle: string;
  artist: string;
  clip: ClipRange | null;
  onChange: (clip: ClipRange | null) => void;
  /** Show the video straight away (ready to play, not playing): for a link just pasted. */
  startOpen?: boolean;
  /** A caution under the video, e.g. that it may not be the song. */
  warning?: string;
  /** Offers "Replace" (for a pasted video): back to pasting a link. */
  onReplace?: () => void;
}) {
  const origin = useOrigin();
  // Opened by its play button (so the video starts), already open when there's a part, or
  // straight away for a pasted video.
  const [open, setOpen] = useState(clip !== null || startOpen);
  const [autoplay, setAutoplay] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [duration, setDuration] = useState(0);
  const [time, setTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  // Playing just the part: the video pauses at its end.
  const [previewing, setPreviewing] = useState(false);

  // The message handler reads the latest values through these.
  const latest = useRef({ clip, previewing, onChange });
  useEffect(() => {
    latest.current = { clip, previewing, onChange };
  });

  const command = (func: string, args: unknown[] = []) =>
    iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "command", func, args }), "*");

  // Hear the player: its length (keeping a part within it), the time, playing or not.
  useEffect(() => {
    if (!open) return;
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let data: { info?: { playerState?: number; currentTime?: number; duration?: number } };
      try {
        data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      const info = data?.info;
      if (!info) return;
      const { clip: current, previewing: inPreview, onChange: change } = latest.current;
      if (info.duration) {
        const length = Math.floor(info.duration);
        setDuration(length);
        if (current && current.end > length) {
          change({ start: Math.min(current.start, length - CLIP_MIN_SECONDS), end: length });
        }
      }
      if (info.playerState !== undefined) setPlaying(info.playerState === 1);
      if (info.currentTime !== undefined) {
        setTime(info.currentTime);
        // The part's end, while playing just the part: stop there, ready to play it again.
        if (inPreview && current && info.currentTime >= current.end) {
          command("pauseVideo");
          command("seekTo", [current.start, true]);
          setPreviewing(false);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [open]);

  if (!open) {
    return (
      // The same pill as the card page's: the song, and a play icon at its right end.
      <button
        type="button"
        onClick={() => {
          setAutoplay(true);
          setOpen(true);
        }}
        aria-label={`Play ${songTitle} by ${artist}`}
        className="hover:bg-muted/60 flex h-12 w-full items-center gap-3 rounded-full border pr-3 pl-5 text-left transition-colors active:scale-[0.99]"
      >
        <MarqueeText className="font-outfit min-w-0 flex-1 text-sm">
          {songTitle} · <span className="text-muted-foreground">{artist}</span>
        </MarqueeText>
        <PlayIcon aria-hidden className="size-5 shrink-0 translate-x-px fill-current" />
      </button>
    );
  }

  const ready = duration > 0;
  /** A new part: half a minute from where the video is (moved back if that runs past the end). */
  function choosePart() {
    const end = Math.min(duration, Math.floor(time) + DEFAULT_LENGTH);
    onChange({ start: Math.max(0, end - DEFAULT_LENGTH), end });
  }
  function playPart() {
    if (!clip) return;
    if (previewing && playing) {
      command("pauseVideo");
      setPreviewing(false);
      return;
    }
    command("seekTo", [clip.start, true]);
    command("playVideo");
    setPreviewing(true);
  }

  return (
    <section aria-label={`${songTitle} by ${artist}`} className="grid w-full gap-3 text-sm">
      {/* YouTube's player, 16:9 and never under its 200px minimum height. */}
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1${autoplay ? "&autoplay=1" : ""}${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`}
        title={`${songTitle} by ${artist} on YouTube`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId }), "*")}
        className="block aspect-video min-h-[200px] w-full rounded-xl border-0 bg-black"
      />
      {/* Under the video: its caution on the left, and (for a pasted video) Replace on the right,
          styled like the song step's "Can't find it?" link. */}
      {(warning || onReplace) && (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <p className="text-amber-700 dark:text-amber-400">{warning}</p>
          {onReplace && (
            <button
              type="button"
              onClick={() => {
                command("pauseVideo");
                onReplace();
              }}
              className="text-muted-foreground hover:text-foreground shrink-0 underline underline-offset-2"
            >
              Replace
            </button>
          )}
        </div>
      )}

      {!clip ? (
        // Optional: the card plays the whole song unless a part is chosen.
        <Button type="button" variant="outline" size="lg" className="bg-background w-full" disabled={!ready} onClick={choosePart}>
          <ScissorsIcon /> Choose a clip
        </Button>
      ) : (
        <div className="grid gap-3">
          {/* The clip's play button, and the song as a strip with the clip framed in it. */}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon-lg"
              className="shrink-0"
              disabled={!ready}
              onClick={playPart}
              aria-label={previewing && playing ? "Pause the clip" : "Play the clip"}
            >
              {previewing && playing ? (
                <PauseIcon className="fill-current" />
              ) : (
                <PlayIcon className="translate-x-px fill-current" />
              )}
            </Button>
            {ready && (
              <ClipStrip
                duration={duration}
                clip={clip}
                // Only while the clip itself plays: where it is, inside the frame.
                time={previewing && playing ? time : null}
                onChange={onChange}
              />
            )}
          </div>
          <div className="font-outfit flex items-baseline justify-between tabular-nums">
            <span>
              {formatTime(clip.start)} – {formatTime(clip.end)}{" "}
              <span className="text-muted-foreground">· {formatLength(clip.end - clip.start)}</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setPreviewing(false);
                onChange(null);
              }}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-4 hover:underline"
            >
              Use the whole song
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

/** How many bars stand for the song (a rhythm only: YouTube doesn't share the song's waveform). */
const BARS = 40;

/**
 * The song as a strip of bars, with the clip framed in a rounded window (like the iPhone's
 * ringtone trimmer): drag the window to move the clip, or its left or right edge to make it
 * shorter or longer (at least CLIP_MIN_SECONDS); tap elsewhere on the strip to move the window
 * there. Bars inside the window are darker; while the clip plays, a playhead moves through it.
 * The window and both edges take the arrow keys too (a second at a time).
 */
function ClipStrip({
  duration,
  clip,
  time,
  onChange,
}: {
  duration: number;
  clip: ClipRange;
  /** Where the clip is playing, or null when it isn't. */
  time: number | null;
  onChange: (clip: ClipRange) => void;
}) {
  const strip = useRef<HTMLDivElement>(null);
  // What's being dragged, and the clip and pointer when it started.
  const drag = useRef<{ mode: "move" | "start" | "end"; x: number; clip: ClipRange } | null>(null);
  const length = clip.end - clip.start;
  const pct = (seconds: number) => (seconds / duration) * 100;
  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

  /** The clip moved to start at `start` (keeping its length), within the song. */
  const moved = (start: number, len = length) => {
    const from = Math.round(clamp(start, 0, duration - len));
    return { start: from, end: from + len };
  };
  const withStart = (start: number) => ({ start: Math.round(clamp(start, 0, clip.end - CLIP_MIN_SECONDS)), end: clip.end });
  const withEnd = (end: number) => ({ start: clip.start, end: Math.round(clamp(end, clip.start + CLIP_MIN_SECONDS, duration)) });

  /** Starts dragging the window or one of its edges (named by the element's data-drag). */
  function beginDrag(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { mode: event.currentTarget.dataset.drag as "move" | "start" | "end", x: event.clientX, clip };
  }
  const keys = (change: (step: number) => ClipRange) => (event: ReactKeyboardEvent) => {
    const step = event.key === "ArrowRight" || event.key === "ArrowUp" ? 1 : event.key === "ArrowLeft" || event.key === "ArrowDown" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    onChange(change(step));
  };

  const playhead = time === null ? null : ((clamp(time, clip.start, clip.end) - clip.start) / length) * 100;

  return (
    <div
      ref={strip}
      // Tapping the strip outside the window centres the window there.
      onPointerDown={(event) => {
        const box = strip.current!.getBoundingClientRect();
        onChange(moved(((event.clientX - box.left) / box.width) * duration - length / 2));
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        const delta = ((event.clientX - d.x) / strip.current!.getBoundingClientRect().width) * duration;
        if (d.mode === "move") onChange(moved(d.clip.start + delta, d.clip.end - d.clip.start));
        else if (d.mode === "start") onChange(withStart(d.clip.start + delta));
        else onChange(withEnd(d.clip.end + delta));
      }}
      onPointerUp={() => (drag.current = null)}
      onPointerCancel={() => (drag.current = null)}
      className="relative h-12 min-w-0 flex-1 cursor-pointer touch-none select-none"
    >
      {/* The bars: alternately tall and short, darker inside the clip. */}
      <div aria-hidden className="absolute inset-0 flex items-center justify-between px-1">
        {Array.from({ length: BARS }, (_, i) => {
          const at = ((i + 0.5) / BARS) * duration;
          return (
            <span
              key={i}
              className={cn(
                "w-[3px] rounded-full transition-colors",
                i % 2 ? "h-[28%]" : "h-[56%]",
                at >= clip.start && at <= clip.end ? "bg-foreground" : "bg-foreground/20",
              )}
            />
          );
        })}
      </div>

      {/* The window: drag it to move the clip. */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Clip position"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration - length)}
        aria-valuenow={clip.start}
        aria-valuetext={`${formatTime(clip.start)} to ${formatTime(clip.end)}`}
        data-drag="move"
        onPointerDown={beginDrag}
        onKeyDown={keys((step) => moved(clip.start + step))}
        className="border-foreground focus-visible:ring-ring/50 absolute inset-y-0 min-w-10 cursor-grab rounded-lg border-2 outline-none focus-visible:ring-3 active:cursor-grabbing"
        style={{ left: `${pct(clip.start)}%`, width: `${pct(length)}%` }}
      >
        {/* While the clip plays, a soft translucent fill grows through the window to show how far
            it's got (inside the frame, its left corners matching the window's). */}
        {playhead !== null && (
          <span
            aria-hidden
            className="bg-foreground/20 pointer-events-none absolute inset-y-0 left-0 rounded-l-[6px]"
            style={{ width: `${playhead}%` }}
          />
        )}
        {/* The two edges: drag (or arrow-key) them to set where the clip starts and ends. Their
            grab areas sit mostly outside the window (and the window is at least 40px wide), so
            its middle always moves the clip, however short the clip is. */}
        <span
          role="slider"
          tabIndex={0}
          aria-label="Clip start"
          aria-valuemin={0}
          aria-valuemax={clip.end - CLIP_MIN_SECONDS}
          aria-valuenow={clip.start}
          aria-valuetext={formatTime(clip.start)}
          data-drag="start"
          onPointerDown={beginDrag}
          onKeyDown={keys((step) => withStart(clip.start + step))}
          className="focus-visible:ring-ring/50 absolute inset-y-0 -left-4 w-6 cursor-ew-resize rounded-md outline-none focus-visible:ring-3"
        />
        <span
          role="slider"
          tabIndex={0}
          aria-label="Clip end"
          aria-valuemin={clip.start + CLIP_MIN_SECONDS}
          aria-valuemax={duration}
          aria-valuenow={clip.end}
          aria-valuetext={formatTime(clip.end)}
          data-drag="end"
          onPointerDown={beginDrag}
          onKeyDown={keys((step) => withEnd(clip.end + step))}
          className="focus-visible:ring-ring/50 absolute inset-y-0 -right-4 w-6 cursor-ew-resize rounded-md outline-none focus-visible:ring-3"
        />
      </div>
    </div>
  );
}
