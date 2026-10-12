import type { CSSProperties } from "react";
import { cardInk, DEFAULT_CARD_COLOR, EARTH_PHOTO_AREA, hexToRgb } from "@/lib/card-color";
import { cropImageStyle, type PhotoCrop } from "@/lib/photo-crop";
import { cn } from "@/lib/utils";

export type CollectibleCardData = {
  songTitle: string;
  artistName: string;
  photoUrl?: string | null;
  /** Preview only: shows part of an uncropped photo. Saved cards store the already-cropped image. */
  photoCrop?: PhotoCrop | null;
  lyricsExcerpt?: string | null;
  message?: string | null;
  senderName?: string | null;
  location?: string | null;
  cardId?: string | null;
  /** When the card was created; previews pass today's date. */
  createdAt?: Date | string | null;
  /** IANA time zone the date is printed in; defaults to UTC. */
  timeZone?: string | null;
  /** Base color as #rrggbb; defaults to white. Text switches to white on dark colors. */
  cardColor?: string | null;
  /** Fill for the photo area when there's no photo, as #rrggbb; defaults to the earth gradient. */
  photoAreaColor?: string | null;
};

type CollectibleCardProps = {
  card: CollectibleCardData;
  className?: string;
};

// The card is designed on a 390 × 520 canvas. Every measurement is expressed in
// canvas pixels and converted with `u()`, which scales against the card's own
// width via container query units, so the layout stays identical at any size.
const BASE_WIDTH = 390;
const u = (px: number) => `calc(var(--u) * ${px})`;

const PHOTO_HEIGHT = 293;
const SIDE_PADDING = 42;
const WORDMARK_OPACITY = 0.9;

// Long titles step down in size so the layout stays fixed: titles up to 26
// characters take one line and leave the message three; longer titles wrap to
// two smaller lines and the message gets two.
function titleLayout(title: string) {
  if (title.length <= 18) return { fontSize: 31, messageLines: 3 };
  if (title.length <= 26) return { fontSize: 26, messageLines: 3 };
  return { fontSize: 21, messageLines: 2 };
}

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

export function CollectibleCard({ card, className }: CollectibleCardProps) {
  const title = titleLayout(card.songTitle);
  const cardColor = card.cardColor ?? DEFAULT_CARD_COLOR;
  const ink = cardInk(cardColor);

  return (
    <div className={cn("@container relative aspect-3/4 w-full max-w-[390px]", className)}>
      <article
        aria-label={`${card.songTitle} by ${card.artistName}`}
        className="absolute inset-0 overflow-hidden text-(--ink) shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(40,30,20,0.35)] ring-1 ring-black/5"
        style={
          {
            "--u": `calc(100cqw / ${BASE_WIDTH})`,
            "--ink": ink.ink,
            "--ink-soft": ink.soft,
            "--ink-muted": ink.muted,
            "--ink-faint": ink.faint,
            backgroundColor: cardColor,
            borderRadius: u(18),
          } as CSSProperties
        }
      >
        <CardPhoto
          photoUrl={card.photoUrl}
          crop={card.photoCrop}
          emptyFill={card.photoAreaColor ?? EARTH_PHOTO_AREA}
          alt={`Photo for ${card.songTitle}`}
          fadeColor={cardColor}
        />

        {/* Wordmark at the exact center of the card, in the card's own color, so it
            shows only faintly against the photo behind it. Centering:
            - horizontal: the left padding offsets the trailing letter-spacing;
            - vertical: text-box trims the line to the capitals, so the letters
              themselves (not the line box) are centered. */}
        <p
          aria-hidden
          className="font-outfit absolute inset-x-0 top-1/2 -translate-y-1/2 text-center leading-none font-medium"
          style={{
            textBox: "trim-both cap alphabetic",
            color: cardColor,
            opacity: WORDMARK_OPACITY,
            fontSize: u(8.5),
            letterSpacing: "0.42em",
            paddingLeft: "0.42em",
          }}
        >
          PETRICHOR
        </p>

        {card.location && (
          <p
            className="font-outfit absolute truncate text-right"
            style={{ top: u(291), right: u(SIDE_PADDING), maxWidth: u(160), fontSize: u(8) }}
          >
            {card.location}
          </p>
        )}

        <div
          className="absolute flex flex-col"
          style={{ top: u(304), left: u(SIDE_PADDING), right: u(SIDE_PADDING), bottom: u(28) }}
        >
          {/* Safety net: if text still overflows (e.g. very wide glyphs), the message gives way first. */}
          <div className="flex min-h-0 shrink flex-col">
            {card.message && (
              <p
                className={cn(
                  "font-hand min-h-0 overflow-hidden font-light whitespace-pre-line",
                  title.messageLines === 3 ? "line-clamp-3" : "line-clamp-2",
                )}
                style={{ fontSize: u(15), lineHeight: 1.36 }}
              >
                {card.message}
              </p>
            )}
            {card.senderName && (
              <p
                className="font-garamond shrink-0 truncate text-right italic"
                style={{ fontSize: u(18), lineHeight: 1.2, marginTop: u(8) }}
              >
                {card.senderName}
              </p>
            )}
          </div>

          <div className="flex-1" style={{ minHeight: u(8) }} />

          <div className="shrink-0">
            <h2
              className="line-clamp-2 font-serif"
              style={{ fontSize: u(title.fontSize), lineHeight: 1.06, letterSpacing: "-0.01em" }}
            >
              {card.songTitle}
            </h2>
            <p className="font-outfit line-clamp-1 text-(--ink-muted)" style={{ fontSize: u(11.5), marginTop: u(5) }}>
              {card.artistName}
            </p>
            <div className="flex items-end justify-between" style={{ gap: u(16), marginTop: u(6) }}>
              <p
                className="font-garamond line-clamp-2 min-w-0 flex-1 whitespace-pre-line text-(--ink-soft) italic"
                style={{ fontSize: u(12.5), lineHeight: 1.25 }}
              >
                {card.lyricsExcerpt}
              </p>
              <div className="font-outfit shrink-0 text-right" style={{ fontSize: u(8) }}>
                <p className="font-medium">1 of 1</p>
                {card.createdAt && <p style={{ marginTop: u(5) }}>{formatCardDate(card.createdAt, card.timeZone)}</p>}
              </div>
            </div>
          </div>
        </div>

        <p
          className="font-outfit absolute inset-x-0 text-center text-(--ink-faint)"
          style={{ bottom: u(10), fontSize: u(7.5), letterSpacing: "0.04em" }}
        >
          {card.cardId ?? "P-··························"}
        </p>
      </article>
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
};

function CardPhoto({ photoUrl, crop, emptyFill, alt, fadeColor }: CardPhotoProps) {
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
      {/* Fade the bottom of the photo into the card's base color. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to bottom, rgba(${rgb}, 0) 66%, rgba(${rgb}, 0.45) 85%, rgba(${rgb}, 0.85) 96%, rgb(${rgb}) 100%)`,
        }}
      />
    </div>
  );
}
