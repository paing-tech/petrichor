/**
 * The site's public address, for links that leave the page (like the QR code on a card's back).
 * Set NEXT_PUBLIC_SITE_URL to the real domain; on Vercel it falls back to the production domain.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

/** A card's page, as a full address. */
export const cardUrl = (cardId: string) => `${SITE_URL}/c/${cardId}`;
