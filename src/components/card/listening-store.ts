"use client";

import { useEffect, useSyncExternalStore } from "react";

// Whether listening mode is showing the card's message (in place of the song's title), shared
// by the small card (which toggles it) and the player (which shows it).

let messageShown = false;
const listeners = new Set<() => void>();

export function setMessageShown(shown: boolean) {
  messageShown = shown;
  listeners.forEach((listener) => listener());
}

export function useMessageShown() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => messageShown,
    () => false,
  );
}

/**
 * Listening mode while `active`: the page goes black (see globals.css), the header's buttons
 * step aside, and so do the phone's browser bars. Ending it folds the message away.
 */
export function useListeningMode(active: boolean) {
  useEffect(() => {
    if (!active) return;
    document.documentElement.setAttribute("data-listening", "");
    const theme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const day = theme?.content;
    if (theme) theme.content = "#000000";
    return () => {
      setMessageShown(false);
      document.documentElement.removeAttribute("data-listening");
      if (theme && day) theme.content = day;
    };
  }, [active]);
}
