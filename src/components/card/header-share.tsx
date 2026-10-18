"use client";

import { useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, LinkIcon, ShareIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const subscribeNoop = () => () => {};

/**
 * A share icon in the site header, beside the account avatar (the layout's #header-actions
 * slot), for the page it's rendered on: copy its link, or share it through the device's
 * share sheet where there is one.
 */
export function HeaderShare({ path, title }: { path: string; title: string }) {
  const slot = useSyncExternalStore(subscribeNoop, () => document.getElementById("header-actions"), () => null);
  const canShare = useSyncExternalStore(subscribeNoop, () => typeof navigator.share === "function", () => false);
  const origin = useOrigin();
  const url = `${origin}${path}`;
  if (!slot) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { icon: <CheckIcon className="size-4" /> });
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The share sheet was dismissed.
    }
  }

  return createPortal(
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Share"
        className="text-foreground hover:bg-muted focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-3"
      >
        <ShareIcon className="size-[18px]" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onSelect={copy}>
          <LinkIcon /> Copy link
        </DropdownMenuItem>
        {canShare && (
          <DropdownMenuItem onSelect={share}>
            <ShareIcon /> Share…
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>,
    slot,
  );
}
