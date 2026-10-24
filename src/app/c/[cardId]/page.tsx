import { cache, Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
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
import { ListeningCard } from "@/components/card/listening-card";
import { HeaderShare } from "@/components/card/header-share";
import { Button } from "@/components/ui/button";
import { appleMusicSearchUrl, spotifySearchUrl } from "@/lib/apple-music";
import { getAccount } from "@/lib/auth/account";
import { getCardByCardId } from "@/lib/cards";
import { CLAIM_TOKEN_PATTERN } from "@/lib/claim-token";
import { getCardOwnership, isValidClaimToken } from "@/lib/ownership";
import { getSongMatches } from "@/lib/song-matching";
import { getYouTubeAspect } from "@/lib/youtube-shape";
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
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-2 px-6 pb-2">
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
      {/* The front (photo and song) turns over to the message on the back. While the song
          plays here, the card waits small in the corner (see ListeningCard). */}
      <ListeningCard>
        <FlipCard
          className="w-full"
          front={<CollectibleCard card={card} className="max-w-none" />}
          back={<CollectibleCard card={card} face="back" className="max-w-none" />}
        />
      </ListeningCard>

      {/* Under the card: its owner's @username, left-aligned with the card's edge. Ownership
          changes, so it's read per request, separately from the cached card. Hidden while the
          song plays here (listening mode), with the keep / accept actions. */}
      {/* 8px under the card, indented like the card's text (28 of its 390 units: 7.18% of its
          width, which this row shares). */}
      <div className="flex w-full items-center gap-3 pl-[7.18%] [html[data-listening]_&]:hidden">
        <Suspense fallback={<span className="h-5" />}>
          <OwnerCaption cardId={card.cardId} />
        </Suspense>
      </div>

      <div className="flex w-full flex-col">
        {/* The song's players are looked up per request (matches are stored as they're found);
            their place is held meanwhile. */}
        <Suspense fallback={<ListenPanelSkeleton />}>
          <Listen card={card} />
        </Suspense>
      </div>

      {/* Keep / accept, under the players (and Spotify's, when it opens). */}
      <div className="contents [html[data-listening]_&]:hidden">
        <Suspense fallback={null}>
          <Ownership cardId={card.cardId} searchParams={searchParams} />
        </Suspense>
      </div>
      {/* Sharing lives in the header, beside the account avatar. */}
      <HeaderShare
        path={`/c/${card.cardId}`}
        title={`${card.songTitle} — a Petrichor card`}
        imagePath={`/c/${card.cardId}/share-image`}
      />
    </>
  );
}

type CardSong = {
  songTitle: string;
  artistName: string;
  appleMusicUrl: string | null;
  message: string | null;
  senderName: string | null;
  /** The creator's own YouTube pick, when the song wasn't found on YouTube. */
  youtubeVideoId: string | null;
  /** The part of the song the creator chose, and the video it was chosen on. */
  clipVideoId: string | null;
  clipStart: number | null;
  clipEnd: number | null;
};

function baseSources(card: CardSong): ListenSources {
  return {
    title: card.songTitle,
    artist: card.artistName,
    appleMusicUrl: card.appleMusicUrl,
    spotifyTrackId: null,
    youtubeVideoId: null,
    youtubeAspect: null,
    message: card.message,
    signature: card.senderName,
    clip: null,
  };
}

/** The player, with the song matched on Spotify and YouTube where those are set up. */
async function Listen({ card }: { card: CardSong }) {
  const matches = await getSongMatches({
    title: card.songTitle,
    artist: card.artistName,
    appleMusicUrl: card.appleMusicUrl,
  });
  // The creator's pick, if they made one, over the song's shared match.
  const youtubeVideoId = card.youtubeVideoId ?? matches.youtubeVideoId;
  const youtubeAspect = youtubeVideoId ? await getYouTubeAspect(youtubeVideoId) : null;
  // The chosen part only applies on the video it was chosen on (times differ between videos).
  const clip =
    youtubeVideoId && card.clipVideoId === youtubeVideoId && card.clipStart !== null && card.clipEnd !== null
      ? { start: card.clipStart, end: card.clipEnd }
      : null;
  const sources = { ...baseSources(card), ...matches, youtubeVideoId, youtubeAspect, clip };
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

/** Under the card: its owner's @username (small); nothing while nobody has kept it. */
async function OwnerCaption({ cardId }: { cardId: string }) {
  const ownership = await loadOwnership(cardId);
  if (!ownership?.owner) return null;
  return (
    <p className="font-outfit text-muted-foreground min-w-0 truncate text-sm">
      @{ownership.owner.username}
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
