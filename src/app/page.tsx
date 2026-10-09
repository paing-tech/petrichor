import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { CollectibleCard } from "@/components/collectible-card";
import { Button } from "@/components/ui/button";

const SAMPLE_CARD = {
  songTitle: "Here Comes the Sun",
  artistName: "The Beatles",
  lyricsExcerpt: "Little darling, it's been a long, cold, lonely winter",
  message: "For the first warm morning after all that rain. Thank you for staying with me through it.",
  senderName: "Mai",
  cardId: "P-1F8K2QZ7M4XW9C3T6RBNJD5HVA",
};

export default function Home() {
  return (
    <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-4 pt-6 pb-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
      <div className="max-w-xl">
        <p className="text-clay mb-4 text-sm font-medium tracking-wide">Music memory cards</p>
        <h1 className="font-serif text-5xl leading-[1.05] tracking-tight sm:text-6xl">
          A song, a moment, and the person it reminds you of.
        </h1>
        <p className="text-muted-foreground mt-6 text-lg">
          Petrichor turns a song and a few words into a collectible card. Add a photo and the lyric that
          says it best, then send the link — nobody needs an account.
        </p>
        <Button asChild size="lg" className="mt-8 h-11 px-6">
          <Link href="/create">
            Create a card <ArrowRightIcon />
          </Link>
        </Button>
      </div>
      <CollectibleCard card={SAMPLE_CARD} spinning className="mx-auto max-w-[340px] sm:max-w-[400px]" />
    </div>
  );
}
