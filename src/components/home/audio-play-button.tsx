"use client";

import { useEffect, useRef, useState } from "react";
import { PauseIcon, PlayIcon } from "lucide-react";

/** The button's diameter in card units (the card is 390 wide); the title line is about 33. */
const SIZE = 26;
const u = (px: number) => `calc(var(--u) * ${px})`;

/**
 * A round play/pause button for a card, in the card's ink color. The file only downloads
 * on the first press. Meant for a CollectibleCard's `titleAccessory`.
 */
export function AudioPlayButton({ src, label }: { src: string; label: string }) {
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
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        aria-pressed={playing}
        className="flex shrink-0 items-center justify-center rounded-full text-(--ink) ring-1 ring-current transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current"
        style={{ width: u(SIZE), height: u(SIZE) }}
      >
        {playing ? (
          <PauseIcon className="fill-current" style={{ width: u(11), height: u(11) }} />
        ) : (
          // Nudged right so the triangle looks centered.
          <PlayIcon className="fill-current" style={{ width: u(11), height: u(11), marginLeft: u(1.5) }} />
        )}
      </button>
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
      />
    </>
  );
}
