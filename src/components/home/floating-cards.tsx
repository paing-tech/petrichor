"use client";

import { useEffect, useRef } from "react";
import { CollectibleCard, type CollectibleCardData } from "@/components/collectible-card";

// A sphere of cards, spinning slowly on a tilted axis and seen in perspective: cards on
// the near side grow and pass in front, cards on the far side shrink behind. Every card
// stays upright and faces the viewer. Drag (or scroll) to spin it; it glides to a stop.
// Speeds are per 60 fps frame and scaled to the real frame time.

/** At least this many cards, repeating the list if it's shorter, so the sphere looks full. */
const MIN_CARDS = 18;
/** Sphere radius and card height in px, for wide screens (scaled down on laptops and phones). */
const RADIUS = 250;
const CARD_SIZE = 82;
/** Vertical field of view of the virtual camera, which sets how strong the perspective is. */
const FOV_DEGREES = 60;
/** Auto spin, in radians per frame, around an axis tilted this many degrees from vertical. */
const AUTO_SPEED = 0.001;
const SPIN_TILT_DEGREES = 23;
/** Drag and scroll: radians per px, how quickly the motion settles, and how long it glides. */
const DRAG_SPEED = 0.001;
const WHEEL_SPEED = 0.0002;
const SMOOTHING = 0.11;
const FRICTION = 0.94;
/** Cards are drawn at this width and scaled, so their layout never reflows while moving. */
const DRAW_WIDTH = 200;
const DRAW_HEIGHT = (DRAW_WIDTH * 4) / 3;

type Vec = [number, number, number];
type Quat = [number, number, number, number]; // x, y, z, w

/** Evenly spread points on a unit sphere (a Fibonacci lattice). */
function spherePoint(i: number, count: number): Vec {
  const step = 2 / count;
  const y = i * step - 1 + step / 2;
  const r = Math.sqrt(1 - y * y);
  const angle = Math.PI * (3 - Math.sqrt(5)) * i;
  return [Math.cos(angle) * r, y, Math.sin(angle) * r];
}

function axisAngle([x, y, z]: Vec, angle: number): Quat {
  const s = Math.sin(angle / 2);
  return [x * s, y * s, z * s, Math.cos(angle / 2)];
}

/** a × b: applies b, then a. */
function multiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
}

function normalize(q: Quat): Quat {
  const length = Math.hypot(...q) || 1;
  return [q[0] / length, q[1] / length, q[2] / length, q[3] / length];
}

function rotate([vx, vy, vz]: Vec, [qx, qy, qz, qw]: Quat): Vec {
  // v + 2w(q × v) + 2(q × (q × v))
  const tx = 2 * (qy * vz - qz * vy);
  const ty = 2 * (qz * vx - qx * vz);
  const tz = 2 * (qx * vy - qy * vx);
  return [
    vx + qw * tx + (qy * tz - qz * ty),
    vy + qw * ty + (qz * tx - qx * tz),
    vz + qw * tz + (qx * ty - qy * tx),
  ];
}

