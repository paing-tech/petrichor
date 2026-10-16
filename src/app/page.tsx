import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import type { CollectibleCardData } from "@/components/collectible-card";
import { HomeActions, HomeActionsFallback } from "@/components/home/home-actions";
import { TiltArtwork } from "@/components/home/tilt-artwork";
import { TodayCard } from "@/components/home/today-card";
import { afterSignInPath, getAccount, safeNextPath } from "@/lib/auth/account";

const SAMPLE_CARD: CollectibleCardData = {
  songTitle: "Here Comes the Sun",
  artistName: "The Beatles",
  lyricsExcerpt: "Little darling, it's been a long, cold, lonely winter",
  message: "For the first warm morning after all that rain.",
  senderName: "Petrichor Team",
  moment: "Reverie",
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
/** Where the green glow under the card fades to white. */
const GLOW_BOTTOM = 1317;
const pct = (value: number, of: number) => `${(value / of) * 100}%`;

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    // Anchored to the top (not centered) so the artwork stays put when the sign-in form opens.
    <div className="flex flex-1 flex-col items-center px-4">
      {/* Artwork size: grows with the screen height (leaving room for the header and the
          buttons below), from 300px up to 600px wide. */}
      <div className="@container flex w-full max-w-[clamp(300px,calc((100svh-230px)*0.74),600px)] flex-col items-center">
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
            <TodayCard card={SAMPLE_CARD} bare className="max-w-none" />
          </div>
        </TiltArtwork>
        {/* Starts 8px below the glow (the artwork's white margin under it is pulled up). */}
        <div
          className="relative flex w-full flex-col items-center"
          style={{ marginTop: `calc(-20px - 100cqw * ${(VIEW.top + VIEW.height - GLOW_BOTTOM) / VIEW.width})` }}
        >
          <Suspense fallback={<HomeActionsFallback />}>
            <Actions searchParams={searchParams} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}

/**
 * Reads the session and the URL, so it renders per request inside <Suspense>. Pages that
 * need a signed-in visitor send them to `/?next=…`: the sign-in form opens right away and
 * returns them to `next` afterwards (or sends them straight there if already signed in).
 */
async function Actions({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [account, params] = await Promise.all([getAccount(), searchParams]);
  const requested = params.next !== undefined;
  const next = safeNextPath(params.next);
  if (account && requested) redirect(afterSignInPath(account.profile, next));
  const collectionHref = !account ? null : afterSignInPath(account.profile, "/keepsakes");
  return <HomeActions collectionHref={collectionHref} next={next} startOpen={requested} />;
}
