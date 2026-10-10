import { z } from "zod";

// Client-safe helpers for the iTunes Search API and Apple Music links.
// Search runs in the visitor's browser: the API allows any origin, and its
// ~20 requests/minute limit is per IP, so each visitor gets their own budget.

const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";
const DEFAULT_STOREFRONT = "us";
const RESULT_LIMIT = 8;

const itunesSongSchema = z.object({
  kind: z.literal("song"),
  trackId: z.number().int().positive(),
  collectionId: z.number().int().positive(),
  trackName: z.string().min(1),
  artistName: z.string().min(1),
  collectionName: z.string().optional(),
  artworkUrl100: z.url().optional(),
  releaseDate: z.string().optional(),
});

export type AppleMusicTrack = {
  storefront: string;
  collectionId: string;
  trackId: string;
};

export type SongSearchResult = AppleMusicTrack & {
  title: string;
  artist: string;
  album: string | null;
  artworkUrl: string | null;
  year: string | null;
};

export class SongSearchError extends Error {
  constructor(readonly reason: "rate_limited" | "failed") {
    super(reason);
  }
}

export async function searchSongs(
  term: string,
  storefront: string,
  signal?: AbortSignal,
): Promise<SongSearchResult[]> {
  const params = new URLSearchParams({
    term,
    country: storefront,
    media: "music",
    entity: "song",
    limit: String(RESULT_LIMIT),
  });

  let response = await fetch(`${ITUNES_SEARCH_URL}?${params}`, { signal });
  // Unknown storefronts are rejected; fall back to the US catalog.
  if (response.status === 400 && storefront !== DEFAULT_STOREFRONT) {
    params.set("country", DEFAULT_STOREFRONT);
    storefront = DEFAULT_STOREFRONT;
    response = await fetch(`${ITUNES_SEARCH_URL}?${params}`, { signal });
  }
  if (!response.ok) {
    throw new SongSearchError(response.status === 403 || response.status === 429 ? "rate_limited" : "failed");
  }

  const body: unknown = await response.json();
  const results = (body as { results?: unknown })?.results;
  if (!Array.isArray(results)) return [];

  return results.flatMap((raw) => {
    const parsed = itunesSongSchema.safeParse(raw);
    if (!parsed.success) return [];
    const song = parsed.data;
    return [
      {
        storefront,
        trackId: String(song.trackId),
        collectionId: String(song.collectionId),
        title: song.trackName,
        artist: song.artistName,
        album: song.collectionName ?? null,
        artworkUrl: song.artworkUrl100 ?? null,
        year: song.releaseDate?.slice(0, 4) ?? null,
      },
    ];
  });
}

/** Picks the Apple Music storefront from the browser's locale, e.g. "en-SG" → "sg". */
export function detectStorefront(): string {
  for (const tag of navigator.languages ?? [navigator.language]) {
    try {
      const region = new Intl.Locale(tag).maximize().region;
      if (region && /^[A-Z]{2}$/.test(region)) return region.toLowerCase();
    } catch {
      // Ignore malformed language tags.
    }
  }
  return DEFAULT_STOREFRONT;
}

export const APPLE_MUSIC_URL_PATTERN = /^https:\/\/music\.apple\.com\/([a-z]{2})\/album\/(\d{1,15})\?i=(\d{1,15})$/;

export function buildAppleMusicUrl({ storefront, collectionId, trackId }: AppleMusicTrack) {
  return `https://music.apple.com/${storefront}/album/${collectionId}?i=${trackId}`;
}

/** Converts a canonical Apple Music track URL into its official embed player URL. */
export function appleMusicEmbedUrl(url: string): string | null {
  const match = APPLE_MUSIC_URL_PATTERN.exec(url);
  return match ? `https://embed.music.apple.com/${match[1]}/album/${match[2]}?i=${match[3]}` : null;
}

export function appleMusicSearchUrl(title: string, artist: string) {
  return `https://music.apple.com/${DEFAULT_STOREFRONT}/search?term=${encodeURIComponent(`${title} ${artist}`)}`;
}

export function spotifySearchUrl(title: string, artist: string) {
  return `https://open.spotify.com/search/${encodeURIComponent(`${title} ${artist}`)}`;
}
