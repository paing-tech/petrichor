"use client";

import {
  Fragment,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
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
/** How far the wall can zoom out and in (1 is the sizes it's given). */
export const MIN_ZOOM = 0.5;
export const MAX_ZOOM = 2.5;
/** How fast a trackpad pinch (or Ctrl/⌘ + scroll) zooms, per px of wheel movement. */
const WHEEL_ZOOM_SPEED = 0.01;
/** A mouse wheel moves in big notches; each counts as at most this many px (about 1.25×). */
const WHEEL_ZOOM_MAX_STEP = 22;

export type MasonryItem = { key: string; content: ReactNode };

/** Lets controls outside the wall zoom it (about the middle of the screen). */
export type MasonryHandle = { zoomBy: (factor: number) => void };

type Point = { x: number; y: number };

const clampZoom = (zoom: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

/**
 * An endless masonry wall you drag (or scroll) in any direction, and pinch (or Ctrl/⌘ +
 * scroll) to zoom. Columns of equal width sit side by side, repeating sideways; each column
 * repeats its own photos downwards on its own, so every gap stays the same however long each
 * column is.
 *
 * Sizes come from CSS variables set on it (e.g. through `className`): `--column-width` and
 * `--gap` (between columns, between photos, and where things repeat). Multiply both by
 * `var(--zoom)` so they follow the zoom.
 */
export function InfiniteMasonry({
  columns,
  className,
  ref,
}: {
  columns: MasonryItem[][];
  className?: string;
  ref?: Ref<MasonryHandle>;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [zoom, setZoom] = useState(1);
  const zoomRef = useRef(1);
  const firstSet = useRef<HTMLDivElement>(null);
  const [setWidth, setSetWidth] = useState(0);
  const [viewport, setViewport] = useState({ width: 0, height: 0 });

  /**
   * Zooms so the spot under `point` (on screen) stays put. Everything scales together, so
   * the wall's offset scales about that point too; repeats line up because their sizes scale
   * by the same amount.
   */
  function zoomTo(next: number, point: Point) {
    const target = clampZoom(next);
    const factor = target / zoomRef.current;
    if (factor === 1) return;
    x.stop();
    y.stop();
    x.set(point.x - (point.x - x.get()) * factor);
    y.set(point.y - (point.y - y.get()) * factor);
    zoomRef.current = target;
    setZoom(target);
  }

  useImperativeHandle(ref, () => ({
    zoomBy: (factor) =>
      zoomTo(zoomRef.current * factor, { x: window.innerWidth / 2, y: window.innerHeight / 2 }),
  }));

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

  // Scrolling (and sideways on trackpads) glides the wall; a trackpad pinch, or Ctrl/⌘ +
  // scroll, zooms about the pointer instead of zooming the page.
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        const step = Math.max(-WHEEL_ZOOM_MAX_STEP, Math.min(WHEEL_ZOOM_MAX_STEP, event.deltaY));
        zoomTo(zoomRef.current * Math.exp(-step * WHEEL_ZOOM_SPEED), {
          x: event.clientX,
          y: event.clientY,
        });
        return;
      }
      animate(y, y.get() - event.deltaY * WHEEL_SPEED, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
      if (event.deltaX) {
        animate(x, x.get() - event.deltaX * WHEEL_SPEED, { duration: GLIDE_SECONDS, ease: GLIDE_EASE });
      }
    };
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
    // zoomTo only touches refs, motion values and a state setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [x, y]);

  // One finger (or the mouse) drags the wall, and a flick glides on when let go; two fingers
  // pinch to zoom (and move it along with them). Pointers aren't captured, so a tap still
  // reaches the photo under it.
  const pointers = useRef(new Map<number, Point>());
  const gesture = useRef<
    | { kind: "drag"; start: Point; from: Point; samples: { time: number; x: number; y: number }[] }
    | { kind: "pinch"; distance: number; zoom: number; middle: Point }
    | null
  >(null);

  function startDrag(at: Point) {
    gesture.current = {
      kind: "drag",
      start: at,
      from: { x: x.get(), y: y.get() },
      samples: [{ time: performance.now(), ...at }],
    };
  }

  function pinchOf(): { distance: number; middle: Point } {
    const [a, b] = [...pointers.current.values()];
    return {
      distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      middle: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    };
  }

  function onPointerDown(event: ReactPointerEvent) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    x.stop();
    y.stop();
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.current.size === 1) {
      startDrag({ x: event.clientX, y: event.clientY });
    } else if (pointers.current.size === 2) {
      const { distance, middle } = pinchOf();
      gesture.current = { kind: "pinch", distance, zoom: zoomRef.current, middle };
    }
    if (pointers.current.size > 1) return;

    const onMove = (move: PointerEvent) => {
      if (!pointers.current.has(move.pointerId)) return;
      pointers.current.set(move.pointerId, { x: move.clientX, y: move.clientY });
      const current = gesture.current;
      if (current?.kind === "drag" && pointers.current.size === 1) {
        x.set(current.from.x + move.clientX - current.start.x);
        y.set(current.from.y + move.clientY - current.start.y);
        const now = performance.now();
        current.samples.push({ time: now, x: move.clientX, y: move.clientY });
        while (current.samples.length > 2 && now - current.samples[0].time > VELOCITY_WINDOW_MS) {
          current.samples.shift();
        }
      } else if (current?.kind === "pinch" && pointers.current.size >= 2) {
        const { distance, middle } = pinchOf();
        // Move with the fingers, then zoom about where they are.
        x.set(x.get() + middle.x - current.middle.x);
        y.set(y.get() + middle.y - current.middle.y);
        current.middle = middle;
        zoomTo(current.zoom * (distance / current.distance), middle);
      }
    };
    const onUp = (up: PointerEvent) => {
      if (!pointers.current.has(up.pointerId)) return;
      pointers.current.delete(up.pointerId);
      const current = gesture.current;
      if (pointers.current.size === 1) {
        // A pinch ended with one finger still down: carry on dragging with it.
        const [remaining] = pointers.current.values();
        startDrag(remaining);
        return;
      }
      if (pointers.current.size > 1) return;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      gesture.current = null;
      if (current?.kind !== "drag" || up.type === "pointercancel") return;
      const first = current.samples[0];
      const seconds = (performance.now() - first.time) / 1000;
      if (seconds <= 0) return;
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
      style={{ "--zoom": zoom } as CSSProperties}
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
