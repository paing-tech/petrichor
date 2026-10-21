import { cache, Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BadgeCheckIcon, ExternalLinkIcon } from "lucide-react";
import {
  ListenPanel,
  ListenPanelSkeleton,
  type ListenSources,
} from "@/components/card/listen-panel";
import {
  DeliveryResponse,
  KeepCard,
} from "@/components/card/ownership-actions";
import { CollectibleCard } from "@/components/collectible-card";
import { FlipCard } from "@/components/flip-card";
import { HeaderShare } from "@/components/card/header-share";
import { Button } from "@/components/ui/button";
import { appleMusicSearchUrl, spotifySearchUrl } from "@/lib/apple-music";
import { getAccount } from "@/lib/auth/account";
import { getCardByCardId } from "@/lib/cards";
import { CLAIM_TOKEN_PATTERN } from "@/lib/claim-token";
import { getCardOwnership, isValidClaimToken } from "@/lib/ownership";
import { getSongMatches } from "@/lib/song-matching";
import { CARD_ID_PATTERN } from "@/lib/validation";

/** Ownership for this request: the caption and the actions below the card share one lookup. */
const loadOwnership = cache(getCardOwnership);

async function findCard(params: PageProps<"/c/[cardId]">["params"]) {
  const { cardId } = await params;
  // Reject malformed IDs before they reach the database (or the cache).
  return CARD_ID_PATTERN.test(cardId) ? getCardByCardId(cardId) : null;
}

export async function generateMetadata({
  params,
}: PageProps<"/c/[cardId]">): Promise<Metadata> {
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

export default function CardPage({
  params,
  searchParams,
}: PageProps<"/c/[cardId]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pb-16">
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
      {/* The front (photo and song) turns over to the message on the back. */}
      <FlipCard
        className="w-full"
        hint={card.message || card.senderName ? "Tap the card to read the message" : "Tap the card to see its back"}
        front={<CollectibleCard card={card} className="max-w-none" />}
        back={<CollectibleCard card={card} face="back" className="max-w-none" />}
      />

      {/* A caption row under the card: its owner on the left (left-aligned with the card's
          edge), "Verified by Petrichor" on the right. Ownership changes, so it's read per
          request, separately from the cached card. */}
      <div className="-mt-4 flex w-full items-center justify-between gap-3">
        <Suspense fallback={<span className="h-5" />}>
          <OwnerCaption cardId={card.cardId} />
        </Suspense>
        <p className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded-full px-[10px] py-0.5 text-xs font-medium">
          <BadgeCheckIcon className="size-3.5" aria-hidden /> Verified by
          Petrichor
        </p>
      </div>

      <Suspense fallback={null}>
        <Ownership cardId={card.cardId} searchParams={searchParams} />
      </Suspense>

      <div className="flex w-full flex-col gap-3">
        {/* The song's players are looked up per request (matches are stored as they're found);
            their place is held meanwhile. */}
        <Suspense fallback={<ListenPanelSkeleton />}>
          <Listen card={card} />
        </Suspense>
      </div>
      {/* Sharing lives in the header, beside the account avatar. */}
      <HeaderShare
        path={`/c/${card.cardId}`}
        title={`${card.songTitle} — a Petrichor card`}
      />
    </>
  );
}

type CardSong = {
  songTitle: string;
  artistName: string;
  appleMusicUrl: string | null;
};

function baseSources(card: CardSong): ListenSources {
  return {
    title: card.songTitle,
    artist: card.artistName,
    appleMusicUrl: card.appleMusicUrl,
    spotifyTrackId: null,
    youtubeVideoId: null,
  };
}

/** The player, with the song matched on Spotify and YouTube where those are set up. */
async function Listen({ card }: { card: CardSong }) {
  const matches = await getSongMatches({
    title: card.songTitle,
    artist: card.artistName,
    appleMusicUrl: card.appleMusicUrl,
  });
  const sources = { ...baseSources(card), ...matches };
  if (
    !sources.appleMusicUrl &&
    !sources.spotifyTrackId &&
    !sources.youtubeVideoId
  ) {
    // Nothing to play here (a typed-in song, matching not set up): link out instead.
    return (
      <div className="flex gap-2">
        <ListenLink href={appleMusicSearchUrl(card.songTitle, card.artistName)}>
          Find on Apple Music
        </ListenLink>
        <ListenLink href={spotifySearchUrl(card.songTitle, card.artistName)}>
          Find on Spotify
        </ListenLink>
      </div>
    );
  }
  return <ListenPanel sources={sources} />;
}

/** The left of the caption row: who owns the card, or that nobody has kept it yet. */
async function OwnerCaption({ cardId }: { cardId: string }) {
  const ownership = await loadOwnership(cardId);
  if (!ownership) return null;
  if (!ownership.owner)
    return <p className="text-muted-foreground text-sm">Not kept yet</p>;
  return (
    <p className="min-w-0 truncate text-sm">
      <span className="text-muted-foreground">Owned by</span>{" "}
      <span className="font-medium">{ownership.owner.displayName}</span>
    </p>
  );
}

/**
 * Below the caption, for a card nobody owns yet: "Keep this card" when the link carries a
 * valid claim code, or Accept/Decline for the account a delivery is waiting on. The card's
 * one link works before and after it's kept: once the code is used or replaced, it just
 * shows the card.
 */
async function Ownership({
  cardId,
  searchParams,
}: {
  cardId: string;
  searchParams: PageProps<"/c/[cardId]">["searchParams"];
}) {
  const ownership = await loadOwnership(cardId);
  if (!ownership || ownership.owner) return null;

  const account = await getAccount();
  if (
    ownership.pendingDelivery &&
    account?.user.id === ownership.pendingDelivery.recipientUserId
  ) {
    return (
      <div className="bg-background flex w-full flex-col items-center gap-3 rounded-xl border p-4 text-center">
        <p className="text-sm">
          This card was sent to your account. Keep it in your collection?
        </p>
        <DeliveryResponse deliveryId={ownership.pendingDelivery.id} />
      </div>
    );
  }

  const { k } = await searchParams;
  const token = typeof k === "string" && CLAIM_TOKEN_PATTERN.test(k) ? k : null;
  if (
    !token ||
    !ownership.claimable ||
    !(await isValidClaimToken(cardId, token))
  )
    return null;
  const state = !account
    ? "signed_out"
    : !account.profile
      ? "needs_profile"
      : "ready";
  return <KeepCard cardId={cardId} token={token} state={state} />;
}

function ListenLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button
      asChild
      size="lg"
      variant="outline"
      className="bg-background h-10 flex-1"
    >
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children} <ExternalLinkIcon />
      </a>
    </Button>
  );
}

function CardSkeleton() {
  return (
    <div className="bg-muted aspect-[3/4] w-full max-w-[420px] animate-pulse rounded-[18px]" />
  );
}
