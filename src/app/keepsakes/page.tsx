import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { DeliveryResponse } from "@/components/card/ownership-actions";
import { CollectibleCard } from "@/components/collectible-card";
import { FlipCard } from "@/components/flip-card";
import { ClaimSavedCards } from "@/components/keepsakes/claim-saved-cards";
import { CreatedCardRow } from "@/components/keepsakes/created-card-row";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/auth/account";
import { signInPath } from "@/lib/auth/sign-in-path";
import { listCollection, listCreated, listPendingDeliveries } from "@/lib/ownership";

export const metadata: Metadata = { title: "Keepsakes", robots: { index: false } };

export default function KeepsakesPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-4 pt-4 pb-16 sm:px-6">
      <Suspense fallback={<h1 className="font-serif text-4xl tracking-tight">My keepsakes</h1>}>
        <Keepsakes />
      </Suspense>
    </div>
  );
}

async function Keepsakes() {
  const account = await getAccount();
  if (!account) redirect(signInPath("/keepsakes"));
  if (!account.profile) redirect("/onboarding?next=/keepsakes");
  const userId = account.user.id;

  const [collection, pending, created] = await Promise.all([
    listCollection(userId),
    listPendingDeliveries(userId),
    listCreated(userId),
  ]);

  return (
    <>
      <ClaimSavedCards />
      {/* The heading, and the collection right under it. */}
      <section className="grid gap-6" aria-labelledby="keepsakes-heading">
        <div>
          <h1 id="keepsakes-heading" className="font-serif text-4xl tracking-tight">Keepsakes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {account.profile.displayName} · @{account.profile.username}
          </p>
        </div>
        {collection.length === 0 ? (
          <div className="text-muted-foreground rounded-2xl border border-dashed p-10 text-center text-sm">
            Cards you keep will live here.{" "}
            <Button asChild variant="link" className="h-auto p-0">
              <Link href="/create">Make a card for yourself</Link>
            </Button>
          </div>
        ) : (
          <ul className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {collection.map((card) => (
              <li key={card.cardId}>
                <Link href={`/c/${card.cardId}`} className="block transition-transform hover:-translate-y-0.5">
                  <CollectibleCard card={card} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {pending.length > 0 && (
        <section className="grid gap-4">
          <h2 className="text-lg font-medium">Waiting for you</h2>
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map(({ deliveryId, sender, card }) => (
              <li key={deliveryId} className="bg-background grid gap-3 rounded-2xl border p-4">
                {/* Turns over to the message, to read before accepting. */}
                <FlipCard
                  className="mx-auto max-w-[240px]"
                  hint="Tap to read the message"
                  front={<CollectibleCard card={card} className="max-w-none" />}
                  back={<CollectibleCard card={card} face="back" className="max-w-none" />}
                />
                <p className="text-sm">
                  From{" "}
                  {sender?.username ? (
                    <span className="font-medium">
                      {sender.displayName} <span className="text-muted-foreground font-normal">@{sender.username}</span>
                    </span>
                  ) : (
                    "someone"
                  )}
                </p>
                <DeliveryResponse deliveryId={deliveryId} />
              </li>
            ))}
          </ul>
        </section>
      )}


      {created.length > 0 && (
        <section className="grid gap-4">
          <div>
            <h2 className="text-lg font-medium">Cards you created</h2>
            <p className="text-muted-foreground text-sm">Only you can see this list.</p>
          </div>
          <ul className="bg-background divide-y rounded-xl border">
            {created.map(({ card, status }) => (
              <CreatedCardRow
                key={card.cardId}
                cardId={card.cardId}
                label={`${card.songTitle} · ${card.editionNumber} of ${card.editionSize}`}
                status={status}
              />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
