import { Suspense } from "react";
import Link from "next/link";
import type { CollectibleCardData } from "@/components/collectible-card";
import { FloatingCards } from "@/components/home/floating-cards";
import { Button } from "@/components/ui/button";
import { getAccount } from "@/lib/auth/account";

const SAMPLE_CARD: CollectibleCardData = {
  songTitle: "Here Comes the Sun",
  artistName: "The Beatles",
  lyricsExcerpt: "Little darling, it's been a long, cold, lonely winter",
  message: "For the first warm morning after all that rain.",
  senderName: "Mai",
  moment: "Singapore",
  createdAt: "2026-10-10",
  cardId: "P-1F8K2QZ7M4XW9C3T6RBNJD5HVA",
};

/** The cards on the home page's sphere; fewer than 18 repeat to fill it. Add more cards to this list. */
const FLOATING_CARDS: CollectibleCardData[] = [SAMPLE_CARD];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="relative min-h-100 flex-1">
        <FloatingCards cards={FLOATING_CARDS} />
      </div>
      <div className="flex flex-col items-center gap-2 pt-2 pb-8">
        <Button asChild size="lg" className="h-11 px-6">
          <Link href="/create">Create a keepsake</Link>
        </Button>
        <Suspense fallback={<div className="h-9" />}>
          <AccountLink />
        </Suspense>
      </div>
    </div>
  );
}

/** Sign in for visitors; the collection for anyone already signed in. */
async function AccountLink() {
  const account = await getAccount();
  const href = !account ? "/sign-in?next=/keepsakes" : account.profile ? "/keepsakes" : "/onboarding?next=/keepsakes";
  return (
    <Button asChild variant="ghost" size="lg" className="text-muted-foreground h-9">
      <Link href={href}>{account ? "My keepsakes" : "Sign in"}</Link>
    </Button>
  );
}
