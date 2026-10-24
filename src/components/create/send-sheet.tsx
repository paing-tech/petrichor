"use client";

import { useEffect, type ReactNode } from "react";
import { AnimatePresence, motion, useDragControls } from "motion/react";
import { Loader2Icon, MinusIcon, PlusIcon } from "lucide-react";
import { RecipientPicker } from "@/components/create/recipient-picker";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PublicProfile } from "@/lib/profiles";
import { MAX_EDITION_SIZE } from "@/lib/validation";

type SendSheetProps = {
  open: boolean;
  onClose: () => void;
  keepForMe: boolean;
  onKeepForMeChange: (keep: boolean) => void;
  recipients: PublicProfile[];
  onRecipientsChange: (recipients: PublicProfile[]) => void;
  linkCopies: number;
  onLinkCopiesChange: (count: number) => void;
  saving: boolean;
  status: string | null;
  onCreate: () => void;
};

/**
 * The last step before a card is made: who gets a copy. You (copy 1), people by username, and
 * copies with a share link; the edition is all of them, numbered in that order. Slides up over
 * the preview, so the card stays in view; tap outside, swipe it down or press Escape to go back.
 * Its button makes the card.
 */
export function SendSheet({
  open,
  onClose,
  keepForMe,
  onKeepForMeChange,
  recipients,
  onRecipientsChange,
  linkCopies,
  onLinkCopiesChange,
  saving,
  status,
  onCreate,
}: SendSheetProps) {
  const total = (keepForMe ? 1 : 0) + recipients.length + linkCopies;
  const room = MAX_EDITION_SIZE - total;
  // Dragged down by its handle only, so scrolling and the people search work as usual.
  const dragControls = useDragControls();

  // Escape closes it (unless the card is being made).
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, saving, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !saving && onClose()}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-sheet-title"
            className="bg-background absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl px-5 pt-3 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            drag={saving ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 600) onClose();
            }}
          >
            {/* The grab handle: drag it down (or tap outside, or press Escape) to go back. */}
            <div
              aria-hidden
              className="-mt-3 flex cursor-grab touch-none justify-center pt-3 pb-3 active:cursor-grabbing"
              onPointerDown={(event) => dragControls.start(event)}
            >
              <div className="bg-foreground/25 h-1.5 w-14 rounded-full" />
            </div>
            <h2 id="send-sheet-title" className="font-serif text-2xl tracking-tight">
              Who gets this keepsake?
            </h2>

            <div className="mt-4 grid gap-5">
              {/* Side by side: you, and people (each with its control under its name). */}
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-6">
                <div className="grid gap-2">
                  {/* Same type as the People label beside it, so the two line up. */}
                  <p className="text-sm leading-none font-medium">Me</p>
                  <div className="flex h-10 items-center">
                    <Switch checked={keepForMe} onCheckedChange={onKeepForMeChange} aria-label="Keep a copy for me" />
                  </div>
                </div>
                <RecipientPicker max={Math.max(recipients.length, recipients.length + room)} value={recipients} onChange={onRecipientsChange} />
              </div>

              <Row title="Share by link" detail="Whoever opens a link first keeps that copy">
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="One link fewer"
                    disabled={linkCopies === 0}
                    onClick={() => onLinkCopiesChange(linkCopies - 1)}
                  >
                    <MinusIcon />
                  </Button>
                  <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">
                    {linkCopies}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    aria-label="One more link"
                    disabled={room === 0}
                    onClick={() => onLinkCopiesChange(linkCopies + 1)}
                  >
                    <PlusIcon />
                  </Button>
                </div>
              </Row>

              <div className="grid gap-2">
                {/* The edition, in a line (nothing while nobody's chosen: the title asks already). */}
                <p className="text-muted-foreground min-h-4 text-center text-xs" aria-live="polite">
                  {total === 1 ? "1 of 1" : total > 1 ? `1 of ${total} – ${total} of ${total}` : ""}
                </p>
                <Button type="button" size="lg" className="w-full" disabled={total === 0 || saving} onClick={onCreate}>
                  {saving ? (
                    <>
                      <Loader2Icon className="animate-spin" /> {status ?? "Saving…"}
                    </>
                  ) : total > 1 ? (
                    `Create ${total} keepsakes`
                  ) : (
                    "Create keepsake"
                  )}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/** One choice in the sheet: its name and a line about it on the left, its control on the right. */
function Row({ title, detail, children }: { title: string; detail: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-muted-foreground text-xs">{detail}</p>
      </div>
      {children}
    </div>
  );
}
