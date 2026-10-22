import type { CSSProperties, ReactNode } from "react";
import { CardQr, qrQuietShare } from "@/components/card-qr";
import { cardInk, DEFAULT_CARD_COLOR, EARTH_PHOTO_AREA, hexToRgb } from "@/lib/card-color";
import { cropImageStyle, type PhotoCrop } from "@/lib/photo-crop";
import { cardUrl } from "@/lib/site-url";
import { cn } from "@/lib/utils";

export type CollectibleCardData = {
  songTitle: string;
  artistName: string;
  photoUrl?: string | null;
  /** Preview only: shows part of an uncropped photo. Saved cards store the already-cropped image. */
  photoCrop?: PhotoCrop | null;
  message?: string | null;
  senderName?: string | null;
  /** The occasion, e.g. "Birthday party" or a place; shown at the foot of the photo. */
  moment?: string | null;
  cardId?: string | null;
  /** This copy's number and the edition's size, printed as "2 of 3"; defaults to 1 of 1. */
  editionNumber?: number | null;
  editionSize?: number | null;
  /** When the card was created; previews pass today's date. */
  createdAt?: Date | string | null;
  /** IANA time zone the date is printed in; defaults to UTC. */
  timeZone?: string | null;
  /** Base color as #rrggbb; defaults to white. Text switches to white on dark colors. */
  cardColor?: string | null;
  /** Fill for the photo area when there's no photo, as #rrggbb; defaults to the earth gradient. */
  photoAreaColor?: string | null;
};

export type CardFace = "front" | "back";

type CollectibleCardProps = {
  card: CollectibleCardData;
  className?: string;
  /**
   * Which side to draw. The front: the photo, the moment, the song and the edition. The back:
   * the handwritten message and signature, the date and the card ID. (FlipCard shows both.)
   */
  face?: CardFace;
  /** Laid over the photo area, e.g. the framing layer while customizing. */
  photoOverlay?: ReactNode;
  /**
   * Sits right after the song title, e.g. a play button. Size it in card units
   * (`calc(var(--u) * N)`) and keep it no taller than the title's line so the layout holds.
   */
  titleAccessory?: ReactNode;
  /**
   * One color for all of the card's text (title, artist, message, card ID…) instead of the ink
   * picked from `card.cardColor` with its softer shades. The title accessory follows it.
   */
  inkColor?: string;
  /**
   * Text only: no background, photo or shadow, for laying over artwork that already
   * draws the card. `card.cardColor` should still be the artwork's color, to pick the ink.
   */
  bare?: boolean;
};

// The card is a trading card (63 × 88 mm, like Pokémon cards), designed on a canvas 390 units
// wide.
// Every measurement is expressed in canvas units and converted with `u()`, which scales
// against the card's own width via container query units, so the layout stays identical at
// any size.
const BASE_WIDTH = 390;
/** Height ÷ width: a trading card's 88 ÷ 63. */
export const CARD_RATIO = 88 / 63;
const CARD_HEIGHT = BASE_WIDTH * CARD_RATIO;
const u = (px: number) => `calc(var(--u) * ${px})`;

/** The photo fills the top of the front at 4:5. */
const PHOTO_HEIGHT = (BASE_WIDTH * 5) / 4;
/** The photo fades into the card color between these points (% of the photo's height). */
const FADE_START = 80;
const FADE_END = 95;
const FADE_STEPS = 12;
/** Smoothstep: starts and ends gently, so the fade has no visible edge (an "easing gradient"). */
const ease = (t: number) => t * t * (3 - 2 * t);
/**
 * The photo's fade into the card color: [position as % of the photo height, card-color opacity],
 * stops along an eased curve from clear at FADE_START to solid at FADE_END.
 */
