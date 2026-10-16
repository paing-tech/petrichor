import type { CSSProperties, ReactNode } from "react";
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
  /** The occasion, e.g. "Birthday party" or a place; shown top-right under the photo. */
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

type CollectibleCardProps = {
  card: CollectibleCardData;
  className?: string;
  /** Laid over the photo area, e.g. the framing layer while customizing. */
  photoOverlay?: ReactNode;
  /**
   * Text only: no background, photo or shadow, for laying over artwork that already
   * draws the card. `card.cardColor` should still be the artwork's color, to pick the ink.
   */
  bare?: boolean;
};

// The card is designed on a 390 × 520 canvas. Every measurement is expressed in
// canvas pixels and converted with `u()`, which scales against the card's own
// width via container query units, so the layout stays identical at any size.
const BASE_WIDTH = 390;
const u = (px: number) => `calc(var(--u) * ${px})`;

const PHOTO_HEIGHT = 293;
/**
 * The photo's fade into the card color: [position as % of the photo height, card-color opacity].
 * Three stops before it turns solid.
 */
const PHOTO_FADE = [
  [66, 0],
  [85, 0.45],
  [96, 0.85],
  [100, 1],
] as const;
/** The moment is centered on the third fade stop, where the photo is almost solid card color. */
const MOMENT_CENTER = (PHOTO_HEIGHT * PHOTO_FADE[2][0]) / 100;
const SIDE_PADDING = 38;

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
// Vertical metrics (in em) of the card fonts, measured in the browser. They let
// the song block space lines by their visible letters instead of their line boxes.
type FontMetrics = { ascent: number; descent: number; capHeight: number };
const FONT_METRICS = {
  instrumentSerif: { ascent: 0.99, descent: 0.31, capHeight: 0.72 },
  outfit: { ascent: 1, descent: 0.26, capHeight: 0.694 },
  cormorantItalic: { ascent: 0.92, descent: 0.29, capHeight: 0.625 },
} satisfies Record<string, FontMetrics>;

/** Half-leading: the space a line box adds above and below the font's own ascent and descent. */
const halfLeading = (m: FontMetrics, size: number, lineHeight: number) =>
  (lineHeight - (m.ascent + m.descent) * size) / 2;
/** From the top of a line box down to the top of its capitals. */
const capTopOffset = (m: FontMetrics, size: number, lineHeight: number) =>
  halfLeading(m, size, lineHeight) + (m.ascent - m.capHeight) * size;
/** From the top of a line box down to its baseline. */
const baselineOffset = (m: FontMetrics, size: number, lineHeight: number) =>
  halfLeading(m, size, lineHeight) + m.ascent * size;
/** From a baseline down to the bottom of its line box. */
const belowBaseline = (m: FontMetrics, size: number, lineHeight: number) =>
  halfLeading(m, size, lineHeight) + m.descent * size;

/**
 * The song block uses one visible gap (baseline of one line to the capitals of
 * the next) between title and artist, artist and the lyrics row, and the two
 * lyrics lines. "1 of 1" and the date share the lyrics' line spacing, so each
 * sits on the same baseline as a lyrics line.
 */
const SONG_GAP = 10;
const TITLE_LINE_HEIGHT = 1.06;
const ARTIST_SIZE = 12;
const ARTIST_LINE = ARTIST_SIZE * 1.2;
const LYRICS_SIZE = 12;
const EDITION_SIZE = 12;
/** Line pitch shared by the lyrics and the edition ("1 of 1") / date column. */
const ROW_LINE = SONG_GAP + FONT_METRICS.cormorantItalic.capHeight * LYRICS_SIZE;

