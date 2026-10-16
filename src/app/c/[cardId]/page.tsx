import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { AppleMusicEmbed } from "@/components/apple-music-embed";
import { UserAvatar } from "@/components/account/user-avatar";
import { DeliveryResponse, KeepCard } from "@/components/card/ownership-actions";
import { CollectibleCard } from "@/components/collectible-card";
import { ShareActions } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { appleMusicSearchUrl, spotifySearchUrl } from "@/lib/apple-music";
import { getAccount } from "@/lib/auth/account";
import { getCardByCardId } from "@/lib/cards";
import { CLAIM_TOKEN_PATTERN } from "@/lib/claim-token";
import { getCardOwnership, isValidClaimToken } from "@/lib/ownership";
import { CARD_ID_PATTERN } from "@/lib/validation";

async function findCard(params: PageProps<"/c/[cardId]">["params"]) {
  const { cardId } = await params;
  // Reject malformed IDs before they reach the database (or the cache).
  return CARD_ID_PATTERN.test(cardId) ? getCardByCardId(cardId) : null;
}

export async function generateMetadata({ params }: PageProps<"/c/[cardId]">): Promise<Metadata> {
  const card = await findCard(params);
  if (!card) return { title: "Card not found" };

  const title = `${card.songTitle} — ${card.artistName}`;
  const description = `A music keepsake on Petrichor: ${card.songTitle} by ${card.artistName}.`;
  return {
    title,
    description,
    // Cards are shared privately by link; keep them out of search results.
    robots: { index: false, follow: false },
    openGraph: {
      title,
      description,
      images: card.photoUrl ? [card.photoUrl] : undefined,
    },
  };
}

export default function CardPage({ params, searchParams }: PageProps<"/c/[cardId]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
      <Suspense fallback={<CardSkeleton />}>
        <CardView params={params} searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function CardView({ params, searchParams }: PageProps<"/c/[cardId]">) {
  const card = await findCard(params);
  if (!card) notFound();

  return (
    <>
      <div className="text-center">
        <p className="text-muted-foreground text-sm">A Petrichor keepsake</p>
        <p className="text-muted-foreground/70 mt-1 text-xs">
          {card.createdAt.toLocaleDateString("en-US", {
            year: "numeric",
            month: "long",
            day: "numeric",
            timeZone: card.timeZone ?? "UTC",
          })}
        </p>
      </div>

      <CollectibleCard card={card} className="max-w-[420px]" />

      {/* Ownership changes, so it's read per request, separately from the cached card. */}
      <Suspense fallback={<div className="h-12" />}>
        <Ownership cardId={card.cardId} searchParams={searchParams} />
      </Suspense>

      <div className="flex w-full flex-col gap-3">
        {card.appleMusicUrl && <AppleMusicEmbed url={card.appleMusicUrl} title={card.songTitle} />}
        <div className="flex gap-2">
          {!card.appleMusicUrl && (
            <ListenLink href={appleMusicSearchUrl(card.songTitle, card.artistName)}>Find on Apple Music</ListenLink>
          )}
          <ListenLink href={spotifySearchUrl(card.songTitle, card.artistName)}>Find on Spotify</ListenLink>
        </div>
        <ShareActions path={`/c/${card.cardId}`} title={`${card.songTitle} — a Petrichor card`} />
        <Button asChild variant="link" className="text-muted-foreground">
          <Link href="/create">Make your own card</Link>
        </Button>
      </div>
    </>
  );
}

/**
 * Below the card: the owner (public), or, for an unowned card, "Keep this card" when the
 * link carries a valid claim code and Accept/Decline for the account a delivery is waiting
 * on. The card's one link works before and after it's kept: once the code is used or
 * replaced, it just shows the card.
 */
async function Ownership({
  cardId,
  searchParams,
}: {
  cardId: string;
  searchParams: PageProps<"/c/[cardId]">["searchParams"];
}) {
  const ownership = await getCardOwnership(cardId);
  if (!ownership) return null;

  if (ownership.owner) {
    const { owner } = ownership;
    return (
      <div className="flex items-center gap-3">
        <UserAvatar displayName={owner.displayName} avatarUrl={owner.avatarUrl} className="size-10" />
        <div className="min-w-0">
          <p className="text-muted-foreground text-xs">Owned by</p>
          <p className="truncate text-sm font-medium">
            {owner.displayName} <span className="text-muted-foreground font-normal">@{owner.username}</span>
          </p>
        </div>
      </div>
    );
  }

  const account = await getAccount();
  if (ownership.pendingDelivery && account?.user.id === ownership.pendingDelivery.recipientUserId) {
    return (
      <div className="bg-background flex w-full flex-col items-center gap-3 rounded-xl border p-4 text-center">
        <p className="text-sm">This card was sent to your account. Keep it in your collection?</p>
        <DeliveryResponse deliveryId={ownership.pendingDelivery.id} />
      </div>
    );
  }

  const { k } = await searchParams;
  const token = typeof k === "string" && CLAIM_TOKEN_PATTERN.test(k) ? k : null;
  if (!token || !ownership.claimable || !(await isValidClaimToken(cardId, token))) {
    return <p className="text-muted-foreground text-sm">Not kept yet</p>;
  }
  const state = !account ? "signed_out" : !account.profile ? "needs_profile" : "ready";
  return <KeepCard cardId={cardId} token={token} state={state} />;
}

function ListenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild size="lg" variant="outline" className="bg-background h-10 flex-1">
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children} <ExternalLinkIcon />
      </a>
    </Button>
  );
}

function CardSkeleton() {
  return (
    <>
      <div className="flex flex-col items-center gap-2">
        <div className="bg-muted h-4 w-40 animate-pulse rounded" />
        <div className="bg-muted h-3 w-24 animate-pulse rounded" />
      </div>
      <div className="bg-muted aspect-[3/4] w-full max-w-[420px] animate-pulse rounded-[18px]" />
    </>
  );
}
