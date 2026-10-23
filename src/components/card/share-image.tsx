import { CARD_FRONT_LAYOUT as L, CARD_RATIO, type CollectibleCardData } from "@/components/collectible-card";
import { cardInk, DEFAULT_CARD_COLOR, EARTH_PHOTO_AREA, hexToRgb } from "@/lib/card-color";

// The card's share image (see the share-image route): drawn for Satori, which renders a subset
// of CSS (flexbox, absolute positioning) with no stylesheet, so everything is inline styles, and
// any element with more than one child (text pieces count) must be display: flex.

/** The image is story-sized (9:16). */
export const SHARE_IMAGE_SIZE = { width: 1080, height: 1920 };
const CARD_WIDTH = 720;
/** Space between the card and the row under it (the owner and the QR code). */
const ROW_GAP = 56;
/** Big enough to scan off another phone's screen, and after apps shrink the image to half size. */
const QR_SIZE = 240;

type FontMetrics = { ascent: number; descent: number; capHeight: number };

/**
 * One line of text placed by its baseline. Its line box is exactly the font's ascent + descent
 * tall (no leading), so the baseline sits `ascent` below the box's top.
 */
function lineTop(baseline: number, size: number, font: FontMetrics) {
  return baseline - font.ascent * size;
}

/** The card's front, as on the card page, `width` pixels wide. */
function CardFront({ card, width }: { card: CollectibleCardData; width: number }) {
  const s = width / L.width;
  const px = (units: number) => units * s;
  const cardColor = card.cardColor ?? DEFAULT_CARD_COLOR;
  const ink = cardInk(cardColor);
  const rgb = hexToRgb(cardColor).join(", ");

  // The song block (the title's capitals to the artist's baseline) centred below the photo's fade.
  const cardHeight = L.width * CARD_RATIO;
  const blockHeight =
    L.serifMetrics.capHeight * L.titleSize + L.titleGap + L.outfitMetrics.capHeight * L.outfitSize;
  const titleBaseline =
    L.songAreaTop + (cardHeight - L.songAreaTop - blockHeight) / 2 + L.serifMetrics.capHeight * L.titleSize;
  const artistBaseline = titleBaseline + L.titleGap + L.outfitMetrics.capHeight * L.outfitSize;
  const momentBaseline = L.momentCenter + (L.outfitMetrics.capHeight * L.outfitSize) / 2;

  const outfitLine = {
    position: "absolute",
    fontFamily: "Outfit",
    fontSize: px(L.outfitSize),
    lineHeight: L.outfitMetrics.ascent + L.outfitMetrics.descent,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as const;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        width,
        height: width * CARD_RATIO,
        borderRadius: px(L.cornerRadius),
        overflow: "hidden",
        backgroundColor: cardColor,
        color: ink.ink,
        boxShadow: "0 2px 4px rgba(0,0,0,0.06), 0 24px 80px -24px rgba(40,30,20,0.35)",
      }}
    >
      {card.photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img
          src={card.photoUrl}
          width={width}
          height={px(L.photoHeight)}
          style={{ position: "absolute", top: 0, left: 0, objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width,
            height: px(L.photoHeight),
            background: card.photoAreaColor ?? EARTH_PHOTO_AREA,
          }}
        />
      )}
      {/* The photo's eased fade into the card color. */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width,
          height: px(L.photoHeight),
          backgroundImage: `linear-gradient(to bottom, ${L.photoFade.map(([at, alpha]) => `rgba(${rgb}, ${alpha}) ${at}%`).join(", ")})`,
        }}
      />

      {card.moment && (
        <div
          style={{
            ...outfitLine,
            top: px(lineTop(momentBaseline, L.outfitSize, L.outfitMetrics)),
            right: px(L.sidePadding),
            maxWidth: px(200),
          }}
        >
          {card.moment}
        </div>
      )}

      <div
        style={{
          position: "absolute",
          top: px(lineTop(titleBaseline, L.titleSize, L.serifMetrics)),
          left: px(L.sidePadding),
          width: px(L.width - L.sidePadding * 2),
          fontFamily: "Instrument Serif",
          fontSize: px(L.titleSize),
          lineHeight: L.serifMetrics.ascent + L.serifMetrics.descent,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {card.songTitle}
      </div>

      <div
        style={{
          position: "absolute",
          top: px(lineTop(artistBaseline, L.outfitSize, L.outfitMetrics)),
          left: px(L.sidePadding),
          right: px(L.sidePadding),
          display: "flex",
          justifyContent: "space-between",
          gap: px(16),
          fontFamily: "Outfit",
          fontSize: px(L.outfitSize),
          lineHeight: L.outfitMetrics.ascent + L.outfitMetrics.descent,
        }}
      >
        <div style={{ color: ink.muted, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flexShrink: 1 }}>
          {card.artistName}
        </div>
        <div style={{ flexShrink: 0 }}>
          {`${card.editionNumber ?? 1} of ${card.editionSize ?? 1}`}
        </div>
      </div>
    </div>
  );
}

/**
 * The share image: the card's front, smaller, in the middle of a story-sized canvas, with its
 * owner's @username and a QR code to the card's page beneath it, so a posted screenshot leads
 * back to the real card.
 */
export function ShareImage({
  card,
  ownerUsername,
  qrSvg,
}: {
  card: CollectibleCardData;
  ownerUsername: string | null;
  qrSvg: string;
}) {
  // A dark card sits on near-black; every other card on a warm off-white.
  const dark = cardInk(card.cardColor ?? DEFAULT_CARD_COLOR).ink === "#ffffff";
  const text = dark ? "#ffffff" : "#171717";
  const muted = dark ? "rgba(255,255,255,0.55)" : "rgba(23,23,23,0.5)";

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: dark ? "#0e0e0e" : "#f2f1ee",
        fontFamily: "Outfit",
      }}
    >
      <CardFront card={card} width={CARD_WIDTH} />
      <div
        style={{
          width: CARD_WIDTH,
          marginTop: ROW_GAP,
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: 32,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0, paddingBottom: 8 }}>
          {ownerUsername ? (
            <div style={{ fontSize: 38, color: text }}>{`@${ownerUsername}`}</div>
          ) : (
            <div style={{ fontFamily: "Instrument Serif", fontSize: 44, color: text }}>Petrichor</div>
          )}
          <div style={{ fontSize: 24, color: muted }}>Scan to open this card</div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img
          src={`data:image/svg+xml;base64,${Buffer.from(qrSvg).toString("base64")}`}
          width={QR_SIZE}
          height={QR_SIZE}
        />
      </div>
    </div>
  );
}
