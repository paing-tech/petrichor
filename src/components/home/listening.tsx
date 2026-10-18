"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { Starfield } from "@/components/home/starfield";
import { cn } from "@/lib/utils";

// "Listening" mode on the home page: while a song plays, the page becomes a night sky with
// only the glowing figure (drifting upward) and a now-playing corner (title, artist,
// controls, progress). When the song is paused or ends, the sky stays while she settles
// back down, then the page returns. The provider owns the one <audio> and the track list,
// so every control drives the same player.

/** How long she takes to rise while the song plays. */
export const RISE_MS = 20000;
/** How long she takes to settle back down after the song stops; then the page returns. */
const SETTLE_MS = 1000;
/** Pressing "previous" this far into a song restarts it instead of going back a track. */
const RESTART_AFTER_S = 3;

export type Track = { src: string; title: string; artist: string };

type Listening = {
  /** The song is playing. */
  playing: boolean;
  /** Night-sky mode: playing, or settling back down after it stopped. */
  dark: boolean;
  track: Track;
  hasNext: boolean;
  toggle: () => void;
  /** Restarts the song if it's a few seconds in, otherwise goes to the previous track. */
  previous: () => void;
  next: () => void;
  /** The player itself, for reading progress. */
  audio: () => HTMLAudioElement | null;
};

const ListeningContext = createContext<Listening | null>(null);

export function ListeningProvider({
  tracks,
  children,
}: {
  tracks: Track[];
  children: ReactNode;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settling, setSettling] = useState(false);
  const dark = playing || settling;
  const settleTimer = useRef<number>(undefined);
  // Set while switching tracks, so the brief pause that causes doesn't end listening mode.
  const switching = useRef(false);
  const track = tracks[index];

  // Flags the page so things outside the home page (the site header) can follow the sky.
  useEffect(() => {
    document.documentElement.toggleAttribute("data-listening", dark);
    // The phone's browser bars (and status bar) follow the page: black with the night sky.
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const day = theme?.content;
    if (theme && dark) theme.content = "#000000";
    return () => {
      document.documentElement.removeAttribute("data-listening");
      if (theme && day) theme.content = day;
    };
  }, [dark]);

  // Stop when leaving the page.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  function started() {
    switching.current = false;
    window.clearTimeout(settleTimer.current);
    setSettling(false);
    setPlaying(true);
  }

  function stopped() {
    if (switching.current) return;
    setPlaying(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSettling(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(
      () => setSettling(false),
      SETTLE_MS,
    );
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  /** Switches to another track, carrying on playing if this one was. */
  function goTo(nextIndex: number) {
    const audio = audioRef.current;
    if (!audio) return;
    const wasPlaying = !audio.paused;
    switching.current = wasPlaying;
    audio.src = tracks[nextIndex].src;
    setIndex(nextIndex);
    if (wasPlaying) void audio.play().catch(() => stopped());
  }

  function previous() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.currentTime > RESTART_AFTER_S || index === 0)
      audio.currentTime = 0;
    else goTo(index - 1);
  }

  function next() {
    if (index < tracks.length - 1) goTo(index + 1);
  }

  function ended() {
    // Play on through the list; stop after the last song.
    if (index < tracks.length - 1) {
      switching.current = true;
      const audio = audioRef.current!;
      audio.src = tracks[index + 1].src;
      setIndex(index + 1);
      void audio.play().catch(() => stopped());
    } else stopped();
  }

  return (
    <ListeningContext.Provider
      value={{
        playing,
        dark,
        track,
        hasNext: index < tracks.length - 1,
        toggle,
        previous,
        next,
        audio: () => audioRef.current,
      }}
    >
      {children}
      {/* Downloads only on the first press. */}
      <audio
        ref={audioRef}
        src={tracks[0].src}
        preload="none"
        onPlay={started}
        onPause={stopped}
        onEnded={ended}
      />
    </ListeningContext.Provider>
  );
}

/** The listening state and play/pause, or null outside a ListeningProvider. */
export function useListening() {
  return useContext(ListeningContext);
}

const FADE =
  "transition-opacity duration-700 ease-out motion-reduce:transition-none";

/** A starry black sky over the whole window (behind the page's content) while listening. */
export function ListeningBackdrop() {
  const playing = useListening()?.dark ?? false;
  return (
    <div
      aria-hidden
      className={cn(
        "pointer-events-none fixed inset-0 -z-10 bg-black",
        FADE,
        playing ? "opacity-100" : "opacity-0",
      )}
    >
      <Starfield active={playing} />
    </div>
  );
}

