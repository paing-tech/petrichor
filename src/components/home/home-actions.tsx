"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

type HomeActionsProps = {
  /** Where a signed-in visitor's collection link goes, or null when signed out. */
  collectionHref: string | null;
};

/**
 * Under the home artwork: "Create a keepsake", and "Sign in" (to the sign-in page) or, for
 * signed-in visitors, their collection.
 */
export function HomeActions({ collectionHref }: HomeActionsProps) {
  return (
    <div className="grid w-full gap-4">
      <CreateButton />
      {collectionHref ? (
        <Button asChild variant="outline" size="lg" className="bg-background">
          <Link href={collectionHref}>My keepsakes</Link>
        </Button>
      ) : (
        <Button asChild size="lg">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      )}
    </div>
  );
}

function CreateButton() {
  return (
    <Button asChild variant="outline" size="lg" className="w-full">
      <Link href="/create">Create a keepsake</Link>
    </Button>
  );
}

/** Same footprint as HomeActions while the session loads, so nothing shifts. */
export function HomeActionsFallback() {
  return (
    <div className="grid w-full gap-3">
      <CreateButton />
      <div className="h-11" />
    </div>
  );
}
