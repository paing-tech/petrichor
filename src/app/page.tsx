import { Suspense } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  cardFadeBackground,
  type CollectibleCardData,
} from "@/components/collectible-card";
import {
  HomeActions,
  HomeActionsFallback,
} from "@/components/home/home-actions";
import {
  AudioPlayButton,
  NowPlaying,
} from "@/components/home/audio-play-button";
import {
  BrightenWhileListening,
  FloatWhileListening,
  HideWhileListening,
  ListeningBackdrop,
  ListeningProvider,
  RevealWhileListening,
  type Track,
} from "@/components/home/listening";
import { TiltArtwork } from "@/components/home/tilt-artwork";
import { TodayCard } from "@/components/home/today-card";
import { afterSignInPath, getAccount, safeNextPath } from "@/lib/auth/account";

const SAMPLE_CARD: CollectibleCardData = {
  songTitle: "Ethereal Levitation",
  artistName: "The Petrichor Studio",
  lyricsExcerpt:
    "No gravity, no sense of time,\nJust your soul drifting into mine.",
  message: "For the first warm morning after all that rain.",
  senderName: "Petrichor Team",
  moment: "Reverie",
  // The card's green (its text is set to white on the page, with `inkColor`).
  cardColor: "#a3b18a",
};

/** The home page's songs, in order; previous/next move through them. Add more here. */
const TRACKS: Track[] = [
  {
    src: "/audio/ethereal-levitation.m4a",
    title: SAMPLE_CARD.songTitle,
    artist: SAMPLE_CARD.artistName,
  },
];

// The hero is laid out in a 1000 × 1350 frame (units scale with its width). A white card with
// a soft green glow sits at x 160–840, y 248–1154 (3:4), its lower half washed green, and the
// card's text sits on it.
const VIEW = { left: 0, top: 0, width: 1000, height: 1350 };
const CARD = { left: 160, top: 248, width: 680, height: 906, bottom: 1154 };
const CARD_GREEN = "#a3b18a";
/** Where the card's green glow fades out below it. */
const GLOW_BOTTOM = 1250;
// public/reverie.png (1024 × 1536) is the figure as a cut-out (solid body, transparent sky).
// Scaled 1.0023 units per pixel, with her torso's centre line (x 538 px in the image) on the
// card's centre (x 500) and her fingertips just below the card's top edge (y ≈ 305): her arms
// reach past the card's sides and her head rises above it.
const REVERIE = {
  left: -39.2,
  top: -80,
  width: 1026.4,
  height: 1539.5,
  imageWidth: 1024,
  imageHeight: 1536,
};
/**
 * On the card, the figure fades out from her waist (y 560) to y 700, where the green lower
 * half turns solid, so her legs are hidden; while the song plays the fade slides away and
 * she appears whole. As percentages of the image's height.
 */
const FIGURE_FADE = {
  from: ((560 - REVERIE.top) / REVERIE.height) * 100,
  to: ((700 - REVERIE.top) / REVERIE.height) * 100,
};
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const cardBox = {
  left: pct(CARD.left - VIEW.left, VIEW.width),
  top: pct(CARD.top - VIEW.top, VIEW.height),
  width: pct(CARD.width, VIEW.width),
  height: pct(CARD.height, VIEW.height),
};
/** The card's corner radius: 18 of the card's 390 design units, in frame widths (cqw). */
const CARD_RADIUS = `${((18 / 390) * CARD.width) / 10}cqw`;

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <ListeningProvider tracks={TRACKS}>
      <ListeningBackdrop />
      <NowPlaying />
      {/* Centered on the screen: the card and its two buttons, as a group. */}
      <div className="flex flex-1 flex-col items-center justify-center px-4">
        {/* Artwork size: grows with the screen height (leaving room for the header and the
          buttons below), from 300px up to 600px wide. */}
        <div className="@container flex w-full max-w-[clamp(300px,calc((100svh-230px)*0.74),600px)] flex-col items-center">
          <TiltArtwork
            className="relative w-full"
            style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }}
          >
            {/* The card's white base and its soft green glow. */}
            <HideWhileListening className="absolute inset-0">
              <div
                className="absolute bg-white"
                style={{
                  ...cardBox,
                  borderRadius: CARD_RADIUS,
                  boxShadow: `0 3cqw 9cqw -1cqw ${CARD_GREEN}e6, 0 0 5cqw ${CARD_GREEN}73`,
                }}
              />
            </HideWhileListening>
            {/* The figure: on the card, faded out below her waist; while the song plays the
                fade slides away and she rises, pulsing brighter (settling back when it stops). */}
            <FloatWhileListening className="absolute inset-0">
              <BrightenWhileListening className="absolute inset-0">
                <RevealWhileListening className="absolute inset-0">
                  <Image
                    src="/reverie.png"
                    alt=""
                    width={REVERIE.imageWidth}
                    height={REVERIE.imageHeight}
                    priority
                    unoptimized
                    className="absolute h-auto max-w-none"
                    style={{
                      width: pct(REVERIE.width, VIEW.width),
                      left: pct(REVERIE.left - VIEW.left, VIEW.width),
                      top: pct(REVERIE.top - VIEW.top, VIEW.height),
                      maskImage: `linear-gradient(to bottom, #000 calc(${FIGURE_FADE.from}% + var(--reveal)), transparent calc(${FIGURE_FADE.to}% + var(--reveal)))`,
                    }}
                  />
                </RevealWhileListening>
              </BrightenWhileListening>
            </FloatWhileListening>
            {/* The card's lower half, washed green (fading in from white), over her legs. */}
            <HideWhileListening className="absolute inset-0">
              <div
                className="absolute"
                style={{
                  ...cardBox,
                  borderRadius: CARD_RADIUS,
                  // The same fade as any card's photo, so the moment sits inside it just the same.
                  background: cardFadeBackground(CARD_GREEN),
                }}
              />
            </HideWhileListening>
            <div className="absolute" style={cardBox}>
              {/* While the song plays, the title and artist move to the bottom-left corner. */}
              <HideWhileListening>
                <TodayCard
                  card={SAMPLE_CARD}
                  bare
                  className="max-w-none"
                  inkColor="#FFFFFF"
                  titleAccessory={
                    // No ring; 20 card units, just under the title's line height (title size 20).
                    <AudioPlayButton
                      label={SAMPLE_CARD.songTitle}
                      ring={false}
                      size="calc(var(--u) * 20)"
                      iconSize="calc(var(--u) * 20)"
                    />
                  }
                />
              </HideWhileListening>
            </div>
          </TiltArtwork>
          {/* Starts 8px below the glow (the artwork's white margin under it is pulled up). */}
          {/* Fixed to the two buttons' height (44 + 12 + 44px), so the centering counts only
              them: the sign-in form unfolds below without moving the card. */}
          <div
            className="relative flex h-25 w-full flex-col items-center"
            style={{
              marginTop: `calc(-20px - 100cqw * ${(VIEW.top + VIEW.height - GLOW_BOTTOM) / VIEW.width})`,
            }}
          >
            <HideWhileListening className="flex w-full flex-col items-center">
              <Suspense fallback={<HomeActionsFallback />}>
                <Actions searchParams={searchParams} />
              </Suspense>
            </HideWhileListening>
          </div>
        </div>
      </div>
    </ListeningProvider>
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
  const collectionHref = !account
    ? null
    : afterSignInPath(account.profile, "/keepsakes");
  return (
    <HomeActions
      collectionHref={collectionHref}
      next={next}
      startOpen={requested}
    />
  );
}
