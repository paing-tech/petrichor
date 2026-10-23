"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Scroll speed, in px per second. */
const SPEED = 18;
/** Share of each pass spent paused at an end (the animation holds at both ends). */
const PAUSE_SHARE = 0.3;

/**
 * One line of text that, when it's too long for its space, slides back and forth so the whole
 * of it can be read: from its start to its end, a pause, back to its start, a pause, and again.
 * When it fits it simply sits still. With reduced motion it stays still and is cut at the edge.
 */
export function MarqueeText({ children, className }: { children: ReactNode; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const text = useRef<HTMLSpanElement>(null);
  // How far the text has to move to show its end (0 when it fits).
  const [distance, setDistance] = useState(0);

  useEffect(() => {
    const measure = () => {
      const width = text.current?.offsetWidth ?? 0;
      const space = box.current?.clientWidth ?? 0;
      setDistance(Math.max(0, width - space));
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (box.current) observer.observe(box.current);
    if (text.current) observer.observe(text.current);
    return () => observer.disconnect();
  }, [children]);

  const scrolling = distance > 1;
  return (
    <div
      ref={box}
      className={cn(
        "overflow-hidden whitespace-nowrap",
        // Soft edges while it moves, so letters slide in and out rather than being cut.
        scrolling && "[mask-image:linear-gradient(to_right,transparent,black_6px,black_calc(100%-12px),transparent)]",
        className,
      )}
    >
      <span
        ref={text}
        className={cn("inline-block", scrolling && "animate-marquee motion-reduce:animate-none")}
        style={
          scrolling
            ? ({
                "--marquee-distance": `-${distance}px`,
                "--marquee-duration": `${distance / SPEED / (1 - PAUSE_SHARE)}s`,
              } as CSSProperties)
            : undefined
        }
      >
        {children}
      </span>
    </div>
  );
}
