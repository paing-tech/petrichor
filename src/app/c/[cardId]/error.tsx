"use client";

import { Button } from "@/components/ui/button";

export default function CardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-24 text-center">
      <h1 className="font-serif text-3xl">This card didn&apos;t load</h1>
      <p className="text-muted-foreground text-sm">Something went wrong on our side. Please try again in a moment.</p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
