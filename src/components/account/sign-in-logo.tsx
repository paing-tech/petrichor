"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

/** The logo's resting size, in px (size-12). */
const SIZE = 48;
/** How much larger it starts, in the middle of the screen. */
const START_SCALE = 1.5;
/** A short pause in the middle, then a smooth glide up (ending gently). */
const GLIDE = { duration: 0.5, ease: [0.22, 1, 0.36, 1], delay: 0.35 } as const;
/**
 * How far through the glide the title and form appear: by 60% its ease has covered nearly all
 * the way, so they show as it lands rather than after its gentle last stretch.
 */
const REVEAL_AT = 0.4;

/** Set on the html element once the logo has arrived: the sign-in page's title and form show then. */
export const SIGN_IN_READY = "data-sign-in-ready";

/**
 * The sign-in page's logo (a link home): it starts large in the middle of the screen, then
 * shrinks and glides up into its place above the title, and the title and form fade in
 * (they wait for SIGN_IN_READY). The glide is measured: from the screen's centre to wherever
 * its place turns out to be. With reduced motion it simply sits in its place.
 */
export function SignInLogo() {
  const slot = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  // How far its place is from the screen's centre; null until measured.
  const [offset, setOffset] = useState<{ x: number; y: number } | null>(null);
  const [arrived, setArrived] = useState(false);

  useLayoutEffect(() => {
    const root = document.documentElement;
    if (reduce) {
      root.setAttribute(SIGN_IN_READY, "");
      return () => root.removeAttribute(SIGN_IN_READY);
    }
    const place = slot.current!.getBoundingClientRect();
    setOffset({
      x: place.left + SIZE / 2 - window.innerWidth / 2,
      y: place.top + SIZE / 2 - window.innerHeight / 2,
    });
    const reveal = window.setTimeout(
      () => root.setAttribute(SIGN_IN_READY, ""),
      (GLIDE.delay + GLIDE.duration * REVEAL_AT) * 1000,
    );
    return () => {
      window.clearTimeout(reveal);
      root.removeAttribute(SIGN_IN_READY);
    };
  }, [reduce]);

  const logo = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/icon/Petrichor_Icon_RGB_White.svg"
      alt=""
      width={SIZE}
      height={SIZE}
      className="size-12 rounded-full ring-1 ring-black/20"
    />
  );

  return (
    // Its place in the column; the logo lands here and then stays.
    <div ref={slot} className="size-12">
      {arrived || reduce ? (
        <Link href="/" aria-label="Petrichor home" className="block rounded-full transition-opacity hover:opacity-80">
          {logo}
        </Link>
      ) : (
        // In the middle of the screen, large, until it glides into place.
        <motion.div
          aria-hidden
          className="pointer-events-none fixed top-1/2 left-1/2 z-10 -mt-6 -ml-6 size-12"
          initial={{ x: 0, y: 0, scale: START_SCALE }}
          animate={offset ? { x: offset.x, y: offset.y, scale: 1 } : undefined}
          transition={GLIDE}
          onAnimationComplete={() => {
            if (offset) setArrived(true);
          }}
        >
          {logo}
        </motion.div>
      )}
    </div>
  );
}