function songLayout(titleSize: number) {
  const { instrumentSerif: serif, outfit, cormorantItalic: garamond } = FONT_METRICS;
  const titleLine = titleSize * TITLE_LINE_HEIGHT;
  // The row aligns its two columns on their first baselines (flex items-baseline),
  // so its top is set by whichever column's baseline sits lower in its line box.
  const lyricsBaseline = baselineOffset(garamond, LYRICS_SIZE, ROW_LINE);
  const editionBaseline = baselineOffset(outfit, EDITION_SIZE, ROW_LINE);
  const rowBaseline = Math.max(lyricsBaseline, editionBaseline);
  // The row's visible top is its tallest capital.
  const rowCapTop = rowBaseline - Math.max(garamond.capHeight * LYRICS_SIZE, outfit.capHeight * EDITION_SIZE);
  return {
    titleLine,
    artistMargin: SONG_GAP - belowBaseline(serif, titleSize, titleLine) - capTopOffset(outfit, ARTIST_SIZE, ARTIST_LINE),
    rowMargin: SONG_GAP - belowBaseline(outfit, ARTIST_SIZE, ARTIST_LINE) - rowCapTop,
  };
}

export function formatCardDate(date: Date | string, timeZone?: string | null) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: timeZone ?? "UTC",
  });
}

export function CollectibleCard({ card, className, photoOverlay, bare = false }: CollectibleCardProps) {
  const title = titleLayout(card.songTitle);
  const song = songLayout(title.fontSize);
  const cardColor = card.cardColor ?? DEFAULT_CARD_COLOR;
  const ink = cardInk(cardColor);

  return (
    <div className={cn("@container relative aspect-3/4 w-full max-w-[390px]", className)}>
      <article
        aria-label={`${card.songTitle} by ${card.artistName}`}
        className={cn(
          "absolute inset-0 overflow-hidden text-(--ink)",
          !bare && "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(40,30,20,0.35)] ring-1 ring-black/5",
        )}
        style={
          {
            "--u": `calc(100cqw / ${BASE_WIDTH})`,
            "--ink": ink.ink,
            "--ink-soft": ink.soft,
            "--ink-muted": ink.muted,
            "--ink-faint": ink.faint,
            backgroundColor: bare ? undefined : cardColor,
            borderRadius: u(18),
          } as CSSProperties
        }
      >
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

        {/* Moment's capitals are centered on the third fade stop (text-box trims the
            line to the capitals, and the translate centers them on `top`). Long text
            is clipped only horizontally, so descenders below the trimmed box still show. */}
        {card.moment && (
          <p
            className="font-outfit absolute -translate-y-1/2 overflow-x-clip text-right leading-none text-ellipsis whitespace-nowrap"
            style={{
              textBox: "trim-both cap alphabetic",
              top: u(MOMENT_CENTER),
              right: u(SIDE_PADDING),
              maxWidth: u(160),
              fontSize: u(8),
            }}
          >
            {card.moment}
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
              style={{ fontSize: u(title.fontSize), lineHeight: u(song.titleLine), letterSpacing: "-0.01em" }}
            >
              {card.songTitle}
            </h2>
            <p
              className="font-outfit line-clamp-1 text-(--ink-muted)"
              style={{ fontSize: u(ARTIST_SIZE), lineHeight: u(ARTIST_LINE), marginTop: u(song.artistMargin) }}
            >
              {card.artistName}
            </p>
            <div className="flex items-baseline justify-between" style={{ gap: u(16), marginTop: u(song.rowMargin) }}>
              <p
                className="font-garamond line-clamp-2 min-w-0 flex-1 whitespace-pre-line text-(--ink-soft) italic"
                style={{ fontSize: u(LYRICS_SIZE), lineHeight: u(ROW_LINE) }}
              >
                {card.lyricsExcerpt}
              </p>
              <p
                className="font-outfit shrink-0 text-right font-normal"
                style={{ fontSize: u(EDITION_SIZE), lineHeight: u(ROW_LINE) }}
              >
                {card.editionNumber ?? 1} of {card.editionSize ?? 1}
                {card.createdAt && (
                  <>
                    <br />
                    {formatCardDate(card.createdAt, card.timeZone)}
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Shown only once the card exists; no placeholder while creating. */}
        {card.cardId && (
          <p
            className="font-outfit absolute inset-x-0 text-center text-(--ink-faint)"
            style={{ bottom: u(10), fontSize: u(7.5), letterSpacing: "0.04em" }}
          >
            {card.cardId}
          </p>
        )}
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
      {/* Fade the bottom of the photo into the card's base color. */}
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
