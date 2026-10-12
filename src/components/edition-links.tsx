"use client";

import Link from "next/link";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";

type EditionLinksProps = {
  /** Card IDs in edition order: index 0 is "1 of N". */
  cardIds: string[];
};

/** Lists every copy of an edition with its own link, plus a "copy all" for sending them out. */
export function EditionLinks({ cardIds }: EditionLinksProps) {
  const origin = useOrigin();
  const size = cardIds.length;
  const urlFor = (cardId: string) => `${origin}/c/${cardId}`;

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Couldn't copy automatically. Open the card and copy its link instead.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium">
          {size} cards, each with its own link
        </h2>
        <Button
          type="button"
          size="sm"
          onClick={() =>
            copy(cardIds.map((id, i) => `${i + 1} of ${size}: ${urlFor(id)}`).join("\n"), `Copied ${size} links`)
          }
        >
          <CopyIcon /> Copy all links
        </Button>
      </div>
      <ol className="bg-background max-h-80 divide-y overflow-y-auto rounded-xl border">
        {cardIds.map((cardId, i) => (
          <li key={cardId} className="flex items-center gap-3 px-3 py-2">
            <span className="w-16 shrink-0 text-sm font-medium tabular-nums">
              {i + 1} of {size}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate font-mono text-xs">{cardId}</span>
            <Button asChild variant="ghost" size="icon-sm" aria-label={`Open ${i + 1} of ${size}`}>
              <Link href={`/c/${cardId}`} target="_blank">
                <ExternalLinkIcon />
              </Link>
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Copy link for ${i + 1} of ${size}`}
              onClick={() => copy(urlFor(cardId), `Copied link for ${i + 1} of ${size}`)}
            >
              <CopyIcon />
            </Button>
          </li>
        ))}
      </ol>
    </div>
  );
}
