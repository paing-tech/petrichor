"use client";

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { PauseIcon, PlayIcon, ScissorsIcon, XIcon } from "lucide-react";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CLIP_MIN_SECONDS } from "@/lib/validation";

export type ClipRange = { start: number; end: number };

/** The part picked when the picker opens: the song's first half minute (or all of a shorter one). */
const DEFAULT_LENGTH = 30;

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

/**
 * On the preview: lets the creator choose the part of the song the card plays, on the YouTube
 * video it will play. Closed, it's one button; opened, it loads the video (YouTube's player,
 * at least 200px tall) with a bar beneath it whose two handles mark the start and end, and
 * "Start here" / "End here" to set them from wherever the video is. "Play part" plays just the
 * chosen part. Times are whole seconds.
 */
export function SongClipPicker({
  videoId,
  title,
  clip,
  onChange,
}: {
  videoId: string;
  title: string;
  clip: ClipRange | null;
  onChange: (clip: ClipRange | null) => void;
}) {
  const origin = useOrigin();
  const [open, setOpen] = useState(clip !== null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
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

  // Hear the player: its length (then pick the opening part), the time, playing or not.
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
        if (!current) change({ start: 0, end: Math.min(DEFAULT_LENGTH, length) });
        else if (current.end > length) change({ start: Math.min(current.start, length - CLIP_MIN_SECONDS), end: length });
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
      <Button type="button" variant="outline" size="lg" className="bg-background h-11 w-full" onClick={() => setOpen(true)}>
        <ScissorsIcon /> Choose a part of the song
      </Button>
    );
  }

  const ready = duration > 0 && clip !== null;
  const at = (seconds: number) => `${duration ? (seconds / duration) * 100 : 0}%`;

  function setStart(seconds: number) {
    if (!clip) return;
    onChange({ ...clip, start: Math.max(0, Math.min(Math.round(seconds), clip.end - CLIP_MIN_SECONDS)) });
  }
  function setEnd(seconds: number) {
    if (!clip) return;
    onChange({ ...clip, end: Math.min(duration, Math.max(Math.round(seconds), clip.start + CLIP_MIN_SECONDS)) });
  }
  function timeAt(event: ReactPointerEvent) {
    const bar = barRef.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (event.clientX - bar.left) / bar.width)) * duration;
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
  function remove() {
    command("pauseVideo");
    onChange(null);
    setOpen(false);
  }

  return (
    <section aria-labelledby="clip-picker-title" className="w-full rounded-2xl border p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="clip-picker-title" className="font-medium">
            The part of the song to play
          </h2>
          <p className="text-muted-foreground mt-1">Drag the handles, or play the video and set the start and end.</p>
        </div>
        <Button type="button" variant="ghost" size="icon" aria-label="Play the whole song instead" onClick={remove}>
          <XIcon />
        </Button>
      </div>

      {/* YouTube's player, 16:9 and never under its 200px minimum height. */}
      <iframe
        ref={iframeRef}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`}
        title={`${title} on YouTube`}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        onLoad={() => iframeRef.current?.contentWindow?.postMessage(JSON.stringify({ event: "listening", id: videoId }), "*")}
        className="mt-3 block aspect-video min-h-[200px] w-full rounded-lg border-0 bg-black"
      />

      {/* The song as a bar: the chosen part highlighted between its two handles, and where the
          video is now as a thin line. */}
      <div ref={barRef} className={cn("relative mt-4 h-8 touch-none", !ready && "opacity-40")}>
        <div className="bg-muted absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full" />
        {ready && (
          <>
            <div
              className="bg-foreground absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
              style={{ left: at(clip.start), width: `calc(${at(clip.end)} - ${at(clip.start)})` }}
            />
            <div aria-hidden className="bg-foreground/50 absolute top-1 bottom-1 w-px" style={{ left: at(time) }} />
            <Handle side="start" label="Start" value={clip.start} max={duration} left={at(clip.start)} onMove={(e) => setStart(timeAt(e))} onStep={(d) => setStart(clip.start + d)} />
            <Handle side="end" label="End" value={clip.end} max={duration} left={at(clip.end)} onMove={(e) => setEnd(timeAt(e))} onStep={(d) => setEnd(clip.end + d)} />
          </>
        )}
      </div>

      <p className="font-outfit mt-1 text-center tabular-nums">
        {ready ? (
          <>
            {formatTime(clip.start)} – {formatTime(clip.end)}{" "}
            <span className="text-muted-foreground">· {Math.round(clip.end - clip.start)}s</span>
          </>
        ) : (
          <span className="text-muted-foreground">Loading the video…</span>
        )}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Button type="button" variant="outline" className="h-10" disabled={!ready} onClick={() => setStart(time)}>
          Start here
        </Button>
        <Button type="button" className="h-10" disabled={!ready} onClick={playPart}>
          {previewing && playing ? <PauseIcon /> : <PlayIcon />} Play part
        </Button>
        <Button type="button" variant="outline" className="h-10" disabled={!ready} onClick={() => setEnd(time)}>
          End here
        </Button>
      </div>
    </section>
  );
}

/**
 * One of the bar's two handles, a trim grip just outside its edge of the part (the start's to
 * the left, the end's to the right), so the two never cover each other however short the part:
 * drag it, or use the arrow keys (a second at a time).
 */
function Handle({
  side,
  label,
  value,
  max,
  left,
  onMove,
  onStep,
}: {
  side: "start" | "end";
  label: string;
  value: number;
  max: number;
  left: string;
  onMove: (event: ReactPointerEvent) => void;
  onStep: (seconds: number) => void;
}) {
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={`${label} of the part`}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-valuetext={formatTime(value)}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft" || event.key === "ArrowDown") onStep(-1);
        else if (event.key === "ArrowRight" || event.key === "ArrowUp") onStep(1);
        else return;
        event.preventDefault();
      }}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId);
        onMove(event);
      }}
      onPointerMove={(event) => {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) onMove(event);
      }}
      // A 24 × 32px touch target around the grip.
      className={cn(
        "focus-visible:ring-ring/50 absolute top-1/2 flex h-8 w-6 -translate-y-1/2 cursor-grab items-center rounded-md outline-none focus-visible:ring-3 active:cursor-grabbing",
        side === "start" ? "-translate-x-full justify-end" : "justify-start",
      )}
      style={{ left }}
    >
      <span className="bg-foreground h-6 w-2 rounded-full shadow-sm" />
    </div>
  );
}
