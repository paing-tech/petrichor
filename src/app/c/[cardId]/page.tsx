import { Suspense, type ReactNode } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLinkIcon } from "lucide-react";
import { AppleMusicEmbed } from "@/components/apple-music-embed";
import { CollectibleCard } from "@/components/collectible-card";
import { ShareActions } from "@/components/share-actions";
import { Button } from "@/components/ui/button";
import { appleMusicSearchUrl, spotifySearchUrl } from "@/lib/apple-music";
import { getCardByCardId } from "@/lib/cards";
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
  const description = card.senderName
    ? `${card.senderName} sent you a song on Petrichor.`
    : "Someone sent you a song on Petrichor.";
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

export default function CardPage({ params }: PageProps<"/c/[cardId]">) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center gap-8 px-4 pt-4 pb-16">
      <Suspense fallback={<CardSkeleton />}>
        <CardView params={params} />
      </Suspense>
    </div>
  );
}

async function CardView({ params }: Pick<PageProps<"/c/[cardId]">, "params">) {
  const card = await findCard(params);
  if (!card) notFound();

  return (
    <>
      <div className="text-center">
        <p className="text-muted-foreground text-sm">
          {card.senderName ? `${card.senderName} sent you a song` : "Someone sent you a song"}
        </p>
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