const PHOTO_FADE = Array.from({ length: FADE_STEPS + 1 }, (_, i) => {
  const t = i / FADE_STEPS;
  return [FADE_START + t * (FADE_END - FADE_START), ease(t)] as const;
});
/** The moment sits inside the fade, near the photo's foot, on the right, clear of the title. */
const MOMENT_CENTER = PHOTO_HEIGHT * 0.92;
/** Corner radius, in proportion to a trading card's (about 3 mm on 63 mm). */
const CORNER_RADIUS = 19;
const SIDE_PADDING = 28;
/**
 * The song block (title, then artist and edition) is centred between the line where the photo's
 * fade turns nearly solid (its 90% stop) and the card's bottom edge, measured from the title's
 * capitals and the artist's baseline, so the space above the title equals the space below the
 * artist.
 */
const SONG_AREA_TOP = PHOTO_HEIGHT * 0.9;

/**
 * The card's fade into `color` as a background for the whole card (not just the photo area):
 * transparent at the top, the same stops as the photo's fade, then solid below it. For laying
 * over artwork that should blend into the card exactly as a photo would.
 */
export function cardFadeBackground(color: string) {
  const rgb = hexToRgb(color).join(", ");
  const card = (at: number) => ((PHOTO_HEIGHT * at) / 100 / CARD_HEIGHT) * 100;
  return `linear-gradient(to bottom, ${PHOTO_FADE.map(([at, alpha]) => `rgba(${rgb}, ${alpha}) ${card(at)}%`).join(", ")})`;
}

/** The song title, on one line (long ones end with "…"). */
const TITLE_SIZE = 28;
const TITLE_LINE_HEIGHT = 1.1;
/** Every Outfit line on the card (moment, artist, edition, date) shares this size. */
const OUTFIT_SIZE = 14;
const OUTFIT_LINE_HEIGHT = 1.3;

/**
 * Vertical metrics (in em) of the card fonts, measured in the browser. With them a line can be
 * trimmed to its letters (from the top of its capitals to its baseline), so spacing is measured
 * between visible letters rather than line boxes, in every browser.
 */
type FontMetrics = { ascent: number; descent: number; capHeight: number };
const INSTRUMENT_SERIF: FontMetrics = { ascent: 0.99, descent: 0.31, capHeight: 0.72 };
const OUTFIT: FontMetrics = { ascent: 1, descent: 0.26, capHeight: 0.694 };

/** Negative margins that trim a line box (at `size` units and a unitless `lineHeight`) to its capitals and baseline. */
function trimToLetters(font: FontMetrics, size: number, lineHeight: number): CSSProperties {
  const halfLeading = (lineHeight * size - (font.ascent + font.descent) * size) / 2;
  return {
    marginTop: u(-(halfLeading + (font.ascent - font.capHeight) * size)),
    marginBottom: u(-(halfLeading + font.descent * size)),
  };
}
/** Space between the title's baseline and the capitals of the artist / edition row. */
const TITLE_GAP = 12;

/** The back: the handwritten message and signature, with room for a longer note. */
const BACK_PADDING = 28;
const MESSAGE_SIZE = 19;
const MESSAGE_LINE_HEIGHT = 1.45;
/** Matches MESSAGE_MAX_LINES in src/lib/validation.ts. */
const MESSAGE_LINES = 10;
const CARD_ID_SIZE = 8;
/**
 * The QR code in the back's bottom-right corner (with its white margin). Much over 120 and the
 * card ID beside it no longer fits; much under 100 and another phone can't scan it off a screen.
 */
const QR_SIZE = 80;

/**
 * Prints the date in the sender's time zone, so a card made on the morning of
 * Oct 12 in Singapore says Oct 12 for every viewer, wherever they are.
 */
export function formatCardDate(date: Date | string, timeZone?: string | null) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? "UTC",
  });
}

