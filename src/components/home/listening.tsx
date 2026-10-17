"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// "Listening" mode on the home page: while the sample song plays, the page goes black and
// only the glowing figure and a now-playing corner (title, artist, pause) remain, until
// it's paused or ends. The provider owns the one <audio>, so every play button controls it.

type Listening = { playing: boolean; toggle: () => void };

const ListeningContext = createContext<Listening | null>(null);

export function ListeningProvider({ src, children }: { src: string; children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);

  // Stop when leaving the page.
  useEffect(() => () => audioRef.current?.pause(), []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) void audio.play().catch(() => setPlaying(false));
    else audio.pause();
  }

  return (
    <ListeningContext.Provider value={{ playing, toggle }}>
      {children}
      {/* Downloads only on the first press. */}
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </ListeningContext.Provider>
  );
}

/** The listening state and play/pause, or null outside a ListeningProvider. */
export function useListening() {
  return useContext(ListeningContext);
}

const FADE = "transition-opacity duration-700 ease-out motion-reduce:transition-none";

/** Black over the whole window (behind the page's content) while listening. */
export function ListeningBackdrop() {
  const playing = useListening()?.playing ?? false;
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none fixed inset-0 -z-10 bg-black", FADE, playing ? "opacity-100" : "opacity-0")}
    />
  );
}

/** Fades its contents out (and out of reach) while listening. */
export function HideWhileListening({ children, className }: { children: ReactNode; className?: string }) {
  const playing = useListening()?.playing ?? false;
  return (
    <div className={cn(FADE, playing && "opacity-0", className)} inert={playing}>
      {children}
    </div>
  );
}

/** Fades its contents in only while listening. */
export function ShowWhileListening({ children, className }: { children: ReactNode; className?: string }) {
  const playing = useListening()?.playing ?? false;
  return (
    <div aria-hidden className={cn("pointer-events-none", FADE, playing ? "opacity-100" : "opacity-0", className)}>
      {children}
    </div>
  );
}
