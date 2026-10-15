"use client";

import { useState } from "react";
import Link from "next/link";
import { CopyIcon, Loader2Icon, RefreshCwIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { reissueClaimLinkAction } from "@/app/keepsakes/actions";
import type { CreatedCardStatus } from "@/lib/ownership";

type CreatedCardRowProps = {
  cardId: string;
  label: string;
  status: CreatedCardStatus;
};

/** One copy you created: who has it now, and a fresh claim link for unclaimed copies. */
export function CreatedCardRow({ cardId, label, status }: CreatedCardRowProps) {
  const origin = useOrigin();
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function newLink() {
    if (!confirm("Make a new claim link? The previous link for this copy will stop working.")) return;
    setBusy(true);
    const result = await reissueClaimLinkAction(cardId);
    setBusy(false);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    const url = `${origin}/c/${cardId}?k=${result.token}`;
    setLink(url);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("New claim link copied. Send it only to who should keep this card.");
    } catch {
      toast.success("New claim link ready");
    }
  }

  return (
    <li className="grid gap-2 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Link href={`/c/${cardId}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:underline">
          {label}
        </Link>
        <span className="text-muted-foreground shrink-0 text-xs">
          {status.kind === "owned_by_you" && "In your collection"}
          {status.kind === "owned" && `Kept by @${status.owner.username}`}
          {status.kind === "pending" && `Waiting for @${status.recipient.username}`}
          {status.kind === "unclaimed" && "Not kept yet"}
        </span>
        {status.kind === "unclaimed" && (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={newLink}>
            {busy ? <Loader2Icon className="animate-spin" /> : <RefreshCwIcon />} New claim link
          </Button>
        )}
      </div>
      {link && (
        <div className="bg-muted flex items-center gap-2 rounded-md px-2 py-1.5">
          <span className="min-w-0 flex-1 truncate font-mono text-xs">{link}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            aria-label="Copy claim link"
            onClick={() => navigator.clipboard.writeText(link).then(() => toast.success("Copied"))}
          >
            <CopyIcon />
          </Button>
        </div>
      )}
    </li>
  );
}
