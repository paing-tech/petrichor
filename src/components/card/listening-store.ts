"use client";

import { useSyncExternalStore } from "react";

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
