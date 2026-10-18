"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  Maximize2Icon,
  RotateCcwIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

// The YouTube player, plus a "Full screen" view that floats it, huge, in a black starry space
// the viewer can look around: drag (or use the arrow keys) on a computer; tilt and turn the
// phone, or drag, on a phone. The player is one iframe the whole time (only its placement
// changes), so the song keeps playing when the view opens or closes.

/** The player's size in the space (16:9); its on-screen size comes from its distance. */
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 900;
/**
 * The virtual camera's focal length, as a multiple of the screen's longer side (CSS
 * perspective). Longer = a narrower, more natural view; shorter = a fisheye look.
 */
const FOCAL_PER_SCREEN = 1.15;
/** How much of the screen the player fills when looked at straight on. */
const FILL = 0.86;
/** Degrees turned per px dragged. */
const DRAG_SPEED = 0.12;
const STARS = 1400;
/** Zoom: each press scales the player by ZOOM_STEP, between these limits (1 = FILL). */
const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

/**
 * Where the viewer is looking: a 3×3 rotation (row-major), in CSS's axes (x right, y down,
 * z toward the viewer), that turns the world into the view. Every movement is applied
 * relative to the screen, so looking keeps going all the way round, in any direction, like
 * floating inside a sphere: past straight up you see behind you, then come back from below.
 */
type View = number[];
const IDENTITY: View = [1, 0, 0, 0, 1, 0, 0, 0, 1];

const toRad = (deg: number) => (deg * Math.PI) / 180;

const multiply = (a: View, b: View): View => {
  const out = new Array<number>(9);
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 3; c++)
      out[r * 3 + c] =
        a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
  return out;
};
/** CSS rotateY / rotateX, as rotations. */
const rotateY = (deg: number): View => {
  const c = Math.cos(toRad(deg)),
    s = Math.sin(toRad(deg));
  return [c, 0, s, 0, 1, 0, -s, 0, c];
};
const rotateX = (deg: number): View => {
  const c = Math.cos(toRad(deg)),
    s = Math.sin(toRad(deg));
  return [1, 0, 0, 0, c, -s, 0, s, c];
};
/** Re-squares the rotation, which drifts slightly after many small turns. */
const orthonormalize = (m: View): View => {
  const len = (x: number, y: number, z: number) => Math.hypot(x, y, z) || 1;
  let [ax, ay, az] = [m[0], m[3], m[6]];
  let l = len(ax, ay, az);
  [ax, ay, az] = [ax / l, ay / l, az / l];
  let [bx, by, bz] = [m[1], m[4], m[7]];
  const d = ax * bx + ay * by + az * bz;
  [bx, by, bz] = [bx - d * ax, by - d * ay, bz - d * az];
  l = len(bx, by, bz);
  [bx, by, bz] = [bx / l, by / l, bz / l];
  const [cx, cy, cz] = [
    ay * bz - az * by,
    az * bx - ax * bz,
    ax * by - ay * bx,
  ];
  return [ax, bx, cx, ay, by, cy, az, bz, cz];
};

