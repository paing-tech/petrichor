"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckIcon, Loader2Icon, XIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { acceptDeliveryAction, claimCardAction, declineDeliveryAction } from "@/app/keepsakes/actions";
import { signInPath } from "@/lib/auth/sign-in-path";

type KeepCardProps = {
  cardId: string;
  token: string;
  state: "signed_out" | "needs_profile" | "ready";
};

/** "Keep this card" on a valid claim link. Signs people in first if needed, then returns here. */
export function KeepCard({ cardId, token, state }: KeepCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const here = `/c/${cardId}?k=${encodeURIComponent(token)}`;

  if (state !== "ready") {
    const href =
      state === "signed_out"
        ? signInPath(here)
        : `/onboarding?next=${encodeURIComponent(here)}`;
    return (
      <Button asChild size="lg" className="w-full">
        <Link href={href}>{state === "signed_out" ? "Sign in to keep it" : "Choose a username to keep it"}</Link>
      </Button>
    );
  }

  return (
    <Button
        size="lg"
        className="w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await claimCardAction({ cardId, token });
            if (!result.ok) {
              toast.error(result.error);
              return;
            }
            toast.success("It's yours. Find it in your keepsakes.");
            // Drop the claim code from the address bar now that it's used.
            router.replace(`/c/${cardId}`);
            router.refresh();
          })
        }
      >
        {pending && <Loader2Icon className="animate-spin" />} Keep it
      </Button>
  );
}

/** Accept or decline a card sent straight to your account. */
export function DeliveryResponse({ deliveryId }: { deliveryId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<"accept" | "decline" | null>(null);

  async function respond(kind: "accept" | "decline") {
    setPending(kind);
    const result = kind === "accept" ? await acceptDeliveryAction(deliveryId) : await declineDeliveryAction(deliveryId);
    setPending(null);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(kind === "accept" ? "Added to your collection" : "Declined");
    router.refresh();
  }

  return (
    <div className="flex gap-2">
      <Button size="sm" disabled={pending !== null} onClick={() => respond("accept")}>
        {pending === "accept" ? <Loader2Icon className="animate-spin" /> : <CheckIcon />} Accept
      </Button>
      <Button size="sm" variant="outline" disabled={pending !== null} onClick={() => respond("decline")}>
        {pending === "decline" ? <Loader2Icon className="animate-spin" /> : <XIcon />} Decline
      </Button>
    </div>
  );
}
