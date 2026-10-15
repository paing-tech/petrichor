"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";

const NARROW_QUERY = "(max-width: 1023.98px)";
/** The visual viewport is this much shorter than the window when a keyboard is open. */
const KEYBOARD_THRESHOLD = 120;

function subscribeNarrow(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True below the lg breakpoint (phones and tablets); false while server rendering. */
export function useIsNarrow() {
  return useSyncExternalStore(subscribeNarrow, () => window.matchMedia(NARROW_QUERY).matches, () => false);
}

/**
 * On narrow screens the create form is a fixed "shell" sized to the *visual*
 * viewport. iOS Safari doesn't shrink the page when the keyboard opens — it pans
 * the visible area instead, which drags sticky/fixed content (the pinned card)
 * out of view and leaves blank space. Following window.visualViewport keeps the
 * shell exactly over what's visible above the keyboard.
 *
 * Returns CSS variables for the shell's top and height. While the keyboard is
 * open the site header is covered too, to give the field more room.
 */
export function useViewportShell(enabled: boolean): CSSProperties {
  const [vars, setVars] = useState<CSSProperties>({});

  useEffect(() => {
    if (!enabled) return;
    const viewport = window.visualViewport;
    const header = document.querySelector<HTMLElement>("body > header");
    const root = document.documentElement;

    // The shell scrolls internally; the page underneath must not.
    const previous = { html: root.style.overflow, body: document.body.style.overflow };
    root.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    const update = () => {
      const height = viewport?.height ?? window.innerHeight;
      const offsetTop = viewport?.offsetTop ?? 0;
      const keyboardOpen = height < window.innerHeight - KEYBOARD_THRESHOLD;
      const headerHeight = keyboardOpen ? 0 : (header?.offsetHeight ?? 0);
      setVars({
        "--shell-top": `${offsetTop + headerHeight}px`,
        "--shell-height": `${height - headerHeight}px`,
      } as CSSProperties);
    };

    update();
    viewport?.addEventListener("resize", update);
    viewport?.addEventListener("scroll", update);
    window.addEventListener("resize", update);
    return () => {
      viewport?.removeEventListener("resize", update);
      viewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      root.style.overflow = previous.html;
      document.body.style.overflow = previous.body;
      setVars({});
    };
  }, [enabled]);

  return vars;
}
