// Card base colors. Shared by the client form, the card component and the server.

export const DEFAULT_CARD_COLOR = "#ffffff";

export const PRESET_CARD_COLORS = [
  { name: "White", value: "#ffffff" },
  { name: "Black", value: "#000000" },
] as const;

export const CARD_COLOR_PATTERN = /^#[0-9a-f]{6}$/;

/** The default fill for the photo area when a card has no photo: a soft earth/sage gradient. */
export const EARTH_PHOTO_AREA =
  "radial-gradient(120% 80% at 20% 10%, #e7ece6 0%, transparent 60%), radial-gradient(90% 70% at 85% 30%, #c9d3cc 0%, transparent 65%), linear-gradient(165deg, #dfe4de 0%, #b9c4bb 55%, #a7b2a8 100%)";
/** A representative solid color of the earth gradient, for contrast decisions and the picker's start color. */
export const EARTH_PHOTO_AREA_TONE = "#b9c4bb";

export type Rgb = [number, number, number];

export function hexToRgb(hex: string): Rgb {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return `#${[r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("")}`;
}

/** WCAG relative luminance, 0 (black) to 1 (white). */
function luminance(hex: string) {
  const [r, g, b] = hexToRgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

const DARK_INK = "#171717";

export type CardInk = {
  /** Title, message, signature, location, date. */
  ink: string;
  /** Lyrics. */
  soft: string;
  /** Artist name. */
  muted: string;
  /** Card ID. */
  faint: string;
};

const LIGHT_CARD_INK: CardInk = {
  ink: DARK_INK,
  soft: "rgba(23, 23, 23, 0.9)",
  muted: "rgba(23, 23, 23, 0.6)",
  faint: "rgba(23, 23, 23, 0.2)",
};

const DARK_CARD_INK: CardInk = {
  ink: "#ffffff",
  soft: "#ffffff",
  muted: "rgba(255, 255, 255, 0.7)",
  faint: "rgba(255, 255, 255, 0.4)",
};

/** Picks white or dark text, whichever contrasts more with the card color. */
export function cardInk(cardColor: string): CardInk {
  const bg = luminance(cardColor);
  const contrastWithWhite = 1.05 / (bg + 0.05);
  const contrastWithDark = (bg + 0.05) / (luminance(DARK_INK) + 0.05);
  return contrastWithWhite > contrastWithDark ? DARK_CARD_INK : LIGHT_CARD_INK;
}
