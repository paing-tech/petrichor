"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Starfield } from "@/components/home/starfield";
import { cn } from "@/lib/utils";

// "Listening" mode on the home page: while the sample song plays, the page becomes a night
// sky with only the glowing figure (drifting upward) and a now-playing corner (title,
// artist, pause). When the song is paused or ends, the sky stays while she settles back
// down, then the page returns. The provider owns the one <audio>, so every play button
// controls it.

/** How long she takes to settle back down after the song stops. */
const SETTLE_MS = 5000;

type Listening = {
  /** The song is playing. */
  playing: boolean;
  /** Night-sky mode: playing, or settling back down after it stopped. */
  dark: boolean;
  toggle: () => void;
};

const ListeningContext = createContext<Listening | null>(null);

export function ListeningProvider({ src, children }: { src: string; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [settling, setSettling] = useState(false);
  const settleTimer = useRef<number>(undefined);

  // Stop when leaving the page.
  useEffect(
    () => () => {
      audioRef.current?.pause();
      window.clearTimeout(settleTimer.current);
    },
    [],
  );

  function started() {
    window.clearTimeout(settleTimer.current);
    setSettling(false);
    setPlaying(true);
  }

  function stopped() {
    setPlaying(false);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setSettling(true);
    window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setSettling(false), SETTLE_MS);
  }

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  return (
    <ListeningContext.Provider value={{ playing, dark: playing || settling, toggle }}>
      {children}
      {/* Downloads only on the first press. */}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={started}
        onPause={stopped}
        onEnded={stopped}
      />
    </ListeningContext.Provider>
  );
}

/** The listening state and play/pause, or null outside a ListeningProvider. */
export function useListening() {
  return useContext(ListeningContext);
}

const FADE = "transition-opacity duration-700 ease-out motion-reduce:transition-none";

/** A starry black sky over the whole window (behind the page's content) while listening. */
export function ListeningBackdrop() {
  const playing = useListening()?.dark ?? false;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 bg-black", FADE, playing ? "opacity-100" : "opacity-0")}
    >
      <Starfield active={playing} />
    </div>
  );
}

/**
 * Drifts its contents slowly upward while the song plays (12s), and lets them settle back
 * down (the same SETTLE_MS) when it's paused or ends.
 */
export function FloatWhileListening({ children, className }: { children: ReactNode; className?: string }) {
  const playing = useListening()?.playing ?? false;
  return (
    <div
      className={cn(
        "transition-[translate] ease-in-out motion-reduce:transition-none",
        playing ? "-translate-y-[6%] duration-[12000ms]" : "translate-y-0 duration-[5000ms]", // 5000 = SETTLE_MS
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Fades its contents out (and out of reach) while listening. */
export function HideWhileListening({ children, className }: { children: ReactNode; className?: string }) {
  const playing = useListening()?.dark ?? false;
  return (
    <div className={cn(FADE, playing && "opacity-0", className)} inert={playing}>
      {children}
    </div>
  );
}

/** Fades its contents in only while listening. */
export function ShowWhileListening({ children, className }: { children: ReactNode; className?: string }) {
  const playing = useListening()?.dark ?? false;
  return (
    <div aria-hidden className={cn("pointer-events-none", FADE, playing ? "opacity-100" : "opacity-0", className)}>
      {children}
    </div>
  );
}
