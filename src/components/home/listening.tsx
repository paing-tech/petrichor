"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// "Listening" mode on the home page: while the sample song plays, the page goes black and
// only the glowing figure, the song title and the artist stay, until it's paused.

type Listening = { playing: boolean; setPlaying: (playing: boolean) => void };

const ListeningContext = createContext<Listening | null>(null);

export function ListeningProvider({ children }: { children: ReactNode }) {
  const [playing, setPlaying] = useState(false);
  return <ListeningContext.Provider value={{ playing, setPlaying }}>{children}</ListeningContext.Provider>;
}

/** The listening state, or null outside a ListeningProvider. */
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
