"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { claimSavedCardsAction } from "@/app/keepsakes/actions";
import { forgetClaims, readSavedClaims } from "@/lib/saved-claims";

/** Keeps cards this browser made "For myself" while signed out, once the person is signed in. */
export function ClaimSavedCards() {
  const router = useRouter();
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const saved = readSavedClaims();
    if (saved.length === 0) return;
    claimSavedCardsAction(saved.slice(0, 20)).then((result) => {
      if (!result.ok) return;
      // Forget every attempted code: claimed ones are done; the rest were already kept or replaced.
      forgetClaims(saved.slice(0, 20).map((c) => c.cardId));
      if (result.claimed.length > 0) {
        toast.success(
          result.claimed.length === 1 ? "Your card is now in your collection" : `${result.claimed.length} cards added to your collection`,
        );
        router.refresh();
      }
    });
  }, [router]);

  return null;
}
