"use client";

import { useEffect, useRef, type RefObject } from "react";

// A night sky for the home page's listening mode: twinkling tiny stars, a few glowing
// four-point sparkles (taller than wide) joined by faint constellation lines, and every
// few seconds a falling star trailing a soft glow. Scrolling or dragging pans the sky
// (wrapping around, so it never runs out). Drawn on a canvas; runs only while `active`, and
// stays still for anyone who prefers reduced motion.

/** Tiny stars per 10,000 px² of window: wide screens, and phones (narrower than 640px). */
const STAR_DENSITY = 10;
const STAR_DENSITY_PHONE = 30;
/** Glowing four-point sparkles: wide screens, and phones. */
const SPARKLES = 30;
const SPARKLES_PHONE = 10;
/**
 * Constellation lines between sparkles: thin, bluish white, slowly brightening and dimming
 * between these opacities.
 */
const LINE_RGB = "200, 215, 255";
const LINE_OPACITY: [min: number, max: number] = [0.1, 0.6];
const LINE_WIDTH = 0.4;
/** Below this window width, the phone values apply. */
const PHONE_MAX_WIDTH = 640;
/**
 * Scrolling (wheel / trackpad) or dragging a finger pans the sky. Sparkles move with it 1:1;
 * tiny stars move this much, so they read as farther away.
 */
const FAR_STARS_PAN = 0.55;
/** After a finger lets go, the sky keeps gliding and slows by this much per frame. */
const PAN_GLIDE = 0.98;
/** Seconds between falling stars (random within the range). */
const FALL_EVERY: [number, number] = [2.5, 6];
/** A sparkle's spikes are this much longer up/down than left/right. */
const STRETCH = 1.8;

