import { ImageResponse } from "next/og";
import { SHARE_IMAGE_SIZE, ShareImage } from "@/components/card/share-image";
import { cardQrSvg } from "@/lib/card-qr";
import { getCardByCardId } from "@/lib/cards";
import { getCardOwnership } from "@/lib/ownership";
import { cardUrl } from "@/lib/site-url";
import { CARD_ID_PATTERN } from "@/lib/validation";

/** A Google font as TrueType (what Google serves when the request names no browser), which Satori reads. */
async function loadGoogleFont(family: string): Promise<ArrayBuffer> {
  const css = await fetch(`https://fonts.googleapis.com/css2?family=${family}`).then((r) => r.text());
  const url = /src: url\((.+?)\) format\('(?:truetype|opentype)'\)/.exec(css)?.[1];
  if (!url) throw new Error(`No TrueType file for ${family}`);
  return fetch(url).then((r) => r.arrayBuffer());
}

// Fetched once per server instance, then reused.
let fonts: Promise<{ name: string; data: ArrayBuffer; weight: 400; style: "normal" }[]> | null = null;
function loadFonts() {
  fonts ??= Promise.all([loadGoogleFont("Instrument+Serif"), loadGoogleFont("Outfit:wght@400")]).then(
    ([serif, outfit]) => [
      { name: "Instrument Serif", data: serif, weight: 400, style: "normal" },
      { name: "Outfit", data: outfit, weight: 400, style: "normal" },
    ],
  );
  fonts.catch(() => {
    fonts = null; // Try again next time.
  });
  return fonts;
}

/** The card's share image (PNG): its front, its owner, and a QR code to its page. */
export async function GET(_request: Request, { params }: RouteContext<"/c/[cardId]/share-image">) {
  const { cardId } = await params;
  const card = CARD_ID_PATTERN.test(cardId) ? await getCardByCardId(cardId) : null;
  if (!card) return new Response("Card not found", { status: 404 });

  try {
    const [ownership, fontData] = await Promise.all([getCardOwnership(cardId), loadFonts()]);
    return new ImageResponse(
      <ShareImage card={card} ownerUsername={ownership?.owner?.username ?? null} qrSvg={cardQrSvg(cardUrl(cardId))} />,
      {
        ...SHARE_IMAGE_SIZE,
        fonts: fontData,
        headers: {
          // The owner can change, so it's only kept briefly.
          "Cache-Control": "public, max-age=300",
          "Content-Disposition": `inline; filename="petrichor-${cardId}.png"`,
        },
      },
    );
  } catch (error) {
    console.error("Failed to draw the share image", error);
    return new Response("Couldn't draw the share image", { status: 500 });
  }
}
