import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { CollectibleCard, type CollectibleCardData } from "@/components/collectible-card";
import { TiltArtwork } from "@/components/home/tilt-artwork";
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
  // The artwork's green, so the text picks matching ink.
  cardColor: "#a3b18a",
};

// public/ethereal-floating.png is cropped to the artwork (her arms reach both sides) and
// draws a card with its glow below. Measurements are in units of the artwork at 1000 × 1350;
// the file itself is exported larger (1.5×) for sharp retina screens, which changes nothing
// here as long as the shape stays the same. The card's text sits on the drawn card (x 160–840,
// y 248–1154), and the button sits in the glow just under it.
const ART = { width: 1000, height: 1350 };
const VIEW = { left: 0, top: 0, width: 1000, height: 1350 };
const CARD = { left: 160, top: 248, width: 680, bottom: 1154 };
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pt-1 pb-8">
      {/* Artwork size: grows with the screen height (leaving room for the header and the
          link below), from 300px up to 600px wide. */}
      <div className="@container flex w-full max-w-[clamp(300px,calc((100svh-170px)*0.74),600px)] flex-col items-center">
        <TiltArtwork className="relative w-full overflow-hidden" style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }}>
          <Image
            src="/ethereal-floating.png"
            alt=""
            width={ART.width}
            height={ART.height}
            priority
            // Served as-is: Next's default compression (WebP at quality 75) smears the fine pencil texture.
            unoptimized
            className="absolute h-auto max-w-none"
            style={{
              width: pct(ART.width, VIEW.width),
              left: pct(-VIEW.left, VIEW.width),
              top: pct(-VIEW.top, VIEW.height),
            }}
          />
          <div
            className="absolute"
            style={{
              left: pct(CARD.left - VIEW.left, VIEW.width),
              top: pct(CARD.top - VIEW.top, VIEW.height),
              width: pct(CARD.width, VIEW.width),
            }}
          >
            <CollectibleCard card={SAMPLE_CARD} bare className="max-w-none" />
          </div>
        </TiltArtwork>
        {/* Pulled up into the glow so the button sits 14px under the drawn card's edge. */}
        <div
          className="relative flex flex-col items-center gap-2"
          style={{ marginTop: `calc(14px - 100cqw * ${(VIEW.top + VIEW.height - CARD.bottom) / VIEW.width})` }}
        >
          <Button asChild size="lg" className="h-11 px-6">
            <Link href="/create">Create a keepsake</Link>
          </Button>
          <Suspense fallback={<div className="h-9" />}>
            <AccountLink />
          </Suspense>
        </div>
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