/** Drifts its contents slowly upward while the song plays, and back down when it stops. */
export function FloatWhileListening({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const playing = useListening()?.playing ?? false;
  return (
    <div
      className={cn(
        "transition-[translate] ease-in-out motion-reduce:transition-none",
        playing ? "-translate-y-[10%]" : "translate-y-0",
        className,
      )}
      style={{ transitionDuration: `${playing ? RISE_MS : SETTLE_MS}ms` }}
    >
      {children}
    </div>
  );
}

/** Brightness at the peak of each pulse (1 is normal). */
const PULSE_BRIGHTNESS = 2;
/** After the rise, one pulse: bright → normal → bright (not counting the pause). */
const PULSE_MS = 12000;
/** How long each pulse rests at normal brightness before brightening again. */
const PULSE_REST_MS = 4000;

/**
 * While the song plays, brightens its contents in step with the rise (normal → brightest as
 * she reaches the top, over RISE_MS with the same easing), then pulses: slowly back to
 * normal and up to brightest again, over and over. When it stops, eases back to normal from
 * wherever it was, over SETTLE_MS.
 */
/**
 * Brightens an element in step with her rise (normal → brightest over RISE_MS, the rise's
 * easing), then pulses: slowly back to normal, a rest, and up again, over and over. Returns a
 * handle to stop it. Shared by the home page and the card page's full-screen space.
 */
export function brightenAndPulse(el: HTMLElement) {
  const bright = `brightness(${PULSE_BRIGHTNESS})`;
  let animation: Animation = el.animate([{ filter: "brightness(1)" }, { filter: bright }], {
    duration: RISE_MS,
    // Tailwind's ease-in-out (FloatWhileListening's curve), so brightness tracks height.
    easing: "cubic-bezier(0.4, 0, 0.2, 1)",
    fill: "forwards",
  });
  const rise = animation;
  rise.onfinish = () => {
    if (animation !== rise) return;
    // Dim to normal, rest there, brighten again; each stretch eases in and out.
    const cycle = PULSE_MS + PULSE_REST_MS;
    const dimmed = PULSE_MS / 2 / cycle;
    const rested = (PULSE_MS / 2 + PULSE_REST_MS) / cycle;
    animation = el.animate(
      [
        { filter: bright, offset: 0, easing: "ease-in-out" },
        { filter: "brightness(1)", offset: dimmed },
        { filter: "brightness(1)", offset: rested, easing: "ease-in-out" },
        { filter: bright, offset: 1 },
      ],
      { duration: cycle, iterations: Infinity },
    );
    rise.cancel();
  };
  return {
    stop: () => {
      animation.cancel();
    },
  };
}

export function BrightenWhileListening({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const playing = useListening()?.playing ?? false;
  const ref = useRef<HTMLDivElement>(null);
  const pulse = useRef<ReturnType<typeof brightenAndPulse> | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches)
      return;
    if (playing) {
      pulse.current = brightenAndPulse(el);
    } else if (pulse.current) {
      // Hand over from the pulse's current brightness to a smooth fade back to normal.
      const current = getComputedStyle(el).filter;
      pulse.current.stop();
      pulse.current = null;
      el.animate([{ filter: current }, { filter: "brightness(1)" }], {
        duration: SETTLE_MS,
        easing: "ease-out",
      });
    }
  }, [playing]);

  useEffect(() => () => pulse.current?.stop(), []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

/** Fades its contents out (and out of reach) while listening. */
export function HideWhileListening({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const playing = useListening()?.dark ?? false;
  return (
    <div
      className={cn(FADE, playing && "opacity-0", className)}
      inert={playing}
    >
      {children}
    </div>
  );
}

/** How long the fade slides back as the card returns over her (FADE's 700ms). */
const COVER_MS = 700;

/**
 * Sets `--reveal` for its contents: 0% normally, 60% in night-sky mode. The fade disappears
 * at once when the song starts (her whole body shows as the card fades away), stays gone
 * while she settles back down, then slides back with the card (COVER_MS). Add it to a
 * mask's gradient stops to push a fade-out past the bottom of the image.
 */
export function RevealWhileListening({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const dark = useListening()?.dark ?? false;
  return (
    <div
      className={cn("ease-out motion-reduce:transition-none", className)}
      style={
        {
          "--reveal": dark ? "60%" : "0%",
          transitionProperty: "--reveal",
          transitionDuration: `${dark ? 0 : COVER_MS}ms`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
