"use client";

import {
  Fragment,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  animate,
  cubicBezier,
  motion,
  useMotionValue,
  useTransform,
  wrap,
  type MotionValue,
} from "motion/react";
import { cn } from "@/lib/utils";

/** How a drag's flick, or a scroll, glides to a stop. */
const GLIDE_EASE = cubicBezier(0.18, 0.71, 0.11, 1);
const GLIDE_SECONDS = 1;
/** How far a flick carries on, per px/s of speed when let go. */
const FLICK_POWER = 0.28;
/** How far a scroll moves the wall, per px of wheel movement. */
const WHEEL_SPEED = 2.7;
/** The flick's speed is measured over this last stretch of the drag (ms). */
const VELOCITY_WINDOW_MS = 100;

export type MasonryItem = { key: string; content: ReactNode };

/**
 * An endless masonry wall you drag (or scroll) in any direction. Columns of equal width sit
 * side by side, repeating sideways; each column repeats its own photos downwards on its own,
 * so every gap stays the same however long each column is.
 *
 * Sizes come from CSS variables set on it (e.g. through `className`): `--column-width` and
 * `--gap` (between columns, between photos, and where things repeat).
 */
export function InfiniteMasonry({
  columns,
  className,
}: {
  columns: MasonryItem[][];
  className?: string;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const firstSet = useRef<HTMLDivElement>(null);
  const [setWidth, setSetWidth] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  // Measure one set of columns (they repeat sideways every set) and the screen.
  useEffect(() => {
    const set = firstSet.current;
    if (!set) return;
    const observer = new ResizeObserver(() => setSetWidth(set.offsetWidth));
    observer.observe(set);
    const onResize = () => setViewport({ width: window.innerWidth, height: window.innerHeight });
    onResize();
    window.addEventListener("resize", onResize);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  // Scrolling (and sideways on trackpads) glides the wall.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      animate(y, y.get() - event.deltaY * WHEEL_SPEED, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
      if (event.deltaX) {
        animate(x, x.get() - event.deltaX * WHEEL_SPEED, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
      }
    };
    window.addEventListener("wheel", onWheel);
    return () => window.removeEventListener("wheel", onWheel);
  }, [x, y]);

  // Dragging moves the wall with the pointer; letting go of a flick glides on. The pointer
  // isn't captured, so a tap still reaches the photo under it.
  function onPointerDown(event: ReactPointerEvent) {
    if (event.button !== 0) return;
    x.stop();
    y.stop();
    const pointerId = event.pointerId;
    const start = { pointerX: event.clientX, pointerY: event.clientY, x: x.get(), y: y.get() };
    const samples = [{ time: performance.now(), x: event.clientX, y: event.clientY }];

    const onMove = (move: PointerEvent) => {
      if (move.pointerId !== pointerId) return;
      x.set(start.x + move.clientX - start.pointerX);
      y.set(start.y + move.clientY - start.pointerY);
      const now = performance.now();
      samples.push({ time: now, x: move.clientX, y: move.clientY });
      while (samples.length > 2 && now - samples[0].time > VELOCITY_WINDOW_MS) samples.shift();
    };
    const onUp = (up: PointerEvent) => {
      if (up.pointerId !== pointerId) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      const first = samples[0];
      const seconds = (performance.now() - first.time) / 1000;
      if (up.type === "pointercancel" || seconds <= 0) return;
      const velocityX = (up.clientX - first.x) / seconds;
      const velocityY = (up.clientY - first.y) / seconds;
      animate(x, x.get() + velocityX * FLICK_POWER, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
      animate(y, y.get() + velocityY * FLICK_POWER, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  const wrappedX = useTransform(x, (value) => (setWidth > 0 ? wrap(-setWidth, 0, value) : 0));
  // Enough sets side by side to fill the screen wherever the wall is.
  const sets = setWidth > 0 ? Math.ceil(viewport.width / setWidth) + 1 : 1;

  return (
    <div
      onPointerDown={onPointerDown}
      className={cn(
        "h-dvh cursor-grab touch-none overflow-hidden select-none active:cursor-grabbing",
        className,
      )}
    >
      <motion.div className="flex w-max items-start" style={{ x: wrappedX }}>
        {Array.from({ length: sets }, (_, set) => (
          <div
            key={set}
            ref={set === 0 ? firstSet : undefined}
            // Half a gap at each side, so sets meet a whole gap apart.
            className="flex items-start gap-(--gap) px-[calc(var(--gap)/2)]"
          >
            {columns.map((column, i) => (
              <MasonryColumn key={i} items={column} y={y} viewportHeight={viewport.height} />
            ))}
          </div>
        ))}
      </motion.div>
    </div>
  );
}

/** One column, repeating its own photos downwards as far as the screen needs. */
function MasonryColumn({
  items,
  y,
  viewportHeight,
}: {
  items: MasonryItem[];
  y: MotionValue<number>;
  viewportHeight: number;
}) {
  const firstCopy = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(0);

  useEffect(() => {
    const copy = firstCopy.current;
    if (!copy) return;
    const observer = new ResizeObserver(() => setHeight(copy.offsetHeight));
    observer.observe(copy);
    return () => observer.disconnect();
  }, []);

  const wrappedY = useTransform(y, (value) => (height > 0 ? wrap(-height, 0, value) : 0));
  const copies = height > 0 ? Math.ceil(viewportHeight / height) + 1 : 1;

  return (
    <motion.div className="w-(--column-width) shrink-0" style={{ y: wrappedY }}>
      {Array.from({ length: copies }, (_, copy) => (
        <div
          key={copy}
          ref={copy === 0 ? firstCopy : undefined}
          // Half a gap above and below, so copies meet a whole gap apart.
          className="flex flex-col gap-(--gap) py-[calc(var(--gap)/2)]"
        >
          {items.map((item) => (
            <Fragment key={item.key}>{item.content}</Fragment>
          ))}
        </div>
      ))}
    </motion.div>
  );
}
