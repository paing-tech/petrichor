"use client";

import { useSyncExternalStore, type ComponentProps } from "react";
import { CollectibleCard } from "@/components/collectible-card";

const subscribeNoop = () => () => {};

/** Today in the visitor's own time zone, as YYYY-MM-DD. */
function localToday() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A CollectibleCard dated today, wherever the visitor is. The server doesn't know the
 * visitor's date, so the page is first drawn with the card's own `createdAt` and the date
 * swaps to today as soon as it loads (same line, so nothing shifts).
 */
export function TodayCard({ card, ...props }: ComponentProps<typeof CollectibleCard>) {
  const today = useSyncExternalStore(subscribeNoop, localToday, () => null);
  // A plain YYYY-MM-DD read as UTC prints exactly that day.
  const dated = today ? { ...card, createdAt: today, timeZone: "UTC" } : card;
  return <CollectibleCard card={dated} {...props} />;
}
