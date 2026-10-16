"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";
import { useListening } from "@/components/home/listening";
import { cn } from "@/lib/utils";

/** Furthest the artwork turns toward the cursor, in degrees. */
const MAX_TILT = 4;
/** How deep the 3D space is; smaller numbers exaggerate the tilt. */
const PERSPECTIVE = 1000;

/**
 * Tilts its contents toward a mouse cursor, like turning a card in your hand, with a soft
 * light that follows the cursor. Mouse only (touch screens have no hover), and still for
 * anyone who prefers reduced motion or while the home page's song plays (the light would
 * show as a gray box on the black).
 */
export function TiltArtwork({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listening = useListening()?.playing ?? false;

  // Settle flat as soon as the song starts.
  useEffect(() => {
    if (listening) leave();
  }, [listening]);

  function move(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || listening) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    // Cursor position across the artwork, 0…1.
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--tilt-x", `${(0.5 - y) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--tilt-y", `${(x - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--light-x", `${x * 100}%`);
    el.style.setProperty("--light-y", `${y * 100}%`);
    el.dataset.tilting = "true";
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    delete el.dataset.tilting;
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      // Eases back slowly when the cursor leaves, follows quickly while it moves.
      className={cn(
        "group transition-transform duration-500 ease-out will-change-transform data-tilting:duration-100",
        className,
      )}
      style={{
        ...style,
        transform: `perspective(${PERSPECTIVE}px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))`,
      }}
    >
      {children}
      {/* The light: brightens what's under the cursor; on plain white it changes nothing. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-500 group-data-tilting:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--light-x, 50%) var(--light-y, 50%), rgba(255, 255, 255, 0.55), transparent 55%)",
        }}
      />
    </div>
  );
}