export function YouTubeSpace({
  videoId,
  title,
  footer,
}: {
  videoId: string;
  title: string;
  /** Shown beside the "Full screen" button, e.g. a link to the YouTube Music app. */
  footer?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const view = useRef<View>(IDENTITY);
  const [hint, setHint] = useState(true);
  // The zoom the viewer chose (for the buttons), and the one shown, which eases toward it.
  const [zoom, setZoom] = useState(1);
  const zoomTarget = useRef(1);
  const zoomShown = useRef(1);

  function zoomBy(factor: number) {
    const next = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, zoomTarget.current * factor),
    );
    zoomTarget.current = next;
    setZoom(next);
  }

  const close = useCallback(() => {
    setOpen(false);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
  }, []);

  function enter() {
    view.current = IDENTITY;
    zoomTarget.current = zoomShown.current = 1;
    setZoom(1);
    setHint(true);
    setOpen(true);
    // Real full screen where the browser allows it (not iPhone Safari); the space works either way.
    void document.documentElement.requestFullscreen?.().catch(() => {});
    // iPhones share the motion sensor only after asking, from this tap.
    const request = (
      window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<string>;
      }
    )?.requestPermission;
    if (typeof request === "function")
      void request.call(window.DeviceOrientationEvent).catch(() => {});
  }

  useEffect(() => {
    if (!open) return;
    const frame = frameRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!frame || !canvas || !ctx) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // Stars: random directions around the viewer, each with its own size and twinkle.
    const stars = Array.from({ length: STARS }, () => {
      const z = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const r = Math.sqrt(1 - z * z);
      return {
        x: r * Math.cos(a),
        y: z,
        z: r * Math.sin(a),
        size: 0.4 + Math.random() * 1.2,
        phase: Math.random() * 6.28,
      };
    });

    let width = 0;
    let height = 0;
    let baseDistance = 0; // from the viewer to the player at zoom 1, in px
    let focal = 0;
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      focal = Math.max(width, height) * FOCAL_PER_SCREEN;
      const screenWidth = Math.min(width * FILL, (height * FILL * 16) / 9);
      baseDistance = (focal * WORLD_WIDTH) / screenWidth;
    };
    resize();
    window.addEventListener("resize", resize);

    // Looking around: drag, arrow keys, and (phones) the motion sensor relative to the start.
    let drag: { x: number; y: number } | null = null;
    // dYaw: degrees to the right; dPitch: degrees up. Both relative to the current view.
    const look = (dYaw: number, dPitch: number) => {
      view.current = orthonormalize(
        multiply(rotateX(-dPitch), multiply(rotateY(dYaw), view.current)),
      );
      setHint(false);
    };
    const onDown = (e: PointerEvent) => {
      drag = { x: e.clientX, y: e.clientY };
      canvas.setPointerCapture(e.pointerId);
      // While dragging, the player lets the pointer pass through, or YouTube's frame would
      // take over the drag the moment it crosses the player.
      frame.style.pointerEvents = "none";
    };
    const onMove = (e: PointerEvent) => {
      if (!drag) return;
      // The space follows the finger, like grabbing it.
      look(
        -(e.clientX - drag.x) * DRAG_SPEED,
        -(e.clientY - drag.y) * DRAG_SPEED,
      );
      drag = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      drag = null;
      frame.style.pointerEvents = "";
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key === "+" || e.key === "=") return zoomBy(ZOOM_STEP);
      if (e.key === "-" || e.key === "_") return zoomBy(1 / ZOOM_STEP);
      const step = {
        ArrowLeft: [-5, 0],
        ArrowRight: [5, 0],
        ArrowUp: [0, -5],
        ArrowDown: [0, 5],
      }[e.key];
      if (step) {
        e.preventDefault();
        look(step[0], step[1]);
      }
    };
    let sensorBase: { alpha: number; beta: number } | null = null;
    let sensorLast: { alpha: number; beta: number } | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null) return;
      const now = { alpha: e.alpha, beta: e.beta };
      sensorBase ??= now;
      if (sensorLast) {
        // Turning the phone turns the view; wrap the compass so 359° → 1° is a small step.
        const dAlpha = ((now.alpha - sensorLast.alpha + 540) % 360) - 180;
        const dBeta = now.beta - sensorLast.beta;
        if (Math.abs(dAlpha) > 0.05 || Math.abs(dBeta) > 0.05)
          look(-dAlpha, -dBeta);
      }
      sensorLast = now;
    };
    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    canvas.addEventListener("pointercancel", onUp);
    window.addEventListener("keydown", onKey);
    window.addEventListener("deviceorientation", onOrientation);
    let wasFullscreen = false;
    const onFullscreenChange = () => {
      // Leaving the browser's full screen (e.g. with Esc) closes the space too.
      if (!document.fullscreenElement && wasFullscreen) close();
      wasFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    let raf = 0;
    const start = performance.now();
    const draw = (now: number) => {
      const t = (now - start) / 1000;
      const m = view.current;
      // Zoom glides to the chosen size: nearer is bigger.
      zoomShown.current +=
        (zoomTarget.current - zoomShown.current) * (still ? 1 : 0.15);
      const distance = baseDistance / zoomShown.current;

      // The player, fixed in front of where the view started: turn the world around the viewer.
      const halfAngle = Math.atan(WORLD_WIDTH / 2 / distance);
      // The player sits straight ahead of the start (0, 0, −1); m[8] is the cosine of the angle
      // between it and where the viewer now looks.
      const facing = Math.acos(Math.max(-1, Math.min(1, m[8])));
      // Hidden once an edge would swing behind the viewer (browsers draw that as a glitch).
      const behind = facing > Math.PI / 2 - halfAngle - toRad(5);
      // CSS's camera sits `focal` px in front of the page, so move the pivot there first: the
      // world then turns around the viewer, and the player ends up `distance` px in front.
      frame.style.transform = `translate(-50%, -50%) perspective(${focal}px) translateZ(${focal}px) matrix3d(${m[0]},${m[3]},${m[6]},0,${m[1]},${m[4]},${m[7]},0,${m[2]},${m[5]},${m[8]},0,0,0,0,1) translateZ(${-distance}px)`;
      frame.style.visibility = behind ? "hidden" : "visible";

      // The stars, the same way: each direction turned by the view, then projected.
      ctx.clearRect(0, 0, width, height);
      const cx = width / 2,
        cyScreen = height / 2;
      ctx.fillStyle = "#fff";
      for (const s of stars) {
        // Turned by the same rotation as the player, so stars and player move together.
        const x2 = m[0] * s.x + m[1] * s.y + m[2] * s.z;
        const y2 = m[3] * s.x + m[4] * s.y + m[5] * s.z;
        const z2 = m[6] * s.x + m[7] * s.y + m[8] * s.z;
        if (z2 >= -0.05) continue; // behind the viewer
        const px = cx + (focal * x2) / -z2;
        const py = cyScreen + (focal * y2) / -z2;
        if (px < -2 || px > width + 2 || py < -2 || py > height + 2) continue;
        ctx.globalAlpha = still
          ? 0.7
          : 0.45 + 0.4 * Math.sin(t * 1.3 + s.phase);
        ctx.beginPath();
        ctx.arc(px, py, s.size, 0, 6.283);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
      canvas.removeEventListener("pointercancel", onUp);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("deviceorientation", onOrientation);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.style.overflow = overflow;
      frame.style.transform = "";
      frame.style.visibility = "";
    };
  }, [open, close]);

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, full screen`}
        >
          <canvas
            ref={canvasRef}
            className="absolute inset-0 size-full cursor-grab touch-none active:cursor-grabbing"
          />
          <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-[62] flex gap-2">
            <button
              type="button"
              onClick={() => zoomBy(1 / ZOOM_STEP)}
              disabled={zoom <= MIN_ZOOM + 0.001}
              aria-label="Make the player smaller"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomOutIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => zoomBy(ZOOM_STEP)}
              disabled={zoom >= MAX_ZOOM - 0.001}
              aria-label="Make the player larger"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30"
            >
              <ZoomInIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => (view.current = IDENTITY)}
              aria-label="Face the player"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <RotateCcwIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="Close full screen"
              className="flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20"
            >
              <XIcon className="size-5" />
            </button>
          </div>
          <p
            className={cn(
              "pointer-events-none absolute inset-x-0 bottom-[max(1.5rem,env(safe-area-inset-bottom))] z-[62] text-center text-sm text-white/60 transition-opacity duration-700",
              !hint && "opacity-0",
            )}
          >
            Drag or move your phone to look around
          </p>
        </div>
      )}
      {/* The player: inline in the panel, or (in the space) fixed at the screen's centre and
          turned in 3D each frame. */}
      <div
        ref={frameRef}
        className={cn(
          open
            ? "fixed top-1/2 left-1/2 z-[61] overflow-hidden rounded-2xl shadow-[0_0_80px_rgba(255,255,255,0.08)]"
            : "w-full",
        )}
        style={open ? { width: WORLD_WIDTH, height: WORLD_HEIGHT } : undefined}
      >
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // YouTube requires its player to be at least 200 × 200px.
          className={cn(
            "block w-full border-0 bg-transparent",
            open ? "h-full" : "aspect-video min-h-[200px] rounded-xl",
          )}
        />
      </div>
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={enter}
          className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
        >
          <Maximize2Icon className="size-3" /> Full screen
        </button>
        {footer}
      </div>
    </>
  );
}
