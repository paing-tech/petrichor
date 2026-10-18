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
  LockIcon,
  MonitorPlayIcon,
  SparklesIcon,
  XIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "lucide-react";
import { brightenAndPulse } from "@/components/home/listening";
import { Starfield } from "@/components/home/starfield";
import { useOrigin } from "@/components/share-actions";
import { cn } from "@/lib/utils";

// The YouTube player, plus a "Full screen" view: the home page's night sky all around, the
// player floating huge in front, and the reverie figure directly behind, rising and
// brightening as on the home page. Scroll (trackpad / wheel), swipe, or turn the phone to
// look around, all the way round in any direction, like floating inside a sphere; the player
// and the figure always stay upright. The player is one iframe the whole time (only its
// placement changes), so the song keeps playing when the view opens or closes.

/** The player's size in the space (16:9); its on-screen size comes from its distance. */
const WORLD_WIDTH = 1600;
const WORLD_HEIGHT = 900;
/** The figure (reverie.png, 1024 × 1536) in the same units. */
const FIGURE_HEIGHT = 1800;
const FIGURE_WIDTH = (FIGURE_HEIGHT * 1024) / 1536;
/** While the song plays, the figure rises this far (of her height) over RISE_MS; she settles back over FIGURE_SETTLE_MS. */
const FIGURE_SETTLE_MS = 2500;
/**
 * While the song plays she keeps rising (no ceiling), this many space-px per second once
 * she's eased up to speed; when it's paused or ends she glides back down to where she began.
 */
const FIGURE_RISE_SPEED = 45;
/** Seconds to reach full rising speed after the song starts. */
const FIGURE_RISE_EASE_S = 3;
/** She rises toward this elevation (degrees above the horizon), ever more slowly, never past it. */
const FIGURE_MAX_ELEVATION = 80;
/**
 * Following her, the camera holds still while she drifts up; once she's FOLLOW_CATCH_AT of
 * the way from the centre to the top of the view, it glides (over about FOLLOW_GLIDE_S) to put
 * her FOLLOW_REST below the centre, and she drifts up again. Sideways it always keeps her centred.
 */
const FOLLOW_CATCH_AT = 0.3;
const FOLLOW_REST = 0.12;
const FOLLOW_GLIDE_S = 0.9;
/** How much of the screen's height the figure fills when faced. */
const FIGURE_FILL = 0.72;
/**
 * The virtual camera's focal length, as a multiple of the screen's longer side (CSS
 * perspective). Longer = a narrower, more natural view; shorter = a fisheye look.
 */
const FOCAL_PER_SCREEN = 1.15;
/** How much of the screen the player fills when looked at straight on. */
const FILL = 0.86;
/** Degrees turned per px scrolled (trackpad / wheel) and per px swiped. */
const SCROLL_SPEED = 0.08;
const SWIPE_SPEED = 0.15;
/** After a swipe, the view keeps gliding and slows by this much per frame. */
const GLIDE = 0.92;
/** Zoom: each press scales the player by ZOOM_STEP, between these limits (1 = FILL). */
const ZOOM_STEP = 1.25;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 2.5;

/**
 * Where the viewer is looking: a 3×3 rotation (row-major), in CSS's axes (x right, y down,
 * z toward the viewer), that turns the world into the view. Every movement is applied
 * relative to the screen, so looking keeps going all the way round, in any direction.
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
const matrix3d = (m: View) =>
  `matrix3d(${m[0]},${m[3]},${m[6]},0,${m[1]},${m[4]},${m[7]},0,${m[2]},${m[5]},${m[8]},0,0,0,0,1)`;

/**
 * The roll (degrees) that turns an object back upright on screen, whatever the view: its own
 * "up" is lined up with the screen's. `mo` is the object's orientation as the viewer sees it
 * (the view times the object's own turn).
 */
function uprightRoll(mo: View) {
  // The object's right and up directions, as the view sees them.
  const rx = mo[0],
    ry = mo[3];
  const ux = -mo[1],
    uy = -mo[4];
  let roll = Math.atan2(-ux, rx);
  const s = Math.sin(roll),
    c = Math.cos(roll);
  if (s * ry + c * uy > 0) roll += Math.PI; // came out upside down
  return (roll * 180) / Math.PI;
}