type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number };
type Sparkle = { x: number; y: number; size: number; speed: number; phase: number };
type Faller = { x: number; y: number; vx: number; vy: number; length: number; size: number; age: number; life: number };

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/** A four-point star: concave sides, spikes `h` wide and `v` tall, with a soft halo. */
function drawSparkle(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, v: number, alpha: number) {
  const halo = ctx.createRadialGradient(x, y, 0, x, y, h * 2.6);
  halo.addColorStop(0, `rgba(210, 225, 255, ${0.35 * alpha})`);
  halo.addColorStop(1, "rgba(210, 225, 255, 0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, h * 2.6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
  ctx.beginPath();
  ctx.moveTo(x, y - v);
  ctx.quadraticCurveTo(x, y, x + h, y);
  ctx.quadraticCurveTo(x, y, x, y + v);
  ctx.quadraticCurveTo(x, y, x - h, y);
  ctx.quadraticCurveTo(x, y, x, y - v);
  ctx.fill();
}

export function Starfield({
  active,
  panRef,
}: {
  active: boolean;
  /** Pans the sky from outside (e.g. a view the visitor turns); its own scroll/swipe handling is then off. */
  panRef?: RefObject<{ x: number; y: number }>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !active) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let stars: Star[] = [];
    let sparkles: Sparkle[] = [];
    // Constellations: a few sparkles joined in a chain.
    let lines: [Sparkle, Sparkle][] = [];

    const build = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const phone = width < PHONE_MAX_WIDTH;
      const density = phone ? STAR_DENSITY_PHONE : STAR_DENSITY;
      stars = Array.from({ length: Math.round(((width * height) / 10000) * density) }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        r: rand(0.3, 1.1),
        base: rand(0.25, 0.8),
        speed: rand(0.6, 2.2),
        phase: rand(0, Math.PI * 2),
      }));
      sparkles = Array.from({ length: phone ? SPARKLES_PHONE : SPARKLES }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        size: rand(2.5, 6),
        speed: rand(0.4, 1.2),
        phase: rand(0, Math.PI * 2),
      }));
      // Join each of the first nine sparkles to its nearest neighbour among the others, if
      // it's close enough to read as one constellation.
      const maxLength = Math.min(width, height) * 0.28;
      lines = sparkles.slice(0, 9).flatMap((a) => {
        const nearest = sparkles
          .filter((b) => b !== a)
          .reduce((best, b) => (Math.hypot(b.x - a.x, b.y - a.y) < Math.hypot(best.x - a.x, best.y - a.y) ? b : best));
        return Math.hypot(nearest.x - a.x, nearest.y - a.y) <= maxLength ? [[a, nearest] as [Sparkle, Sparkle]] : [];
      });
    };
    build();
    window.addEventListener("resize", build);

    // Panning: wheel/trackpad and finger drags move the sky. While it's showing, they don't
    // scroll (or bounce) the page.
    const pan = { x: 0, y: 0, vx: 0, vy: 0 };
    let touch: { x: number; y: number; t: number } | null = null;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (still) return;
      // Scrolling down moves the sky up, like scrolling content.
      const scale = e.deltaMode === 1 ? 16 : 1;
      pan.x -= e.deltaX * scale;
      pan.y -= e.deltaY * scale;
    };
    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0];
      touch = { x: p.clientX, y: p.clientY, t: performance.now() };
      pan.vx = pan.vy = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      e.preventDefault();
      if (still) return;
      // The sky follows the finger.
      const p = e.touches[0];
      const now = performance.now();
      const dx = p.clientX - touch.x;
      const dy = p.clientY - touch.y;
      const frames = Math.max(1, (now - touch.t) / (1000 / 60));
      pan.x += dx;
      pan.y += dy;
      pan.vx = dx / frames;
      pan.vy = dy / frames;
      touch = { x: p.clientX, y: p.clientY, t: now };
    };
    const onTouchEnd = () => {
      touch = null;
    };
    if (!panRef) {
      window.addEventListener("wheel", onWheel, { passive: false });
      window.addEventListener("touchstart", onTouchStart, { passive: true });
      window.addEventListener("touchmove", onTouchMove, { passive: false });
      window.addEventListener("touchend", onTouchEnd);
      window.addEventListener("touchcancel", onTouchEnd);
    }
    /** A point shifted by the pan (times `depth`), wrapped back onto the screen. */
    const wrap = (x: number, y: number, depth: number) => {
      const p = panRef?.current ?? pan;
      return {
        x: (((x + p.x * depth) % width) + width) % width,
        y: (((y + p.y * depth) % height) + height) % height,
      };
    };

    const fallers: Faller[] = [];
    let nextFall = rand(0.8, 2);

    let frame = 0;
    let last = performance.now();
    let t = 0;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      ctx.clearRect(0, 0, width, height);

      // Keep gliding after a flick, slowing down.
      if (!touch && (pan.vx || pan.vy)) {
        const frames = dt * 60;
        pan.x += pan.vx * frames;
        pan.y += pan.vy * frames;
        pan.vx *= PAN_GLIDE ** frames;
        pan.vy *= PAN_GLIDE ** frames;
        if (Math.abs(pan.vx) < 0.05 && Math.abs(pan.vy) < 0.05) pan.vx = pan.vy = 0;
      }

      // Constellation lines, breathing slowly.
      ctx.lineWidth = LINE_WIDTH;
      for (const [a, b] of lines) {
        const pa = wrap(a.x, a.y, 1);
        const pb = wrap(b.x, b.y, 1);
        // Skip a line while its two stars sit on opposite edges (one has wrapped around).
        if (Math.hypot(pb.x - pa.x, pb.y - pa.y) > Math.hypot(b.x - a.x, b.y - a.y) + 1) continue;
        const [low, high] = LINE_OPACITY;
        ctx.strokeStyle = `rgba(${LINE_RGB}, ${low + (high - low) * (0.5 + 0.5 * Math.sin(t * 0.5 + a.phase))})`;
        ctx.beginPath();
        ctx.moveTo(pa.x, pa.y);
        ctx.lineTo(pb.x, pb.y);
        ctx.stroke();
      }

      ctx.fillStyle = "#fff";
      for (const s of stars) {
        ctx.globalAlpha = Math.max(0, s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase)));
        const p = wrap(s.x, s.y, FAR_STARS_PAN);
        ctx.beginPath();
        ctx.arc(p.x, p.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const s of sparkles) {
        // Blink: mostly soft, now and then bright.
        const glow = 0.35 + 0.65 * Math.pow((Math.sin(t * s.speed + s.phase) + 1) / 2, 3);
        const p = wrap(s.x, s.y, 1);
        drawSparkle(ctx, p.x, p.y, s.size, s.size * STRETCH, glow);
      }

      if (!still) {
        nextFall -= dt;
        if (nextFall <= 0) {
          nextFall = rand(...FALL_EVERY);
          // Mostly straight down, leaning up to ~25° either way.
          const angle = Math.PI / 2 + rand(-0.45, 0.45);
          const speed = rand(260, 420);
          fallers.push({
            x: rand(width * 0.1, width * 0.9),
            y: rand(-40, height * 0.35),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            length: rand(140, 260),
            size: rand(3, 5),
            age: 0,
            life: rand(1.4, 2.2),
          });
        }
      }

      for (let i = fallers.length - 1; i >= 0; i--) {
        const f = fallers[i];
        f.age += dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        if (f.age >= f.life) {
          fallers.splice(i, 1);
          continue;
        }
        // Fade in fast, out slowly.
        const p = f.age / f.life;
        const alpha = Math.min(1, p / 0.12) * (1 - Math.pow(p, 2));
        const speed = Math.hypot(f.vx, f.vy);
        const tailX = f.x - (f.vx / speed) * f.length;
        const tailY = f.y - (f.vy / speed) * f.length;

        // A wide soft blue glow, then a thin bright core, both fading toward the tail.
        for (const [lineWidth, color] of [
          [5, `rgba(120, 170, 255, ${0.22 * alpha})`],
          [1.4, `rgba(255, 255, 255, ${0.9 * alpha})`],
        ] as const) {
          const trail = ctx.createLinearGradient(f.x, f.y, tailX, tailY);
          trail.addColorStop(0, color);
          trail.addColorStop(1, "rgba(120, 170, 255, 0)");
          ctx.strokeStyle = trail;
          ctx.lineWidth = lineWidth;
          ctx.lineCap = "round";
          ctx.beginPath();
          ctx.moveTo(f.x, f.y);
          ctx.lineTo(tailX, tailY);
          ctx.stroke();
        }
        drawSparkle(ctx, f.x, f.y, f.size, f.size * STRETCH * 1.4, alpha);
      }

      if (!still) frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", build);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [active, panRef]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
