"use client";

import { useSyncExternalStore } from "react";

const subscribeNoop = () => () => {};

/** The site's origin (e.g. https://petrichor-studio.vercel.app), for building full links; empty on the server. */
export function useOrigin() {
  return useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
}
