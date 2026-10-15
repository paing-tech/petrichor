"use client";

import { useSyncExternalStore } from "react";

const NARROW_QUERY = "(max-width: 1023.98px)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(NARROW_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/** True below the lg breakpoint (phones and tablets); false while server rendering. */
export function useIsNarrow() {
  return useSyncExternalStore(subscribe, () => window.matchMedia(NARROW_QUERY).matches, () => false);
}
