"use client";

import { useSyncExternalStore, type ReactNode } from "react";
import { motion } from "motion/react";
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

/**
 * Holds the card on its page. In listening mode it glides down to a small keepsake in the
 * bottom-right corner, above the progress bar and clear of the centred player, and back when
 * listening ends.
 */
export function ListeningCard({ className, children }: { className?: string; children: ReactNode }) {
  const listening = useListening();
  return (
    <motion.div
      layout
      transition={{ type: "spring", damping: 30, stiffness: 260 }}
      className={cn(
        listening
          ? "fixed right-6 bottom-[calc(max(1.5rem,env(safe-area-inset-bottom))+3.5rem)] z-50 w-28 sm:right-8 sm:bottom-[5.5rem] sm:w-40"
          : "w-full",
        !listening && className,
      )}
    >
      {children}
    </motion.div>
  );
}