/** The heading (degrees right) and elevation (degrees up) of a point, from the viewer. */
function anglesOf([x, y, z]: [number, number, number]) {
  return {
    yaw: (Math.atan2(x, -z) * 180) / Math.PI,
    pitch: (Math.atan2(-y, Math.hypot(x, z)) * 180) / Math.PI,
  };
}

/**
 * The turn that makes an object at `p` face the viewer square-on (a billboard), so it never
 * looks squashed from steep angles: the same yaw / pitch as looking at it, undone.
 */
function facingViewer([x, y, z]: [number, number, number]): View {
  const yaw = (Math.atan2(x, -z) * 180) / Math.PI;
  const pitch = (Math.atan2(-y, Math.hypot(x, z)) * 180) / Math.PI;
  return multiply(rotateY(-yaw), rotateX(-pitch));
}

/** Sends a command to the YouTube player (it listens because of enablejsapi=1). */
function youtube(iframe: HTMLIFrameElement | null, func: string) {
  iframe?.contentWindow?.postMessage(
    JSON.stringify({ event: "command", func, args: [] }),
    "*",
  );
}

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
  const origin = useOrigin();
  const [open, setOpen] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const figureRef = useRef<HTMLDivElement>(null);
  const figureArtRef = useRef<HTMLImageElement>(null);
  const view = useRef<View>(IDENTITY);
  const skyPan = useRef({ x: 0, y: 0 });
  // How high she has risen (space px), whether the song is playing (for the rise), and the
  // camera's focal length and her distance (for "face her").
  const figureRise = useRef(0);
  const risePlaying = useRef(false);
  const lens = useRef({ focal: 0, figureDistance: 0 });
  const [hint, setHint] = useState(true);
  // Over the player, a clear layer takes scrolls and swipes (YouTube's frame would swallow
  // them). A click or tap on it plays / pauses, then it steps aside so YouTube's own controls
  // work, until the pointer is back on the sky.
  const [shield, setShield] = useState(true);
  const playing = useRef(false);
  // The same, as state: the figure rises and brightens while the song plays.
  const [songPlaying, setSongPlaying] = useState(false);
  // The zoom the viewer chose (for the buttons), and the one shown, which eases toward it.
  const [zoom, setZoom] = useState(1);
  // Locked on the player (still, scrolling off), or following her as she rises.
  const [mode, setModeState] = useState<"free" | "lock" | "follow">("free");
  const modeRef = useRef<"free" | "lock" | "follow">("free");
  function setMode(next: "free" | "lock" | "follow") {
    modeRef.current = next;
    setModeState(next);
    if (next !== "free") setHint(false);
  }
  const zoomTarget = useRef(1);
  const zoomShown = useRef(1);

  /**
   * Turns the view to face a point (space px from the viewer: x right, y down, z toward the
   * start view), upright, and pans the sky to match.
   */
  const faceDirection = useCallback((point: [number, number, number]) => {
    const { yaw, pitch } = anglesOf(point);
    faceAngles(yaw, pitch);
  }, []);

  /** Turns the view to a heading (degrees right) and elevation (degrees up), upright. */
  function faceAngles(yaw: number, pitch: number) {
    view.current = multiply(rotateX(pitch), rotateY(yaw));
    const pxPerDeg = (lens.current.focal * Math.PI) / 180;
    // The same pan `look` would have made turning there (its up-turns are rotateX(−degrees)).
    skyPan.current = { x: -yaw * pxPerDeg, y: -pitch * pxPerDeg };
  }

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
    skyPan.current = { x: 0, y: 0 };
    figureRise.current = 0;
    setMode("free");
    zoomTarget.current = zoomShown.current = 1;
    setZoom(1);
    setHint(true);
    setShield(true);
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

  // Know whether the song is playing, so a tap on the player can pause or play it.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (!/(^|\.)youtube(-nocookie)?\.com$/.test(new URL(e.origin).hostname))
        return;
      try {
        const data = typeof e.data === "string" ? JSON.parse(e.data) : e.data;
        const state =
          data?.info?.playerState ??
          (data?.event === "onStateChange" ? data.info : undefined);
        // 1 playing; 2 paused; 0 ended (buffering and the rest keep the last state).
        if (state === 1 || state === 2 || state === 0) {
          playing.current = state === 1;
          setSongPlaying(state === 1);
        }
      } catch {
        // Not a player message.
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The figure, tied to the music: while the song plays she keeps rising and brightens, then
  // pulses; when it's paused or ends she glides back down to where she began and dims.
  useEffect(() => {
    const art = figureArtRef.current;
    if (
      !open ||
      !art ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    // Her rise itself is moved each frame in the space (see `draw`); this is her glow.
    risePlaying.current = songPlaying;
    if (!songPlaying) return;
    const glow = brightenAndPulse(art);
    return () => {
      // Hand over from wherever the glow is to a gentle fade back to normal.
      const current = getComputedStyle(art).filter;
      glow.stop();
      art.animate([{ filter: current }, { filter: "brightness(1)" }], {
        duration: FIGURE_SETTLE_MS,
        easing: "ease-out",
      });
    };
  }, [open, songPlaying]);

  useEffect(() => {
    if (!open) return;
    const frame = frameRef.current;
    const figure = figureRef.current;
    const art = figureArtRef.current;
    if (!frame || !figure || !art) return;
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    let width = 0;
    let height = 0;
    let baseDistance = 0; // from the viewer to the player at zoom 1, in px
    let figureDistance = 0; // from the viewer to the figure, in px
    let focal = 0;
    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      focal = Math.max(width, height) * FOCAL_PER_SCREEN;
      const screenWidth = Math.min(width * FILL, (height * FILL * 16) / 9);
      baseDistance = (focal * WORLD_WIDTH) / screenWidth;
      // The figure fills FIGURE_FILL of the screen's height (or its width, if narrower),
      // leaving room above for her rise.
      const figureScreenHeight = Math.min(
        height * FIGURE_FILL,
        (width * FIGURE_FILL * 1536) / 1024,
      );
      figureDistance = (focal * FIGURE_HEIGHT) / figureScreenHeight;
      lens.current = { focal, figureDistance };
    };
    resize();
    window.addEventListener("resize", resize);

    // dYaw: degrees to the right; dPitch: degrees up. Both relative to the current view; the
    // sky pans by the same angle.
    const look = (dYaw: number, dPitch: number) => {
      // Locked on the player or following her: scrolling, swiping and the phone don't turn the view.
      if (still || modeRef.current !== "free") return;
      view.current = orthonormalize(
        multiply(rotateX(-dPitch), multiply(rotateY(dYaw), view.current)),
      );
      const pxPerDeg = (focal * Math.PI) / 180;
      skyPan.current.x -= dYaw * pxPerDeg;
      skyPan.current.y += dPitch * pxPerDeg;
      setHint(false);
    };

    // Scrolling (trackpad / mouse wheel): scroll down to look down, sideways to look sideways.
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const scale = e.deltaMode === 1 ? 16 : 1;
      look(e.deltaX * scale * SCROLL_SPEED, -e.deltaY * scale * SCROLL_SPEED);
    };
    // Swiping (phones): the space follows the finger, and glides on after a flick.
    let touch: { x: number; y: number; t: number } | null = null;
    const glide = { yaw: 0, pitch: 0 };
    const onTouchStart = (e: TouchEvent) => {
      const p = e.touches[0];
      touch = { x: p.clientX, y: p.clientY, t: performance.now() };
      glide.yaw = glide.pitch = 0;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touch) return;
      e.preventDefault();
      const p = e.touches[0];
      const now = performance.now();
      const dYaw = -(p.clientX - touch.x) * SWIPE_SPEED;
      const dPitch = (p.clientY - touch.y) * SWIPE_SPEED;
      look(dYaw, dPitch);
      const frames = Math.max(1, (now - touch.t) / (1000 / 60));
      glide.yaw = dYaw / frames;
      glide.pitch = dPitch / frames;
      touch = { x: p.clientX, y: p.clientY, t: now };
    };
    const onTouchEnd = () => (touch = null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return close();
      if (e.key === "+" || e.key === "=") return zoomBy(ZOOM_STEP);
      if (e.key === "-" || e.key === "_") return zoomBy(1 / ZOOM_STEP);
      const step = {
        ArrowLeft: [-5, 0],
        ArrowRight: [5, 0],
        ArrowUp: [0, 5],
        ArrowDown: [0, -5],
      }[e.key];
      if (step) {
        e.preventDefault();
        look(step[0], step[1]);
      }
    };
    // Phones: turning the phone turns the view.
    let sensorLast: { alpha: number; beta: number } | null = null;
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null || e.beta === null) return;
      const now = { alpha: e.alpha, beta: e.beta };
      if (sensorLast) {
        // Wrap the compass so 359° → 1° is a small step.
        const dAlpha = ((now.alpha - sensorLast.alpha + 540) % 360) - 180;
        const dBeta = now.beta - sensorLast.beta;
        if (Math.abs(dAlpha) > 0.05 || Math.abs(dBeta) > 0.05)
          look(-dAlpha, dBeta);
      }
      sensorLast = now;
    };
    // Back on the sky (any pointer event that reaches this page is off the player): the clear
    // layer over the player returns, so scrolling there turns the view again.
    const onPointerOverPage = () => setShield(true);
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);
    window.addEventListener("touchcancel", onTouchEnd);
    window.addEventListener("keydown", onKey);
    window.addEventListener("deviceorientation", onOrientation);
    window.addEventListener("pointermove", onPointerOverPage);
    window.addEventListener("pointerdown", onPointerOverPage);
    let wasFullscreen = false;
    const onFullscreenChange = () => {
      // Leaving the browser's full screen (e.g. with Esc) closes the space too.
      if (!document.fullscreenElement && wasFullscreen) close();
      wasFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    /**
     * Places one object in the space at `p` (space px from the viewer: x right, y down, z
     * toward the start view), turned by `turn` (its own orientation in the space), and kept
     * upright on screen.
     */
    const place = (
      el: HTMLElement,
      m: View,
      p: [number, number, number],
      turn: View,
      halfSize: number,
    ) => {
      // Where the object is, as the viewer sees it, and the angle off the view's centre.
      const vx = m[0] * p[0] + m[1] * p[1] + m[2] * p[2];
      const vy = m[3] * p[0] + m[4] * p[1] + m[5] * p[2];
      const vz = m[6] * p[0] + m[7] * p[1] + m[8] * p[2];
      const distance = Math.hypot(vx, vy, vz) || 1;
      const facing = Math.acos(Math.max(-1, Math.min(1, -vz / distance)));
      // Hidden once an edge would swing behind the viewer (browsers draw that as a glitch).
      const hidden =
        facing > Math.PI / 2 - Math.atan(halfSize / distance) - toRad(5);
      el.style.visibility = hidden ? "hidden" : "visible";
      if (hidden) return;
      // CSS's camera sits `focal` px in front of the page, so move the pivot there first: the
      // world then turns around the viewer, and the object ends up at `p`.
      el.style.transform = `translate(-50%, -50%) perspective(${focal}px) translateZ(${focal}px) ${matrix3d(m)} translate3d(${p[0]}px, ${p[1]}px, ${p[2]}px) ${matrix3d(turn)} rotateZ(${uprightRoll(multiply(m, turn))}deg)`;
    };

    let raf = 0;
    let last = performance.now();
    let riseSpeed = 0;
    // The following camera: its heading and elevation, and whether it's gliding to catch up.
    let follow: { yaw: number; pitch: number; catching: boolean } | null = null;
    const draw = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      // Her rise: easing up to speed and rising on while the song plays; gliding home after.
      if (!still && risePlaying.current) {
        riseSpeed = Math.min(
          FIGURE_RISE_SPEED,
          riseSpeed + (FIGURE_RISE_SPEED / FIGURE_RISE_EASE_S) * dt,
        );
        figureRise.current += riseSpeed * dt;
      } else {
        riseSpeed = 0;
        // Exponential glide: most of the way back within FIGURE_SETTLE_MS.
        figureRise.current *= Math.exp((-5 * dt * 1000) / FIGURE_SETTLE_MS);
        if (figureRise.current < 0.5) figureRise.current = 0;
      }
      if (
        !touch &&
        (Math.abs(glide.yaw) > 0.01 || Math.abs(glide.pitch) > 0.01)
      ) {
        look(glide.yaw, glide.pitch);
        glide.yaw *= GLIDE;
        glide.pitch *= GLIDE;
      }
      // Zoom glides to the chosen size: nearer is bigger.
      zoomShown.current +=
        (zoomTarget.current - zoomShown.current) * (still ? 1 : 0.15);
      // She rises along the inside of the sky dome, always the same distance away (so she
      // keeps her size), her climb easing as she nears FIGURE_MAX_ELEVATION; she never tips
      // over the top. `figureRise` is how far she has travelled, in space px.
      const maxElevation = toRad(FIGURE_MAX_ELEVATION);
      const elevation =
        maxElevation *
        (1 - Math.exp(-figureRise.current / figureDistance / maxElevation));
      const figureAt: [number, number, number] = [
        0,
        -figureDistance * Math.sin(elevation),
        figureDistance * Math.cos(elevation),
      ];
      if (modeRef.current === "lock") faceDirection([0, 0, -1]);
      if (modeRef.current === "follow") {
        // Start from wherever the viewer is looking: its forward direction is the view's third row, reversed.
        const v = view.current;
        follow ??= { ...anglesOf([-v[6], -v[7], -v[8]]), catching: true };
        const her = anglesOf(figureAt);
        const halfView = (Math.atan(height / 2 / focal) * 180) / Math.PI;
        const ease = 1 - Math.exp(-dt / (FOLLOW_GLIDE_S / 3));
        // Sideways: keep her centred (the shorter way round).
        follow.yaw += (((her.yaw - follow.yaw + 540) % 360) - 180) * ease;
        // Up and down: hold, then glide to catch up when she nears the top (or bottom, as she settles).
        const offset = her.pitch - follow.pitch;
        if (Math.abs(offset) > halfView * FOLLOW_CATCH_AT)
          follow.catching = true;
        if (follow.catching) {
          const target = her.pitch + halfView * FOLLOW_REST;
          follow.pitch += (target - follow.pitch) * ease;
          // Caught up (within a sliver; she's still moving): hold again and let her drift.
          if (Math.abs(target - follow.pitch) < 0.4) follow.catching = false;
        }
        faceAngles(follow.yaw, follow.pitch);
      } else follow = null;
      const m = view.current;
      place(
        frame,
        m,
        [0, 0, -baseDistance / zoomShown.current],
        IDENTITY,
        WORLD_WIDTH / 2,
      );
      // She turns to face the viewer wherever she is, so she keeps her shape as she rises.
      place(figure, m, figureAt, facingViewer(figureAt), FIGURE_HEIGHT / 2);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("deviceorientation", onOrientation);
      window.removeEventListener("pointermove", onPointerOverPage);
      window.removeEventListener("pointerdown", onPointerOverPage);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      document.body.style.overflow = overflow;
      frame.style.transform = "";
      frame.style.visibility = "";
    };
  }, [open, close, faceDirection]);

  const pillClass =
    "flex items-center rounded-full bg-white/10 p-0.5 backdrop-blur";
  const controlClass =
    "flex size-10 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition-colors hover:bg-white/20 disabled:opacity-30";

  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-[60] touch-none bg-black"
          role="dialog"
          aria-modal="true"
          aria-label={`${title}, full screen`}
        >
          {/* The home page's night sky, panned as the viewer looks around. */}
          <Starfield active panRef={skyPan} />
          {/* The reverie figure, directly behind the viewer at the start. */}
          <div
            ref={figureRef}
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-1/2"
            style={{ width: FIGURE_WIDTH, height: FIGURE_HEIGHT }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={figureArtRef}
              src="/reverie.png"
              alt=""
              className="size-full"
              draggable={false}
            />
          </div>
          <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-4 z-[62] flex gap-2">
            {/* The player: zoom out / in, face it, lock the view on it. */}
            <div className={pillClass}>
              <PillButton
                label="Smaller"
                onClick={() => zoomBy(1 / ZOOM_STEP)}
                disabled={zoom <= MIN_ZOOM + 0.001}
              >
                <ZoomOutIcon className="size-4" />
              </PillButton>
              <PillButton
                label="Larger"
                onClick={() => zoomBy(ZOOM_STEP)}
                disabled={zoom >= MAX_ZOOM - 0.001}
              >
                <ZoomInIcon className="size-4" />
              </PillButton>
              <PillButton
                label="Face the player"
                onClick={() => {
                  setMode("free");
                  faceDirection([0, 0, -1]);
                }}
              >
                <MonitorPlayIcon className="size-4" />
              </PillButton>
              <PillButton
                label="Lock view"
                active={mode === "lock"}
                onClick={() => setMode(mode === "lock" ? "free" : "lock")}
              >
                <LockIcon className="size-4" />
              </PillButton>
            </div>
            {/* Her: one toggle — glide to her and follow her as she rises; tap again to look
                around freely from there. */}
            <div className={pillClass}>
              <PillButton
                label="Follow her"
                active={mode === "follow"}
                onClick={() => setMode(mode === "follow" ? "free" : "follow")}
              >
                <SparklesIcon className="size-4" />
              </PillButton>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close full screen"
              className={controlClass}
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
            Scroll, swipe or move your phone to look around
          </p>
        </div>
      )}
      {/* The player: inline in the panel, or (in the space) fixed at the screen's centre and
          placed in 3D each frame. */}
      <div
        ref={frameRef}
        className={cn(
          open
            ? "fixed top-1/2 left-1/2 z-[61] overflow-hidden rounded-2xl shadow-[0_0_80px_rgba(255,255,255,0.08)]"
            : "relative w-full",
        )}
        style={open ? { width: WORLD_WIDTH, height: WORLD_HEIGHT } : undefined}
      >
        <iframe
          ref={iframeRef}
          src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0&enablejsapi=1${origin ? `&origin=${encodeURIComponent(origin)}` : ""}`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          // Ask the player to report its state (playing / paused) to this page.
          onLoad={() =>
            iframeRef.current?.contentWindow?.postMessage(
              JSON.stringify({ event: "listening", id: videoId }),
              "*",
            )
          }
          // YouTube requires its player to be at least 200 × 200px.
          className={cn(
            "block w-full border-0 bg-transparent",
            open ? "h-full" : "aspect-video min-h-[200px] rounded-xl",
          )}
        />
        {open && shield && (
          <button
            type="button"
            aria-label={`Play or pause ${title}`}
            className="absolute inset-0 cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              youtube(
                iframeRef.current,
                playing.current ? "pauseVideo" : "playVideo",
              );
              playing.current = !playing.current;
              // Step aside so YouTube's own controls (seek, volume…) can be used.
              setShield(false);
            }}
            onPointerDown={(e) => e.stopPropagation()}
          />
        )}
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

/**
 * One button in a control pill: an icon, a white circle while its mode is on (`active`), and
 * a small label under it on hover, or briefly after a tap on touch screens.
 */
function PillButton({
  label,
  onClick,
  active,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  const [flash, setFlash] = useState(false);
  const timer = useRef<number>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      onPointerUp={(e) => {
        if (e.pointerType !== "touch") return;
        setFlash(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setFlash(false), 1200);
      }}
      className={cn(
        "group/pill relative flex size-10 items-center justify-center rounded-full transition-colors disabled:opacity-30",
        active ? "bg-white text-black" : "text-white hover:bg-white/15",
      )}
    >
      {children}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-full left-1/2 mt-2 -translate-x-1/2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] whitespace-nowrap text-white opacity-0 transition-opacity",
          "group-hover/pill:opacity-100",
          flash && "opacity-100",
        )}
      >
        {active ? `${label} · on` : label}
      </span>
    </button>
  );
}
