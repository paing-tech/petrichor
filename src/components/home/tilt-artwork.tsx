"use client";

import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
} from "react";
import { useListening } from "@/components/home/listening";
import { cn } from "@/lib/utils";

/** Furthest the artwork turns toward the cursor, in degrees. */
const MAX_TILT = 4;
/** How deep the 3D space is; smaller numbers exaggerate the tilt. */
const PERSPECTIVE = 1000;
/** Phones: tilting the phone this many degrees from how it's held gives the full MAX_TILT. */
const PHONE_TILT_RANGE = 20;
/** Phones: how quickly "how it's held" follows the phone (so the card re-centers over time). */
const PHONE_RECENTER = 0.01;

/** iOS's motion-permission request (Safari 13+); absent elsewhere. */
type OrientationPermission = {
  requestPermission?: () => Promise<"granted" | "denied">;
};

/**
 * Tilts its contents like turning a card in your hand, with a soft light that moves with
 * it: toward a mouse cursor on desktop, and on phones as the phone itself tilts (its motion
 * sensor; iPhones ask permission on the first tap). Still for anyone who prefers reduced
 * motion, and while the home page's song plays (the light would show as a gray box on black).
 */
export function TiltArtwork({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const listening = useListening()?.dark ?? false;

  // Settle flat as soon as the song starts.
  useEffect(() => {
    if (listening) leave();
  }, [listening]);

  // Phones: tilt with the phone, relative to how it's being held.
  useEffect(() => {
    const el = ref.current;
    if (!el || listening) return;
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let base: { x: number; y: number } | null = null;
    const clamp = (v: number) => Math.max(-1, Math.min(1, v));
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.beta === null || e.gamma === null) return;
      // Left/right and toward/away, swapped when the phone is turned sideways.
      const angle = screen.orientation?.angle ?? 0;
      const side =
        angle === 90
          ? { x: e.beta, y: -e.gamma }
          : angle === 270 || angle === -90
            ? { x: -e.beta, y: e.gamma }
            : { x: e.gamma, y: e.beta };
      base ??= side;
      base = {
        x: base.x + (side.x - base.x) * PHONE_RECENTER,
        y: base.y + (side.y - base.y) * PHONE_RECENTER,
      };
      const x = clamp((side.x - base.x) / PHONE_TILT_RANGE);
      const y = clamp((side.y - base.y) / PHONE_TILT_RANGE);
      el.style.setProperty("--tilt-x", `${-y * MAX_TILT}deg`);
      el.style.setProperty("--tilt-y", `${x * MAX_TILT}deg`);
      el.style.setProperty("--light-x", `${50 + x * 50}%`);
      el.style.setProperty("--light-y", `${50 + y * 50}%`);
      el.dataset.tilting = "true";
    };
    const listen = () =>
      window.addEventListener("deviceorientation", onOrientation);

    // iPhones only share motion after the visitor allows it, asked from a tap.
    const { requestPermission } = (window.DeviceOrientationEvent ??
      {}) as OrientationPermission;
    let askOnTap: (() => void) | null = null;
    if (typeof requestPermission === "function") {
      askOnTap = () => {
        requestPermission
          .call(window.DeviceOrientationEvent)
          .then((state) => state === "granted" && listen())
          .catch(() => {});
      };
      window.addEventListener("pointerup", askOnTap, { once: true });
    } else listen();

    return () => {
      window.removeEventListener("deviceorientation", onOrientation);
      if (askOnTap) window.removeEventListener("pointerup", askOnTap);
      leave();
    };
  }, [listening]);

  function move(e: PointerEvent<HTMLDivElement>) {
    const el = ref.current;
    if (!el || e.pointerType !== "mouse" || listening) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rect = el.getBoundingClientRect();
    // Cursor position across the artwork, 0…1.
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    el.style.setProperty("--tilt-x", `${(0.5 - y) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--tilt-y", `${(x - 0.5) * 2 * MAX_TILT}deg`);
    el.style.setProperty("--light-x", `${x * 100}%`);
    el.style.setProperty("--light-y", `${y * 100}%`);
    el.dataset.tilting = "true";
  }

  function leave() {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--tilt-x", "0deg");
    el.style.setProperty("--tilt-y", "0deg");
    delete el.dataset.tilting;
  }

  return (
    <div
      ref={ref}
      onPointerMove={move}
      onPointerLeave={leave}
      // Eases back slowly when the cursor leaves, follows quickly while it moves.
      className={cn(
        "group transition-transform duration-500 ease-out will-change-transform data-tilting:duration-100",
        className,
      )}
      style={{
        ...style,
        transform: `perspective(${PERSPECTIVE}px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg))`,
      }}
    >
      {children}
      {/* The light: brightens what's under the cursor; on plain white it changes nothing. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-0 mix-blend-soft-light transition-opacity duration-500 group-data-tilting:opacity-100"
        style={{
          background:
            "radial-gradient(circle at var(--light-x, 50%) var(--light-y, 50%), rgba(255, 255, 255, 0.55), transparent 55%)",
        }}
      />
    </div>
  );
}
