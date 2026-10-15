"use client";

import Link from "next/link";
import { CopyIcon, ExternalLinkIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import type { CreatedCopyResult } from "@/app/create/actions";

/**
 * After creating: where each copy stands and the links to send. Claim links let
 * whoever opens them keep the card, so they're labelled as private; view links are
 * safe to post anywhere.
 */
export function CreatedCopies({ copies }: { copies: CreatedCopyResult[] }) {
  const origin = useOrigin();
  const size = copies.length;
  const viewUrl = (c: CreatedCopyResult) => `${origin}/c/${c.cardId}`;
  const claimUrl = (c: CreatedCopyResult) => `${origin}/c/${c.cardId}?k=${c.claimToken}`;
  const claimable = copies.filter((c) => c.claimToken);

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
      {claimable.length > 0 && (
        <div className="bg-clay/10 text-foreground rounded-xl p-3 text-sm">
          <p className="font-medium">{claimable.length === 1 ? "Send the claim link" : "Send each claim link"} privately.</p>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Whoever opens a claim link first can keep that card. Send it only to the person it&apos;s for. The view link
            is safe to share anywhere; it can&apos;t be used to keep the card.
          </p>
        </div>
      )}
      {claimable.length > 1 && (
        <Button
          type="button"
          size="sm"
          className="justify-self-end"
          onClick={() =>
            copy(
              claimable.map((c) => `${c.editionNumber} of ${size}: ${claimUrl(c)}`).join("\n"),
              `Copied ${claimable.length} claim links`,
            )
          }
        >
          <CopyIcon /> Copy all claim links
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
              {c.claimToken && "Kept by whoever opens its claim link"}
            </span>
            <span className="flex shrink-0 items-center gap-1">
              {c.claimToken && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => copy(claimUrl(c), `Claim link for ${c.editionNumber} of ${size} copied`)}
                >
                  <CopyIcon /> Claim link
                </Button>
              )}
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                aria-label={`Copy view link for ${c.editionNumber} of ${size}`}
                onClick={() => copy(viewUrl(c), "View link copied")}
              >
                <CopyIcon />
              </Button>
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
