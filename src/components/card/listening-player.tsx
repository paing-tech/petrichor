"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  ChevronDownIcon,
  PauseIcon,
  PlayIcon,
  Repeat1Icon,
  ScissorsIcon,
  SkipBackIcon,
} from "lucide-react";
import { motion } from "motion/react";
import {
  setMessageShown,
  useMessageShown,
} from "@/components/card/listening-store";
import { YouTubeSpace } from "@/components/card/youtube-space";
import { MarqueeText } from "@/components/ui/marquee-text";
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
  message,
  signature,
  clip,
  card,
  onClose,
}: {
  videoId: string;
  /** The video's width ÷ height (square to 16:9). */
  aspect: number;
  title: string;
  artist: string;
  /** The card's message and signature, shown when the small card is tapped. */
  message: string | null;
  signature: string | null;
  /**
   * The part of the song the creator chose (seconds): it starts there and stops (or, on
   * repeat, starts again) at its end, unless the listener switches to the whole song.
   */
  clip: { start: number; end: number } | null;
  /** The small card beside the title, when it isn't moved in from the page (see ListeningCard). */
  card?: ReactNode;
  onClose: () => void;
}) {
  const messageShown = useMessageShown();
  // Opens the full-screen space ("Immersive") with this same player.
  const space = useRef<{ open: () => void }>(null);
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
  // Playing the whole song instead of the chosen part.
  const [wholeSong, setWholeSong] = useState(false);
  const part = clip && !wholeSong ? clip : null;
  const partRef = useRef(part);
  useEffect(() => {
    partRef.current = part;
  });
  // When the part last ended, so its end isn't handled twice while the jump back takes effect.
  const partEndedAt = useRef(0);
  // The message appears as the chosen part begins (whole song or not); read by the handler below.
  const reveal = useRef({ clip, hasMessage: Boolean(message || signature) });
  useEffect(() => {
    reveal.current = { clip, hasMessage: Boolean(message || signature) };
  });
  const inPart = useRef(false);

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
      const current = partRef.current;
      // Ended (state 0) with repeat on: back to the start (of the part, if playing one), playing.
      if (info.playerState === 0 && repeatRef.current) {
        command("seekTo", [current?.start ?? 0, true]);
        command("playVideo");
      }
      // Entering the chosen part: the card's message drifts in, timed to the music.
      if (info.currentTime !== undefined && reveal.current.clip) {
        const { start, end } = reveal.current.clip;
        const inside = info.currentTime >= start && info.currentTime < end;
        if (inside && !inPart.current && reveal.current.hasMessage) setMessageShown(true);
        inPart.current = inside;
      }
      // The chosen part's end: again from its start on repeat; otherwise stop, ready to replay.
      if (
        current &&
        info.currentTime !== undefined &&
        info.currentTime >= current.end &&
        performance.now() - partEndedAt.current > 1000
      ) {
        partEndedAt.current = performance.now();
        command("seekTo", [current.start, true]);
        if (!repeatRef.current) command("pauseVideo");
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

  /** Jumps to a time in the song (outside the chosen part, that means the whole song now). */
  function seek(to: number) {
    const time = Math.min(playback.duration || to, Math.max(0, to));
    if (part && (time < part.start || time >= part.end)) setWholeSong(true);
    command("seekTo", [time, true]);
    setPlayback((p) => ({ ...p, time, at: performance.now() }));
  }

  /** Switches between the chosen part (from its start, playing) and the whole song. */
  function togglePart() {
    if (!clip) return;
    if (part) {
      setWholeSong(true);
      return;
    }
    setWholeSong(false);
    command("seekTo", [clip.start, true]);
    command("playVideo");
    setPlayback((p) => ({ ...p, time: clip.start, at: performance.now() }));
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
      {/* The top 56% (below the header): the video, centred. Square videos fill the width within
          the side margins; wider ones (16:9) reach the screen's edges. Either way it fits the
          half, and never drops below YouTube's 200px minimum. */}
      <div className="h-[56dvh] shrink-0 pt-16">
        <div className="grid size-full place-items-center [container-type:size]">
          {/* The player lives in the full-screen space's component, so "Immersive" can move this
              very player into the space and back without the song restarting. */}
          <YouTubeSpace
            videoId={videoId}
            title={`${title} by ${artist} on YouTube`}
            songTitle={title}
            artist={artist}
            showInline
            autoplay
            // Starts at the chosen part (fixed, so switching to the whole song never reloads it).
            startSeconds={clip?.start}
            trigger={() => null}
            playerRef={iframeRef}
            handleRef={space}
            inlineClassName={
              aspect <= SQUARE_UP_TO ? "rounded-none" : "sm:rounded-xl"
            }
            inlineStyle={{
              aspectRatio: aspect,
              width: `max(${MIN_PLAYER_HEIGHT * aspect}px, min(${aspect <= SQUARE_UP_TO ? "100cqw - 1.5rem" : "100cqw"}, (100cqh - 1rem) * ${aspect}))`,
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
        <div
          className={cn(
            "flex gap-4",
            // The song sits at the card's foot; with the message, the column runs the card's
            // height (or more, for a long note) so the note starts at its top.
            messageShown ? "items-stretch" : "items-end",
          )}
        >
          {messageShown ? (
            // The message: the note drifts out from the card, line by line, signed at the end,
            // and the song shrinks in place to one quiet line at the card's foot. Tap to fold it.
            <button
              type="button"
              onClick={() => setMessageShown(false)}
              aria-label="Hide the message"
              className="flex min-w-0 flex-1 flex-col justify-between gap-4 text-left"
            >
              <div className="max-h-[24dvh] overflow-y-auto">
                {(message ?? "").split("\n").map((line, i) => (
                  <motion.p
                    key={i}
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay: 0.1 + i * 0.1,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="font-hand min-h-[1.4em] text-lg leading-snug"
                  >
                    {line}
                  </motion.p>
                ))}
                {!message && !signature && (
                  <p className="text-sm text-white/50">
                    There&apos;s no message on this card.
                  </p>
                )}
                {signature && (
                  <motion.p
                    initial={{ opacity: 0, x: 24 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{
                      delay:
                        0.2 + (message ? message.split("\n").length : 0) * 0.1,
                      duration: 0.5,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    // A sign-off right under the note: left, softer and a little smaller.
                    className="font-hand mt-1.5 text-base text-white/60"
                  >
                    — {signature}
                  </motion.p>
                )}
              </div>
              {/* Where the artist was, on the card's bottom edge (same baseline trim). */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="font-outfit -mb-[0.3rem] text-sm text-white/60"
              >
                <MarqueeText>
                  {title} · {artist}
                </MarqueeText>
              </motion.div>
            </button>
          ) : (
            <motion.div
              initial={false}
              animate={{ opacity: 1 }}
              className="min-w-0 flex-1"
            >
              {/* Long titles scroll in a loop so the whole name can be read. */}
              <MarqueeText className="font-serif text-3xl leading-tight tracking-tight">
                {title}
              </MarqueeText>
              {/* The negative bottom margin drops the line box's space below the letters, so the
                  artist's baseline sits exactly on the card's bottom edge. */}
              <p className="font-outfit mt-0.5 -mb-[0.3rem] truncate text-sm text-white/70">
                {artist}
              </p>
            </motion.div>
          )}
          {/* The keepsake card moves in here (see ListeningCard), or is given. */}
          <div id={LISTENING_CARD_SLOT} className="w-28 shrink-0">
            {card}
          </div>
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
            <div className="relative h-1 w-full overflow-hidden rounded-full bg-white/20">
              <div
                className="h-full bg-white"
                style={{ width: `${progress * 100}%` }}
              />
              {/* The chosen part, in red along the song (fainter while the whole song plays). */}
              {clip && playback.duration > 0 && (
                <div
                  aria-hidden
                  className={cn("absolute inset-y-0", part ? "bg-red-500" : "bg-red-500/50")}
                  style={{
                    left: `${(clip.start / playback.duration) * 100}%`,
                    width: `${((Math.min(clip.end, playback.duration) - clip.start) / playback.duration) * 100}%`,
                  }}
                />
              )}
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

        <div className="flex items-center justify-center gap-4">
          {/* The full-screen night-sky space, with the song carrying on. */}
          <button
            type="button"
            onClick={() => space.current?.open()}
            className={cn(CONTROL, "gap-2 px-3 py-1.5 text-sm text-white/70")}
          >
            <ImmersiveIcon className="size-5" /> Immersive
          </button>
          {/* The creator's chosen part, or the whole song. */}
          {clip && (
            <button
              type="button"
              onClick={togglePart}
              aria-label={
                part
                  ? "Play the whole song"
                  : `Play the clip, ${formatTime(clip.start)} to ${formatTime(clip.end)}`
              }
              className={cn(CONTROL, "gap-2 px-3 py-1.5 text-sm text-white/70")}
            >
              <ScissorsIcon className="size-4" />
              {part ? "Whole song" : `${formatTime(clip.start)}–${formatTime(clip.end)}`}
            </button>
          )}
        </div>

        {/* Restart, play / pause, repeat: centred, the play button largest. */}
        <div className="flex items-center justify-center gap-12">
          <button
            type="button"
            onClick={() => {
              seek(part?.start ?? 0);
              command("playVideo");
            }}
            aria-label={part ? "Restart the clip" : "Restart"}
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

/** Google's Material "360" icon (Apache 2.0): an arrow circling round, for the immersive view. */
function ImmersiveIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M12 7C6.48 7 2 9.24 2 12c0 2.24 2.94 4.13 7 4.77V20l4-4-4-4v2.73c-3.15-.56-5-1.9-5-2.73 0-1.06 3.04-3 8-3s8 1.94 8 3c0 .73-1.46 1.89-4 2.53v2.05c3.53-.77 6-2.53 6-4.58 0-2.76-4.48-5-10-5z" />
    </svg>
  );
}
