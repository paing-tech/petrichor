"use client";

import { useEffect, useRef } from "react";

// A night sky for the home page's listening mode: twinkling tiny stars, a few glowing
// four-point sparkles (taller than wide) joined by faint constellation lines, and every
// few seconds a falling star trailing a soft glow. Drawn on a canvas; runs only while
// `active`, and stays still for anyone who prefers reduced motion.

/** Tiny stars per 10,000 px² of window. */
const STAR_DENSITY = 0.9;
/** Glowing four-point sparkles. */
const SPARKLES = 14;
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

export function Starfield({ active }: { active: boolean }) {
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

      stars = Array.from({ length: Math.round(((width * height) / 10000) * STAR_DENSITY) }, () => ({
        x: rand(0, width),
        y: rand(0, height),
        r: rand(0.3, 1.1),
        base: rand(0.25, 0.8),
        speed: rand(0.6, 2.2),
        phase: rand(0, Math.PI * 2),
      }));
      sparkles = Array.from({ length: SPARKLES }, () => ({
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

      // Constellation lines, breathing slowly.
      ctx.lineWidth = 0.6;
      for (const [a, b] of lines) {
        ctx.strokeStyle = `rgba(200, 215, 255, ${0.06 + 0.05 * Math.sin(t * 0.5 + a.phase)})`;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }

      ctx.fillStyle = "#fff";
      for (const s of stars) {
        ctx.globalAlpha = Math.max(0, s.base * (0.55 + 0.45 * Math.sin(t * s.speed + s.phase)));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      for (const s of sparkles) {
        // Blink: mostly soft, now and then bright.
        const glow = 0.35 + 0.65 * Math.pow((Math.sin(t * s.speed + s.phase) + 1) / 2, 3);
        drawSparkle(ctx, s.x, s.y, s.size, s.size * STRETCH, glow);
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
    };
  }, [active]);

  return <canvas ref={canvasRef} aria-hidden className="absolute inset-0 size-full" />;
}