export function CollectibleCard({
  card,
  className,
  face = "front",
  photoOverlay,
  titleAccessory,
  inkColor,
  bare = false,
}: CollectibleCardProps) {
  const cardColor = card.cardColor ?? DEFAULT_CARD_COLOR;
  const ink = cardInk(cardColor);

  return (
    <div className={cn("@container relative aspect-[63/88] w-full max-w-[390px]", className)}>
      <article
        aria-label={
          face === "front"
            ? `${card.songTitle} by ${card.artistName}`
            : `Message on the back of ${card.songTitle}`
        }
        className={cn(
          "absolute inset-0 overflow-hidden text-(--ink)",
          !bare && "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(40,30,20,0.35)] ring-1 ring-black/5",
        )}
        style={
          {
            "--u": `calc(100cqw / ${BASE_WIDTH})`,
            "--ink": inkColor ?? ink.ink,
            "--ink-soft": inkColor ?? ink.soft,
            "--ink-muted": inkColor ?? ink.muted,
            "--ink-faint": inkColor ?? ink.faint,
            backgroundColor: bare ? undefined : cardColor,
            borderRadius: u(CORNER_RADIUS),
          } as CSSProperties
        }
      >
        {face === "front" ? (
          <CardFront card={card} bare={bare} cardColor={cardColor} photoOverlay={photoOverlay} titleAccessory={titleAccessory} />
        ) : (
          <CardBack card={card} />
        )}
      </article>
    </div>
  );
}

function CardFront({
  card,
  bare,
  cardColor,
  photoOverlay,
  titleAccessory,
}: {
  card: CollectibleCardData;
  bare: boolean;
  cardColor: string;
  photoOverlay?: ReactNode;
  titleAccessory?: ReactNode;
}) {
  return (
    <>
      {!bare && (
        <CardPhoto
          photoUrl={card.photoUrl}
          crop={card.photoCrop}
          emptyFill={card.photoAreaColor ?? EARTH_PHOTO_AREA}
          alt={`Photo for ${card.songTitle}`}
          fadeColor={cardColor}
          overlay={photoOverlay}
        />
      )}

      {/* The moment's capitals are centered on MOMENT_CENTER (text-box trims the line to the
          capitals, and the translate centers them on `top`). Long text is clipped only
          horizontally, so descenders below the trimmed box still show. */}
      {card.moment && (
        <p
          className="font-outfit absolute -translate-y-1/2 overflow-x-clip text-right leading-none text-ellipsis whitespace-nowrap"
          style={{
            ...trimToLetters(OUTFIT, OUTFIT_SIZE, 1),
            top: u(MOMENT_CENTER),
            right: u(SIDE_PADDING),
            maxWidth: u(200),
            fontSize: u(OUTFIT_SIZE),
          }}
        >
          {card.moment}
        </p>
      )}

      {/* At the foot of the card: the song, and the artist with the edition beside it. */}
      <div
        className="absolute flex flex-col justify-center"
        style={{ top: u(SONG_AREA_TOP), bottom: 0, left: u(SIDE_PADDING), right: u(SIDE_PADDING) }}
      >
        <div className="flex items-center" style={{ gap: u(6) }}>
          <h2
            className="min-w-0 overflow-x-clip font-serif text-ellipsis whitespace-nowrap"
            style={{
              fontSize: u(TITLE_SIZE),
              lineHeight: TITLE_LINE_HEIGHT,
              letterSpacing: "-0.01em",
              ...trimToLetters(INSTRUMENT_SERIF, TITLE_SIZE, TITLE_LINE_HEIGHT),
            }}
          >
            {card.songTitle}
          </h2>
          {/* Centred on the title's letters without taking up height, so a taller accessory
              (e.g. the home page's play button) doesn't push the artist line down. */}
          {titleAccessory && <span className="flex h-0 items-center">{titleAccessory}</span>}
        </div>
        <div
          className="font-outfit flex items-baseline justify-between"
          style={{
            gap: u(16),
            fontSize: u(OUTFIT_SIZE),
            lineHeight: OUTFIT_LINE_HEIGHT,
            ...trimToLetters(OUTFIT, OUTFIT_SIZE, OUTFIT_LINE_HEIGHT),
            marginTop: `calc(${u(TITLE_GAP)} + ${trimToLetters(OUTFIT, OUTFIT_SIZE, OUTFIT_LINE_HEIGHT).marginTop})`,
          }}
        >
          <p className="min-w-0 overflow-x-clip text-ellipsis whitespace-nowrap text-(--ink-muted)">
            {card.artistName}
          </p>
          <p className="shrink-0">
            {card.editionNumber ?? 1} of {card.editionSize ?? 1}
          </p>
        </div>
      </div>
    </>
  );
}

