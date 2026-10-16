"use client";

import Link from "next/link";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import type { CreatedCopyResult } from "@/app/create/actions";

/**
 * After creating: where each copy stands and its one link. A copy nobody keeps yet
 * gets a link carrying its claim code, so whoever opens it can keep the card; once
 * it's kept the code stops working and the same link just shows the card.
 */
export function CreatedCopies({ copies }: { copies: CreatedCopyResult[] }) {
  const origin = useOrigin();
  const size = copies.length;
  const linkFor = (c: CreatedCopyResult) =>
    c.claimToken ? `${origin}/c/${c.cardId}?k=${c.claimToken}` : `${origin}/c/${c.cardId}`;
  const claimable = copies.filter((c) => c.claimToken).length;

  async function copy(text: string, message: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(message);
    } catch {
      toast.error("Couldn't copy automatically.");
    }
  }

  return (
    <div className="grid w-full gap-3">
      {claimable > 0 && (
        <div className="bg-clay/10 text-foreground rounded-xl p-3 text-sm">
          <p className="font-medium">{claimable === 1 ? "Send the link" : "Send each link"} privately.</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Whoever opens it first can keep the card, so send it only to the person it&apos;s for. Once it&apos;s
            kept, the link is safe to share anywhere.
          </p>
        </div>
      )}
      {size > 1 && (
        <Button
          type="button"
          size="sm"
          className="justify-self-end"
          onClick={() =>
            copy(
              copies.map((c) => `${c.editionNumber} of ${size}: ${linkFor(c)}`).join("\n"),
              `Copied ${size} links`,
            )
          }
        >
          <CopyIcon /> Copy all links
        </Button>
      )}
      <ol className="bg-background max-h-96 divide-y overflow-y-auto rounded-xl border">
        {copies.map((c) => (
          <li key={c.cardId} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2.5">
            <span className="w-14 shrink-0 text-sm font-medium tabular-nums">
              {c.editionNumber} of {size}
            </span>
            <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">
              {c.ownedByYou && "In your collection"}
              {c.recipient && `Sent to @${c.recipient.username} · waiting for them to accept`}
              {c.claimToken && "Whoever opens this link can keep it"}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => copy(linkFor(c), size > 1 ? `Link for ${c.editionNumber} of ${size} copied` : "Link copied")}
              >
                <CopyIcon /> Copy link
              </Button>
              {/* Opens the plain card page, so opening it here doesn't offer to keep it. */}
              <Button asChild size="icon-sm" variant="ghost" aria-label={`Open ${c.editionNumber} of ${size}`}>
                <Link href={`/c/${c.cardId}`} target="_blank">
                  <ExternalLinkIcon />
                </Link>
              </Button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
