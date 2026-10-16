"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { SignInForm } from "@/components/account/sign-in-form";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Height of one button row (h-11); the sign-in form's first row is its Google button. */
const ROW_HEIGHT = 44;
const EASE = "duration-300 ease-out motion-reduce:transition-none";

type HomeActionsProps = {
  /** Where a signed-in visitor's collection link goes, or null when signed out. */
  collectionHref: string | null;
  /** Where to go after signing in. */
  next?: string;
  /** Open the sign-in form straight away (another page sent the visitor here to sign in). */
  startOpen?: boolean;
};

/**
 * Under the home artwork: "Create a keepsake" and "Sign in". Signing in opens the form out
 * of the Sign in button: Create fades and folds away, Sign in turns into "Continue with
 * Google" as it glides up, and the rest of the form unfolds below. Back reverses it.
 * Signed-in visitors get their collection instead.
 */
export function HomeActions({ collectionHref, next = "/keepsakes", startOpen = false }: HomeActionsProps) {
  const [open, setOpen] = useState(startOpen);
  // Once fully open, the form stops clipping, so focus rings at its edges show.
  const [settled, setSettled] = useState(startOpen);
  // The code step has its own "Use a different email", so Back steps aside for it.
  const [step, setStep] = useState<"email" | "code">("email");
  const formRef = useRef<HTMLDivElement>(null);
  const [formHeight, setFormHeight] = useState(ROW_HEIGHT);

  // Track the form's natural height (it changes when it moves on to the code step).
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const observer = new ResizeObserver(() => setFormHeight(form.scrollHeight));
    observer.observe(form);
    return () => observer.disconnect();
  }, []);

  if (collectionHref) {
    return (
      <div className="grid w-full max-w-77 gap-3">
        <CreateButton />
        <Button asChild variant="outline" size="lg" className="bg-background h-11">
          <Link href={collectionHref}>My keepsakes</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-77">
      {/* Create, folding away: its row (and the gap under it) closes as it fades. */}
      <div
        className={cn("grid transition-[grid-template-rows,opacity]", EASE, open ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr]")}
        inert={open}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="pb-3">
            <CreateButton />
          </div>
        </div>
      </div>

      {/* The form, shown one row tall (its Google button) under the Sign in button, then unfolded. */}
      <div
        className={cn("relative transition-[height]", EASE, settled ? "overflow-visible" : "overflow-hidden")}
        style={{ height: open ? formHeight : ROW_HEIGHT }}
        onTransitionEnd={(e) => e.target === e.currentTarget && setSettled(open)}
      >
        <div ref={formRef} inert={!open}>
          <SignInForm next={next} onStepChange={setStep} />
        </div>
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "bg-background absolute inset-x-0 top-0 h-11 transition-opacity",
            EASE,
            open && "pointer-events-none opacity-0",
          )}
          tabIndex={open ? -1 : undefined}
          aria-hidden={open}
          onClick={() => setOpen(true)}
        >
          Sign in
        </Button>
      </div>

      {/* Back, unfolding with the form (and folding away on the code step). */}
      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity]",
          EASE,
          open && step === "email" ? "grid-rows-[1fr]" : "grid-rows-[0fr] opacity-0",
        )}
        inert={!open || step !== "email"}
      >
        <div className="min-h-0 overflow-hidden">
          {/* Styled like the form's "Use a different email": plain text, no background. */}
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground mx-auto mt-1 flex items-center gap-1 text-sm"
            onClick={() => {
              setSettled(false);
              setOpen(false);
            }}
          >
            <ArrowLeftIcon className="size-3.5" /> Back
          </button>
        </div>
      </div>
    </div>
  );
}

function CreateButton() {
  return (
    <Button asChild size="lg" className="h-11 w-full">
      <Link href="/create">Create a keepsake</Link>
    </Button>
  );
}

/** Same footprint as HomeActions while the session loads, so nothing shifts. */
export function HomeActionsFallback() {
  return (
    <div className="grid w-full max-w-77 gap-3">
      <CreateButton />
      <div className="h-11" />
    </div>
  );
}