export function FloatingCards({ cards }: { cards: CollectibleCardData[] }) {
  const fieldRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);
  const count = cards.length ? Math.max(cards.length, MIN_CARDS) : 0;

  useEffect(() => {
    const field = fieldRef.current;
    if (!field || !count) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const points = Array.from({ length: count }, (_, i) => spherePoint(i, count));
    const tilt = (SPIN_TILT_DEGREES * Math.PI) / 180;
    const spinAxis: Vec = [Math.sin(tilt), Math.cos(tilt), 0];

    let width = 0;
    let height = 0;
    let radius = 0;
    let cardSize = 0;
    let focal = 0;
    const measure = () => {
      width = field.clientWidth;
      height = field.clientHeight;
      const phone = width <= 640;
      const laptop = width >= 1025 && width <= 1440 ? 0.8 : 1;
      cardSize = phone ? 60 : CARD_SIZE * laptop;
      // On phones the sphere fills the width, less a 24px margin each side.
      radius = phone ? Math.max(0, (width - 48) / 2 - cardSize / 2) : RADIUS * laptop;
      // Distance from the camera to the sphere's center, in px, for the field of view.
      focal = height / 2 / Math.tan((FOV_DEGREES * Math.PI) / 360);
    };
    measure();
    const resize = new ResizeObserver(measure);
    resize.observe(field);

    let orientation: Quat = [0, 0, 0, 1];
    // Drag and scroll feed a velocity (which glides down) into a target the spin eases toward.
    let velocityX = 0;
    let velocityY = 0;
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let interacted = false;

    let dragging: { x: number; y: number; id: number } | null = null;
    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return;
      dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
      interacted = true;
      field.setPointerCapture(e.pointerId);
      field.style.cursor = "grabbing";
    };
    const onPointerMove = (e: PointerEvent) => {
      if (dragging && e.pointerId === dragging.id) {
        velocityX += (e.clientX - dragging.x) * DRAG_SPEED;
        velocityY += (e.clientY - dragging.y) * DRAG_SPEED;
        dragging.x = e.clientX;
        dragging.y = e.clientY;
        return;
      }
      if (e.pointerType !== "mouse") return;
      // "Grab" over the sphere, like the reference.
      const rect = field.getBoundingClientRect();
      const distance = Math.hypot(e.clientX - rect.left - width / 2, e.clientY - rect.top - height / 2);
      field.style.cursor = distance <= radius ? "grab" : "";
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== dragging.id) return;
      dragging = null;
      field.style.cursor = "grab";
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      interacted = true;
      velocityX += e.deltaY * WHEEL_SPEED;
    };
    field.addEventListener("pointerdown", onPointerDown);
    field.addEventListener("pointermove", onPointerMove);
    field.addEventListener("pointerup", onPointerUp);
    field.addEventListener("pointercancel", onPointerUp);
    field.addEventListener("wheel", onWheel, { passive: false });

    let frame = 0;
    let last = performance.now();
    const draw = (now: number) => {
      // Frames elapsed at 60 fps, so the motion is the same on 60 Hz and 120 Hz screens.
      const frames = Math.min(4, (now - last) / (1000 / 60));
      last = now;

      targetX += velocityX * frames;
      targetY += velocityY * frames;
      velocityX *= FRICTION ** frames;
      velocityY *= FRICTION ** frames;
      const ease = 1 - (1 - SMOOTHING) ** frames;
      const stepX = (targetX - currentX) * ease;
      const stepY = (targetY - currentY) * ease;
      currentX += stepX;
      currentY += stepY;

      orientation = multiply(axisAngle([0, 1, 0], stepX), orientation);
      orientation = multiply(axisAngle([1, 0, 0], stepY), orientation);
      // The slow spin stops once someone takes hold of the sphere.
      if (!still && !interacted) orientation = multiply(axisAngle(spinAxis, AUTO_SPEED * frames), orientation);
      orientation = normalize(orientation);

      const cardWidth = cardSize * 0.75;
      cardRefs.current.forEach((el, i) => {
        if (!el) return;
        const [x, y, z] = rotate(points[i], orientation);
        // Perspective: nearer (positive z) is bigger.
        const depth = focal / (focal - z * radius);
        const screenX = width / 2 + x * radius * depth;
        const screenY = height / 2 - y * radius * depth;
        const scale = (cardWidth * depth) / DRAW_WIDTH;
        el.style.transform = `translate3d(${screenX - DRAW_WIDTH / 2}px, ${screenY - DRAW_HEIGHT / 2}px, 0) scale(${scale})`;
        el.style.zIndex = String(Math.round(z * 1000) + 1000);
      });

      field.dataset.ready = "true";
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      resize.disconnect();
      field.removeEventListener("pointerdown", onPointerDown);
      field.removeEventListener("pointermove", onPointerMove);
      field.removeEventListener("pointerup", onPointerUp);
      field.removeEventListener("pointercancel", onPointerUp);
      field.removeEventListener("wheel", onWheel);
    };
  }, [count]);

  return (
    <div
      ref={fieldRef}
      aria-hidden
      // Hidden until the first frame places the cards, so they don't flash in a pile.
      className="absolute inset-0 touch-none opacity-0 transition-opacity duration-700 select-none data-[ready=true]:opacity-100"
    >
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          ref={(el) => {
            cardRefs.current[i] = el;
          }}
          className="pointer-events-none absolute top-0 left-0 origin-center will-change-transform"
          style={{ width: DRAW_WIDTH }}
        >
          <CollectibleCard card={cards[i % cards.length]} className="max-w-none" />
        </div>
      ))}
    </div>
  );
}