function CardBack({ card }: { card: CollectibleCardData }) {
  return (
    <div className="absolute flex flex-col" style={{ inset: u(BACK_PADDING) }}>
      <div className="flex min-h-0 flex-1 flex-col">
        {card.message && (
          <p
            className="font-hand min-h-0 overflow-hidden whitespace-pre-line"
            style={{
              fontSize: u(MESSAGE_SIZE),
              lineHeight: MESSAGE_LINE_HEIGHT,
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: MESSAGE_LINES,
            }}
          >
            {card.message}
          </p>
        )}
        {card.senderName && (
          <p
            // Handwritten, like the message above it.
            className="font-hand shrink-0 truncate text-right"
            style={{ fontSize: u(MESSAGE_SIZE), lineHeight: MESSAGE_LINE_HEIGHT, marginTop: u(14) }}
          >
            {card.senderName}
          </p>
        )}
      </div>

      {/* The foot, bottom right: the date it was made and its ID, right-aligned beside a QR code to
          the card's page (once the card exists), the ID's baseline level with the code's last row. */}
      <div className="flex shrink-0 items-end justify-end" style={{ gap: u(8), paddingTop: u(16) }}>
        <div
          className="font-outfit min-w-0 text-right"
          style={{
            fontSize: u(OUTFIT_SIZE),
            lineHeight: OUTFIT_LINE_HEIGHT,
            // Up past the code's white margin, which is invisible on a white card.
            marginBottom: card.cardId ? u(QR_SIZE * qrQuietShare(cardUrl(card.cardId))) : undefined,
          }}
        >
          {card.createdAt && <p>{formatCardDate(card.createdAt, card.timeZone)}</p>}
          {card.cardId && (
            <p
              className="truncate text-(--ink-faint)"
              style={{
                fontSize: u(CARD_ID_SIZE),
                letterSpacing: "0.04em",
                marginTop: u(4),
                marginBottom: trimToLetters(OUTFIT, CARD_ID_SIZE, OUTFIT_LINE_HEIGHT).marginBottom,
              }}
            >
              {card.cardId}
            </p>
          )}
        </div>
        {card.cardId && (
          <div className="shrink-0" style={{ width: u(QR_SIZE) }}>
            <CardQr value={cardUrl(card.cardId)} className="block w-full" />
          </div>
        )}
      </div>
    </div>
  );
}

type CardPhotoProps = {
  photoUrl?: string | null;
  crop?: PhotoCrop | null;
  /** CSS background shown when there's no photo. */
  emptyFill: string;
  alt: string;
  fadeColor: string;
  overlay?: ReactNode;
};

function CardPhoto({ photoUrl, crop, emptyFill, alt, fadeColor, overlay }: CardPhotoProps) {
  const rgb = hexToRgb(fadeColor).join(", ");
  return (
    <div className="absolute inset-x-0 top-0 overflow-hidden" style={{ height: u(PHOTO_HEIGHT) }}>
      {photoUrl ? (
        // A plain <img> handles both remote R2 URLs and local blob: previews.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={alt}
          className={crop ? undefined : "size-full object-cover"}
          style={crop ? cropImageStyle(crop) : undefined}
        />
      ) : (
        <div aria-hidden className="size-full" style={{ background: emptyFill }} />
      )}
      {/* Fade the foot of the photo into the card's base color. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, ${PHOTO_FADE.map(([at, alpha]) => `rgba(${rgb}, ${alpha}) ${at}%`).join(", ")})`,
        }}
      />
      {overlay}
    </div>
  );
}
