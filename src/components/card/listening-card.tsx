"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { LISTENING_CARD_SLOT } from "@/components/card/listening-player";
import { setMessageShown, useMessageShown } from "@/components/card/listening-store";
import { FlipControlContext } from "@/components/flip-card";
import { cn } from "@/lib/utils";

/** Whether the page is in listening mode (the html element's data-listening, set by ListenPanel). */
export function useListening() {
  return useSyncExternalStore(
    (onChange) => {
      const observer = new MutationObserver(onChange);
      observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-listening"] });
      return () => observer.disconnect();
    },
    () => document.documentElement.hasAttribute("data-listening"),
    () => false,
  );
}

const GLIDE = { type: "spring", damping: 30, stiffness: 260 } as const;

/**
 * Holds the card on its page. In listening mode it glides into the player, small, beside the
 * song's title (the player's card slot), and back when listening ends. There, tapping it shows
 * its message beside it (and turns it to its back) instead of flipping it on its own.
 */
export function ListeningCard({ className, children }: { className?: string; children: ReactNode }) {
  const listening = useListening();
  // Only read in the browser, once listening mode has put the player (and its slot) on screen.
  const slot = listening ? document.getElementById(LISTENING_CARD_SLOT) : null;

  if (slot) {
    return createPortal(
      <motion.div layoutId="listening-card" transition={GLIDE} className="w-full">
        <ListeningCardControl>{children}</ListeningCardControl>
      </motion.div>,
      slot,
    );
  }
  return (
    <motion.div layoutId="listening-card" transition={GLIDE} className={cn("w-full", className)}>
      {children}
    </motion.div>
  );
}

/** The small card in the player: tapping it shows its message beside it (and turns it over). */
export function ListeningCardControl({ children }: { children: ReactNode }) {
  const messageShown = useMessageShown();
  return (
    <FlipControlContext
      value={{
        side: messageShown ? "back" : "front",
        onTap: () => setMessageShown(!messageShown),
        label: messageShown ? "Hide the message" : "Show the message",
      }}
    >
      {children}
    </FlipControlContext>
  );
}
