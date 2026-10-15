"use client";

import { useEffect, type RefObject } from "react";

/** The visible area is this much shorter than the window when a keyboard is open. */
const KEYBOARD_THRESHOLD = 120;
/** Space kept between the actions and the top of the keyboard. */
const GAP = 12;

/**
 * iPhone Safari lets a page scroll up by about the keyboard's height when it opens,
 * and often parks the focused field near the top, leaving blank page below short
 * content. While the keyboard is open, this keeps the bottom of `actionsRef` (the
 * Back / Next row) just above the keyboard: it scrolls there when the keyboard opens
 * or focus moves, and stops the page scrolling further down than that.
 *
 * Best effort: Safari owns keyboard scrolling, so this corrects it after the fact.
 */
export function useActionsAboveKeyboard(actionsRef: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!enabled || !viewport) return;

    let timer = 0;
    const keyboardOpen = () => viewport.height < window.innerHeight - KEYBOARD_THRESHOLD;

    /** Page scroll position that puts the actions' bottom edge just above the keyboard. */
    const targetScroll = () => {
      const actions = actionsRef.current;
      if (!actions) return null;
      const actionsBottom = actions.getBoundingClientRect().bottom + window.scrollY;
      return Math.max(0, actionsBottom + GAP - viewport.height - viewport.offsetTop);
    };

    const align = () => {
      if (!keyboardOpen()) return;
      const target = targetScroll();
      if (target !== null && Math.abs(window.scrollY - target) > 2) window.scrollTo({ top: target });
    };

    // Don't let the page scroll past the point where blank space shows below the actions.
    const clamp = () => {
      if (!keyboardOpen()) return;
      const target = targetScroll();
      if (target !== null && window.scrollY > target + 2) window.scrollTo({ top: target });
    };

    // Safari animates the keyboard in; align once it has settled.
    const alignSoon = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(align, 120);
    };

    viewport.addEventListener("resize", alignSoon);
    document.addEventListener("focusin", alignSoon);
    window.addEventListener("scroll", clamp, { passive: true });
    return () => {
      window.clearTimeout(timer);
      viewport.removeEventListener("resize", alignSoon);
      document.removeEventListener("focusin", alignSoon);
      window.removeEventListener("scroll", clamp);
    };
  }, [actionsRef, enabled]);
}
