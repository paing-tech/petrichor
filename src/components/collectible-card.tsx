import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export type CollectibleCardData = {
  songTitle: string;
  artistName: string;
  photoUrl?: string | null;
  lyricsExcerpt?: string | null;
  message?: string | null;
  senderName?: string | null;
  cardId?: string | null;
};

type CollectibleCardProps = {
  card: CollectibleCardData;
  /** Spin the vinyl (ignored when the viewer prefers reduced motion). */
  spinning?: boolean;
  className?: string;
};

// The card is designed on a 390 × 520 canvas. Every measurement is expressed in
// canvas pixels and converted with `u()`, which scales against the card's own
// width via container query units, so the layout stays identical at any size.
const BASE_WIDTH = 390;
const u = (px: number) => `calc(var(--u) * ${px})`;

const PHOTO_HEIGHT = 293;
const VINYL_SIZE = 176;

export function CollectibleCard({ card, spinning = false, className }: CollectibleCardProps) {
  return (
    <div
      className={cn("@container relative aspect-[3/4] w-full max-w-[390px]", className)}
    >
      <article
        aria-label={`${card.songTitle} by ${card.artistName}`}
        className="absolute inset-0 overflow-hidden bg-white text-neutral-900 shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_40px_-12px_rgba(40,30,20,0.35)] ring-1 ring-black/5"
        style={{ "--u": `calc(100cqw / ${BASE_WIDTH})`, borderRadius: u(18) } as CSSProperties}
      >
        <CardPhoto photoUrl={card.photoUrl} alt={`Photo for ${card.songTitle}`} />

        <VinylDisc spinning={spinning} />

        <div
          className="absolute flex flex-col"
          style={{ top: u(232), left: u(26), right: u(26), bottom: u(20) }}
        >
          {card.lyricsExcerpt && (
            <blockquote
              className="line-clamp-3 font-serif text-neutral-700 italic"
              style={{ fontSize: u(16), lineHeight: 1.3, marginBottom: u(14) }}
            >
              &ldquo;{card.lyricsExcerpt}&rdquo;
            </blockquote>
          )}

          <h2
            className="line-clamp-1 font-serif text-neutral-950"
            style={{ fontSize: u(30), lineHeight: 1.1, letterSpacing: "-0.01em" }}
          >
            {card.songTitle}
          </h2>
          <p
            className="line-clamp-1 font-medium tracking-wide text-neutral-500 uppercase"
            style={{ fontSize: u(11.5), marginTop: u(6) }}
          >
            {card.artistName}
          </p>

          {(card.message || card.senderName) && (
            <div style={{ marginTop: u(14), maxWidth: u(236) }}>
              {card.message && (
                <p
                  className="line-clamp-4 whitespace-pre-line text-neutral-700"
                  style={{ fontSize: u(12.5), lineHeight: 1.45 }}
                >
                  {card.message}
                </p>
              )}
              {card.senderName && (
                <p
                  className="line-clamp-1 font-serif text-neutral-900 italic"
                  style={{ fontSize: u(15), marginTop: u(4) }}
                >
                  &mdash; {card.senderName}
                </p>
              )}
            </div>
          )}

          <div
            className="mt-auto flex items-center text-neutral-400"
            style={{ gap: u(8), fontSize: u(8.5) }}
          >
            <span className="font-semibold tracking-[0.25em] text-neutral-500">PETRICHOR</span>
            <span className="font-mono">{card.cardId ?? "P-··························"}</span>
          </div>
        </div>
      </article>
    </div>
  );
}

function CardPhoto({ photoUrl, alt }: { photoUrl?: string | null; alt: string }) {
  return (
    <div className="absolute inset-x-0 top-0" style={{ height: u(PHOTO_HEIGHT) }}>
      {photoUrl ? (
        // A plain <img> handles both remote R2 URLs and local blob: previews.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={alt} className="size-full object-cover" />
      ) : (
        <div
          aria-hidden
          className="size-full"
          style={{
            background:
              "radial-gradient(120% 80% at 20% 10%, #e7ece6 0%, transparent 60%), radial-gradient(90% 70% at 85% 30%, #c9d3cc 0%, transparent 65%), linear-gradient(165deg, #dfe4de 0%, #b9c4bb 55%, #a7b2a8 100%)",
          }}
        />
      )}
      {/* Fade the photo into the white card body. */}
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(255,255,255,0) 35%, rgba(255,255,255,0.6) 62%, rgba(255,255,255,0.94) 79%, #fff 92%)",
        }}
      />
    </div>
  );
}

function VinylDisc({ spinning }: { spinning: boolean }) {
  return (
    <div
      aria-hidden
      className="absolute rounded-full shadow-[0_6px_24px_-6px_rgba(0,0,0,0.45)]"
      style={{ width: u(VINYL_SIZE), height: u(VINYL_SIZE), right: u(-50), bottom: u(-50) }}
    >
      <div
        className={cn(
          "size-full rounded-full",
          spinning && "motion-safe:animate-[spin_8s_linear_infinite]",
        )}
        style={{
          background: [
            // spindle hole, label marker, label, label edge
            "radial-gradient(circle at 50% 50%, #fff 0 3%, transparent 3.2%)",
            "radial-gradient(circle at 50% 38%, rgba(255,255,255,0.55) 0 2.2%, transparent 2.4%)",
            "radial-gradient(circle at 50% 50%, #b5543a 0 29%, #2a1a14 29.5% 31%, transparent 31.5%)",
            // grooves
            "repeating-radial-gradient(circle at 50% 50%, #141414 0 1.1%, #232323 1.1% 1.5%, #181818 1.5% 2.2%)",
          ].join(", "),
        }}
      />
      {/* Static sheen so the highlight stays put while the disc turns. */}
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background:
            "conic-gradient(from 35deg, transparent 0deg, rgba(255,255,255,0.14) 25deg, transparent 55deg, transparent 180deg, rgba(255,255,255,0.1) 205deg, transparent 235deg)",
          mask: "radial-gradient(circle, transparent 31%, #000 31.5%)",
        }}
      />
    </div>
  );
}
