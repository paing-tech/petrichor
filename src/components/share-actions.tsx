"use client";

import { useSyncExternalStore } from "react";
import { CheckIcon, CopyIcon, Share2Icon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const subscribeNoop = () => () => {};

function useOrigin() {
  return useSyncExternalStore(subscribeNoop, () => window.location.origin, () => "");
}

function useCanShare() {
  return useSyncExternalStore(subscribeNoop, () => typeof navigator.share === "function", () => false);
}

type ShareActionsProps = {
  path: string;
  title: string;
  showUrl?: boolean;
  className?: string;
};

export function ShareActions({ path, title, showUrl = false, className }: ShareActionsProps) {
  const origin = useOrigin();
  const canShare = useCanShare();
  const url = `${origin}${path}`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied", { icon: <CheckIcon className="size-4" /> });
    } catch {
      toast.error("Couldn't copy automatically. Select the link and copy it instead.");
    }
  }

  async function share() {
    try {
      await navigator.share({ title, url });
    } catch {
      // The user dismissed the share sheet.
    }
  }

  return (
    <div className={cn("flex w-full flex-col gap-2", className)}>
      {showUrl && (
        <Input
          readOnly
          value={url}
          aria-label="Shareable link"
          onFocus={(e) => e.currentTarget.select()}
          className="bg-background h-10 font-mono text-xs md:text-xs"
        />
      )}
      <div className="flex gap-2">
        <Button type="button" size="lg" className="h-10 flex-1" onClick={copy}>
          <CopyIcon /> Copy link
        </Button>
        {canShare && (
          <Button type="button" size="lg" variant="outline" className="h-10 flex-1" onClick={share}>
            <Share2Icon /> Share
          </Button>
        )}
      </div>
    </div>
  );
}
