"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  SkipBackIcon,
} from "lucide-react";
import { useOrigin } from "@/components/share-actions";
import { cn } from "@/lib/utils";

/** Where the keepsake card sits while listening (ListeningCard moves it here). */
export const LISTENING_CARD_SLOT = "listening-card-slot";

/** The player's buttons: plain icons, like the home page's now-playing controls. */
const CONTROL =
  "flex items-center justify-center rounded-full transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white";

/** YouTube requires its player to be at least 200px tall (and wide). */
const MIN_PLAYER_HEIGHT = 200;
/** Videos about this square or squarer are shown as squares (art tracks). */
const SQUARE_UP_TO = 1.05;

const formatTime = (seconds: number) => {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

type Playback = {
  playing: boolean;
  time: number;
  at: number;
  duration: number;
};

/**
 * Listening mode's player, laid out like a music player: the song's YouTube video in the top
 * half, and below it the title and artist (with the keepsake card beside them), a progress bar
 * to seek, and centred skip-back / play-pause / skip-ahead controls; a chevron closes it. The
 * controls sit outside the video and work it through YouTube's player messages (the IFrame
 * API), which YouTube allows; the video itself stays visible and is never covered.
 */
export function ListeningPlayer({
  videoId,
  aspect,
  title,
  artist,
  onClose,
}: {
  videoId: string;
  /** The video's width ÷ height (square to 16:9). */
  aspect: number;
  title: string;
  artist: string;
  onClose: () => void;
}) {
  const origin = useOrigin();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // What YouTube last reported: playing or not, the time then (and when we heard), the length.
  const [playback, setPlayback] = useState<Playback>({
    playing: false,
    time: 0,
    at: 0,
    duration: 0,
  });
  // While dragging the progress bar, the time being chosen.
  const [scrubbing, setScrubbing] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  // Repeat: when the song ends, it starts again.
  const [repeat, setRepeat] = useState(false);
  const repeatRef = useRef(repeat);
  useEffect(() => {
    repeatRef.current = repeat;
  }, [repeat]);

  const command = (func: string, args: unknown[] = []) =>
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );

  // Hear the player's state (play / pause, time, length).
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      let data: {
        event?: string;
        info?: {
          playerState?: number;
          currentTime?: number;
          duration?: number;
        };
      };
      try {
        data =
          typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      } catch {
        return;
      }
      const info = data?.info;
      if (!info) return;
      // Ended (state 0) with repeat on: back to the start, playing.
      if (info.playerState === 0 && repeatRef.current) {
        command("seekTo", [0, true]);
        command("playVideo");
      }
      setPlayback((current) => ({
        playing:
          info.playerState === undefined
            ? current.playing
            : info.playerState === 1,
        time: info.currentTime ?? current.time,
        at: info.currentTime !== undefined ? performance.now() : current.at,
        duration: info.duration || current.duration,
      }));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // While playing, move the time along smoothly between YouTube's updates.
  useEffect(() => {
    if (!playback.playing) return;
    let frame = 0;
    const tick = () => {
      setNow(performance.now());
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playback.playing]);


  const elapsed = Math.min(
    playback.duration || Infinity,
    playback.playing
      ? playback.time + Math.max(0, now - playback.at) / 1000
      : playback.time,
  );
  const shown = scrubbing ?? elapsed;
  const progress = playback.duration
    ? Math.min(1, shown / playback.duration)
    : 0;

  /** Jumps to a time in the song. */
  function seek(to: number) {
    const time = Math.min(playback.duration || to, Math.max(0, to));
    command("seekTo", [time, true]);
    setPlayback((p) => ({ ...p, time, at: performance.now() }));
  }

  /** The time under the pointer, along the progress bar. */
  function timeAt(event: ReactPointerEvent<HTMLDivElement>) {
    const bar = event.currentTarget.getBoundingClientRect();
    return (
      Math.min(1, Math.max(0, (event.clientX - bar.left) / bar.width)) *
      playback.duration
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex flex-col text-white">
      {/* The top half (below the header): the video, centred. Square videos fill the width within
          the side margins; wider ones (16:9) reach the screen's edges. Either way it fits the
          half, and never drops below YouTube's 200px minimum. */}
      <div className="h-[50dvh] shrink-0 pt-16">
        <div className="grid size-full place-items-center [container-type:size]">
          <iframe
            ref={iframeRef}
            src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1&autoplay=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`}
            title={`${title} by ${artist} on YouTube`}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            // Ask the player to report its state (play / pause, time, length) to this page.
            onLoad={() =>
              iframeRef.current?.contentWindow?.postMessage(
                JSON.stringify({ event: "listening", id: videoId }),
                "*",
              )
            }
            className={cn(
              "border-0 bg-black",
              aspect <= SQUARE_UP_TO ? "rounded-xl" : "sm:rounded-xl",
            )}
            style={{
              aspectRatio: aspect,
              width: `max(${MIN_PLAYER_HEIGHT * aspect}px, min(${aspect <= SQUARE_UP_TO ? "100cqw - 3rem" : "100cqw"}, (100cqh - 1rem) * ${aspect}))`,
            }}
          />
        </div>
      </div>

      {/* Close, top-left, level with the wordmark: "down", as when minimising a player. */}
      <button
        type="button"
        onClick={onClose}
        aria-label="Close player"
        className={cn(
          CONTROL,
          "absolute top-[max(0.75rem,env(safe-area-inset-top))] left-3 size-10",
        )}
      >
        <ChevronDownIcon className="size-7" />
      </button>

      {/* The bottom half: the song (and its card), the progress bar, the controls. */}
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-evenly px-6 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-3xl leading-tight tracking-tight">
              {title}
            </p>
            <p className="font-outfit mt-0.5 truncate text-sm text-white/70">
              {artist}
            </p>
          </div>
          {/* The keepsake card moves in here (see ListeningCard). */}
          <div id={LISTENING_CARD_SLOT} className="w-20 shrink-0" />
        </div>

        {/* Tap or drag to move through the song. */}
        <div>
          <div
            role="slider"
            aria-label="Song position"
            aria-valuemin={0}
            aria-valuemax={Math.round(playback.duration)}
            aria-valuenow={Math.round(shown)}
            aria-valuetext={`${formatTime(shown)} of ${formatTime(playback.duration)}`}
            tabIndex={0}
            onKeyDown={(event) => {
              if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                return;
              seek(elapsed + (event.key === "ArrowRight" ? 5 : -5));
            }}
            onPointerDown={(event) => {
              if (!playback.duration) return;
              event.currentTarget.setPointerCapture(event.pointerId);
              setScrubbing(timeAt(event));
            }}
            onPointerMove={(event) => {
              if (scrubbing !== null) setScrubbing(timeAt(event));
            }}
            onPointerUp={(event) => {
              if (scrubbing === null) return;
              seek(timeAt(event));
              setScrubbing(null);
            }}
            onPointerCancel={() => setScrubbing(null)}
            className="group relative flex h-6 cursor-pointer touch-none items-center"
          >
            <div className="h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <div
              aria-hidden
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white"
              style={{ left: `${progress * 100}%` }}
            />
          </div>
          <div className="font-outfit flex justify-between text-xs text-white/60 tabular-nums">
            <span>{formatTime(shown)}</span>
            <span>
              {playback.duration ? formatTime(playback.duration) : "–:––"}
            </span>
          </div>
        </div>

        {/* Restart, play / pause, repeat: centred, the play button largest. */}
        <div className="flex items-center justify-center gap-12">
          <button
            type="button"
            onClick={() => {
              seek(0);
              command("playVideo");
            }}
            aria-label="Restart"
            className={cn(CONTROL, "size-12")}
          >
            <SkipBackIcon className="size-7 fill-current" />
          </button>
          <button
            type="button"
            onClick={() =>
              command(playback.playing ? "pauseVideo" : "playVideo")
            }
            aria-label={playback.playing ? "Pause" : "Play"}
            className={cn(CONTROL, "size-16")}
          >
            {playback.playing ? (
              <PauseIcon className="size-11 fill-current" />
            ) : (
              // Nudged right so the triangle looks centred.
              <PlayIcon className="ml-1 size-11 fill-current" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setRepeat((on) => !on)}
            aria-label="Repeat"
            aria-pressed={repeat}
            // Faint when off, white when on.
            className={cn(CONTROL, "size-12", !repeat && "text-white/40")}
          >
            <Repeat1Icon className="size-7" />
          </button>
        </div>
      </div>
    </div>
  );
}
