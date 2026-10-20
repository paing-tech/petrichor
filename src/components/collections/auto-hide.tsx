"use client";

import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Controls fade away after this long without a tap, a key or a mouse move. */
const IDLE_MS = 3000;

/**
 * Wraps controls over the wall so they fade away when left alone, leaving just the photos;
 * any tap anywhere, a key, or moving the mouse brings them back and restarts the wait.
 */
export function AutoHide({ className, children }: { className?: string; children: ReactNode }) {
  const [shown, setShown] = useState(true);

  useEffect(() => {
    let timer = 0;
    const wake = () => {
      setShown(true);
      window.clearTimeout(timer);
      timer = window.setTimeout(() => setShown(false), IDLE_MS);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === "mouse") wake();
    };
    timer = window.setTimeout(() => setShown(false), IDLE_MS);
    window.addEventListener("pointerdown", wake);
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("keydown", wake);
    window.addEventListener("pointermove", onPointerMove);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("pointerdown", wake);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("keydown", wake);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return (
    <div
      // Hidden controls can't be tapped (visibility switches off once the fade ends).
      className={cn("transition-[opacity,visibility] duration-500", !shown && "invisible opacity-0", className)}
      aria-hidden={!shown}
    >
      {children}
    </div>
  );
}
