"use client";

import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, DownloadIcon, ImageIcon, LinkIcon, ShareIcon } from "lucide-react";
import { toast } from "sonner";
import { useOrigin } from "@/components/share-actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const subscribeNoop = () => () => {};

/** Whether the device's share sheet takes files (phones, mostly); elsewhere the image is downloaded. */
function canShareFiles() {
  try {
    return navigator.canShare?.({ files: [new File([""], "card.png", { type: "image/png" })] }) ?? false;
  } catch {
    return false;
  }
}

/**
 * A share icon in the site header, beside the account avatar (the layout's #header-actions
 * slot), for the page it's rendered on: copy its link, share it through the device's share
 * sheet where there is one, and, given `imagePath`, share (or save) its share image.
 */
export function HeaderShare({ path, title, imagePath }: { path: string; title: string; imagePath?: string }) {
  const slot = useSyncExternalStore(subscribeNoop, () => document.getElementById("header-actions"), () => null);
  const canShare = useSyncExternalStore(subscribeNoop, () => typeof navigator.share === "function", () => false);
  const canShareImage = useSyncExternalStore(subscribeNoop, canShareFiles, () => false);
  const origin = useOrigin();
  const url = `${origin}${path}`;
  // The image, fetched as soon as the menu opens: phones only open the share sheet straight
  // after a tap, so it should be ready by the time "Share image" is tapped.
  const image = useRef<Promise<File> | null>(null);
  if (!slot) return null;

  function loadImage() {
    if (!imagePath) return null;
    image.current ??= fetch(imagePath).then(async (response) => {
      if (!response.ok) throw new Error(`Share image failed (${response.status})`);
      const name = imagePath.split("/").filter(Boolean).slice(-2, -1)[0] ?? "card";
      return new File([await response.blob()], `petrichor-${name}.png`, { type: "image/png" });
    });
    image.current.catch(() => {
      image.current = null; // Try again next time.
    });
    return image.current;
  }

  async function shareImage() {
    const pending = loadImage();
    if (!pending) return;
    let file: File;
    try {
      file = await pending;
    } catch {
      toast.error("Couldn't make the image. Please try again.");
      return;
    }
    if (canShareImage) {
      try {
        await navigator.share({ files: [file], title });
      } catch (error) {
        // Took too long after the tap for the phone to allow it: it's ready now.
        if (error instanceof DOMException && error.name === "NotAllowedError") {
          toast("The image is ready", { action: { label: "Share", onClick: () => navigator.share({ files: [file], title }).catch(() => {}) } });
        }
        // Otherwise the share sheet was dismissed.
      }
      return;
    }
    // No share sheet for files (most computers): download it.
    const link = document.createElement("a");
    link.href = URL.createObjectURL(file);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 10_000);
  }

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
    <DropdownMenu onOpenChange={(open) => open && loadImage()}>
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
        {imagePath && (
          <DropdownMenuItem onSelect={shareImage}>
            {canShareImage ? (
              <>
                <ImageIcon /> Share image
              </>
            ) : (
              <>
                <DownloadIcon /> Save image
              </>
            )}
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>,
    slot,
  );
}
