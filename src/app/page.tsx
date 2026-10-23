import { Suspense, type CSSProperties } from "react";
import Image from "next/image";
import { redirect } from "next/navigation";
import {
  CARD_RATIO,
  cardFadeBackground,
  type CollectibleCardData,
} from "@/components/collectible-card";
import {
  HomeActions,
  HomeActionsFallback,
} from "@/components/home/home-actions";
import { NowPlaying } from "@/components/home/audio-play-button";
import {
  BrightenWhileListening,
  FloatWhileListening,
  HideWhileListening,
  ListeningBackdrop,
  ListeningProvider,
  RevealWhileListening,
  type Track,
} from "@/components/home/listening";
import { HomePlayPill } from "@/components/home/play-pill";
import { TiltArtwork, TiltLayer } from "@/components/home/tilt-artwork";
import { TodayCard } from "@/components/home/today-card";
import { afterSignInPath, getAccount, safeNextPath } from "@/lib/auth/account";
import { signInPath } from "@/lib/auth/sign-in-path";

const SAMPLE_CARD: CollectibleCardData = {
  songTitle: "Ethereal Levitation",
  artistName: "The Petrichor Studio",
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
// a soft green glow, shaped like every Petrichor card (a trading card, 63 × 88), sits at
// x 200–800, y 248–1086; the figure is its 4:5 "photo", washed green below it, and the card's
// text sits on the green.
const VIEW = { left: 0, top: 0, width: 1000, height: 1350 };
/**
 * This card is 5:4, a little shorter than every other card (63:88). The difference is cut from
 * its photo, so the green and the text keep their size and come sooner.
 */
const HOME_CARD_RATIO = 5 / 4;
/** An ordinary card's height at this width, and how much shorter this one is. */
const FULL_HEIGHT = 600 * CARD_RATIO;
const TRIM = FULL_HEIGHT - 600 * HOME_CARD_RATIO;
const CARD = { left: 200, top: 248, width: 600, height: 600 * HOME_CARD_RATIO, bottom: 248 + 600 * HOME_CARD_RATIO };
/**
 * How much higher than on other cards the green begins, in card units (390 across): more green
 * below her (the text stays at the card's foot).
 */
const GREEN_LIFT = 120;
const LIFT = GREEN_LIFT * (CARD.width / 390);
/** Where the green turns solid: the photo's foot (4:5), less the trim and the lift. */
const PHOTO_BOTTOM = CARD.top + (CARD.width * 5) / 4 - TRIM - LIFT;
const CARD_GREEN = "#a3b18a";
/**
 * Moves the frame so the card itself sits at the screen's centre (not the whole frame, with her
 * head and the stars above it and the glow below): as a share of the frame's height.
 */
const CARD_CENTERING = ((VIEW.height / 2 - (CARD.top + CARD.height / 2)) / VIEW.height) * 100;
/**
 * Raises the card above the exact centre, in px: the eye reads the true centre as low (more so
 * with the buttons hanging below), so it sits at the "optical" centre instead.
 */
const OPTICAL_LIFT = 60;
/** Space between the card's bottom edge and the play pill, in px (the same on every screen). */
const CARD_GAP = 16;
/**
 * The height of everything under the card, in px: CARD_GAP, the 48px play pill, and the two
 * 56px buttons, 12px apart. Keep it in step with those, so the layout can make room for them.
 */
const BUTTONS_BLOCK = CARD_GAP + 48 + 12 + 56 + 12 + 56;
// public/reverie.png (1024 × 1536) is the figure as a cut-out (solid body, transparent sky).
// Scaled 0.8843 units per pixel (in proportion to the card), with her torso's centre line
// (x 538 px in the image) on the card's centre (x 500) and her fingertips just below the
// card's top edge: her arms reach past the card's sides and her head rises above it.
const REVERIE = {
  left: 24.2,
  top: -41.4,
  width: 905.6,
  height: 1358.4,
  imageWidth: 1024,
  imageHeight: 1536,
};
/**
 * On the card, the figure fades out with the photo's own fade (its last fifth, down to the
 * photo's foot), so her lower legs are hidden by the green; while the song plays the fade
 * slides away and she appears whole. As percentages of the image's height.
 */
const FIGURE_FADE_START = CARD.top + 0.8 * ((CARD.width * 5) / 4) - TRIM - LIFT;
const FIGURE_FADE = {
  from: ((FIGURE_FADE_START - REVERIE.top) / REVERIE.height) * 100,
  to: ((PHOTO_BOTTOM - REVERIE.top) / REVERIE.height) * 100,
};
const pct = (value: number, of: number) => `${(value / of) * 100}%`;
const cardBox = {
  left: pct(CARD.left - VIEW.left, VIEW.width),
  top: pct(CARD.top - VIEW.top, VIEW.height),
  width: pct(CARD.width, VIEW.width),
  height: pct(CARD.height, VIEW.height),
};
const textBox = {
  ...cardBox,
  top: pct(CARD.top - TRIM - VIEW.top, VIEW.height),
  height: pct(FULL_HEIGHT, VIEW.height),
};
/** The point the card tilts around: its centre, within the frame. */
const CARD_CENTER = `${pct(CARD.left + CARD.width / 2 - VIEW.left, VIEW.width)} ${pct(CARD.top + CARD.height / 2 - VIEW.top, VIEW.height)}`;
/** The card's corner radius: 23 of the card's 390 design units, in frame widths (cqw). */
const CARD_RADIUS = `${((23 / 390) * CARD.width) / 10}cqw`;

/**
 * The measurements the hero's sizing and placement need (see .home-hero in globals.css), as
 * CSS custom properties. Heights are shares of the frame's height (for translate and top),
 * spans are multiples of its width.
 */
const CARD_CENTER_Y = CARD.top + CARD.height / 2;
const heroVars = {
  // From the frame's centre down to the card's.
  "--home-center": `${CARD_CENTERING}%`,
  // From the card's centre up to the top of the figure, and down to the card's bottom edge.
  "--home-above": `${((CARD_CENTER_Y - Math.min(REVERIE.top, VIEW.top)) / VIEW.height) * 100}%`,
  "--home-card-below": `${(CARD.height / 2 / VIEW.height) * 100}%`,
  // The figure's top to the card's bottom, in frame widths.
  "--home-span": (CARD_CENTER_Y - Math.min(REVERIE.top, VIEW.top) + CARD.height / 2) / VIEW.width,
  "--home-lift": `${OPTICAL_LIFT}px`,
  "--home-buttons": `${BUTTONS_BLOCK}px`,
  // Where the buttons start: CARD_GAP below the card (pulling up past the frame below it).
  "--home-buttons-top": `calc(${CARD_GAP}px - 100cqw * ${(VIEW.top + VIEW.height - CARD.bottom) / VIEW.width})`,
} as CSSProperties;

export default function Home({ searchParams }: PageProps<"/">) {
  return (
    <ListeningProvider tracks={TRACKS}>
      <ListeningBackdrop />
      <NowPlaying />
      {/* The card a little above the screen's centre, its buttons hanging below it (beside it
          on a phone held sideways), all sized to fit without scrolling: see .home-hero in
          globals.css. */}
      <div className="home-hero flex flex-1 flex-col items-center justify-center px-4" style={heroVars}>
        <div className="home-artwork @container relative flex flex-col items-center">
          <TiltArtwork
            className="relative w-full"
            style={{ aspectRatio: `${VIEW.width} / ${VIEW.height}` }}
          >
            {/* The card's white base and its soft green glow. The card's three layers (this,
                the green half and the text) tilt together; the figure between them stays still. */}
            <TiltLayer className="absolute inset-0" origin={CARD_CENTER}>
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
            </TiltLayer>
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
            <TiltLayer className="absolute inset-0" origin={CARD_CENTER}>
              <HideWhileListening className="absolute inset-0">
                <div
                  className="absolute"
                  style={{
                    ...cardBox,
                    borderRadius: CARD_RADIUS,
                    // The same fade as any card's photo, so the moment sits inside it just the same.
                    background: cardFadeBackground(CARD_GREEN, TRIM * (390 / CARD.width), GREEN_LIFT),
                  }}
                />
              </HideWhileListening>
            </TiltLayer>
            <TiltLayer className="absolute inset-0" origin={CARD_CENTER}>
              {/* A full-height card's text, raised by the trim so it sits on this card's foot. */}
              <div className="absolute" style={textBox}>
                {/* While the song plays, the title and artist move to the bottom-left corner. */}
                <HideWhileListening>
                  <TodayCard
                    card={SAMPLE_CARD}
                    bare
                    className="max-w-none"
                    inkColor="#FFFFFF"
                    // The green begins GREEN_LIFT higher than a photo's fade: the moment follows it.
                    momentLift={GREEN_LIFT}
                  />
                </HideWhileListening>
              </div>
            </TiltLayer>
          </TiltArtwork>
          {/* Exactly as wide as the card, and out of the flow, so only the card is placed: the pill
              and buttons never move it. */}
          <div
            className="home-buttons flex flex-col items-center"
            style={{ width: `${(CARD.width / VIEW.width) * 100}cqw` }}
          >
            <HideWhileListening className="flex w-full flex-col items-center gap-3">
              <div className="w-full">
                <HomePlayPill title={SAMPLE_CARD.songTitle} artist={SAMPLE_CARD.artistName} />
              </div>
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
 * Reads the session and the URL, so it renders per request inside <Suspense>. Old links to
 * `/?next=…` (from before the sign-in page) are passed on to it, or straight to `next` for
 * anyone already signed in.
 */
async function Actions({ searchParams }: Pick<PageProps<"/">, "searchParams">) {
  const [account, params] = await Promise.all([getAccount(), searchParams]);
  if (params.next !== undefined) {
    const next = safeNextPath(params.next);
    redirect(account ? afterSignInPath(account.profile, next) : signInPath(next));
  }
  const collectionHref = !account
    ? null
    : afterSignInPath(account.profile, "/keepsakes");
  return <HomeActions collectionHref={collectionHref} />;
}
