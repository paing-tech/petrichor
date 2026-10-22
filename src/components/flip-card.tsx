"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { CardFace } from "@/components/collectible-card";
import { cn } from "@/lib/utils";

/**
 * Lets a surrounding view take over a FlipCard: which face shows, and what a tap does (e.g.
 * listening mode, where tapping the small card shows its message beside the player).
 */
export const FlipControlContext = createContext<{
  side: CardFace;
  onTap: () => void;
  label: string;
} | null>(null);

/**
 * A card with two faces (each a CollectibleCard: `face="front"` and `face="back"`) that turns
 * over in 3D. Tapping it flips it, unless `tapToFlip` is off (e.g. while framing the photo on
 * it); `side` / `onSideChange` let a parent control which face shows. With reduced motion it
 * switches without turning.
 */
export function FlipCard({
  front,
  back,
  className,
  side,
  onSideChange,
  tapToFlip = true,
  hint,
}: {
  front: ReactNode;
  back: ReactNode;
  className?: string;
  side?: CardFace;
  onSideChange?: (side: CardFace) => void;
  tapToFlip?: boolean;
  /** A line under the card until it's first flipped, e.g. "Tap the card to read the message". */
  hint?: string;
}) {
  const [ownSide, setOwnSide] = useState<CardFace>("front");
  const [flipped, setFlipped] = useState(false);
  const control = useContext(FlipControlContext);
  const current = control?.side ?? side ?? ownSide;

  function flip() {
    if (control) return control.onTap();
    const next = current === "front" ? "back" : "front";
    setOwnSide(next);
    setFlipped(true);
    onSideChange?.(next);
  }

  const faces = (
    <div
      className="relative transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] transform-3d motion-reduce:transition-none"
      style={{ transform: current === "back" ? "rotateY(180deg)" : undefined }}
    >
      <div className="backface-hidden" aria-hidden={current !== "front"}>
        {front}
      </div>
      <div className="absolute inset-0 rotate-y-180 backface-hidden" aria-hidden={current !== "back"}>
        {back}
      </div>
    </div>
  );

  return (
    <div className={cn("w-full", className)}>
      <div className="perspective-[1600px]">
        {tapToFlip ? (
          <button
            type="button"
            onClick={flip}
            aria-label={
              control?.label ?? (current === "front" ? "Flip the card to its back" : "Flip the card to its front")
            }
            className="block w-full cursor-pointer rounded-[6%] text-left focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {faces}
          </button>
        ) : (
          faces
        )}
      </div>
      {hint && tapToFlip && !flipped && (
        <p className="text-muted-foreground mt-3 text-center text-xs [html[data-listening]_&]:hidden">{hint}</p>
      )}
    </div>
  );
}
