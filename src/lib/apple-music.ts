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

export function buildItunesSearchUrl(term: string, storefront: string) {
  const params = new URLSearchParams({
    term,
    country: storefront,
    media: "music",
    entity: "song",
    limit: String(RESULT_LIMIT),
  });
  return `${ITUNES_SEARCH_URL}?${params}`;
}

/** Turns raw iTunes results into songs, skipping anything that isn't a playable track. */
export function parseItunesSongs(results: unknown, storefront: string): SongSearchResult[] {
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

// On iPhones and iPads with a phone-style browser, Apple answers the search API with a
// redirect to the Music app (musics://…) instead of results, which a web page can't
// follow. When that happens we switch to our own /api/songs, which asks Apple from the
// server, for the rest of the visit.
let searchThroughServer = false;

/** Searches Apple's catalog: directly from the browser when possible, otherwise via /api/songs. */
export async function searchSongs(
  term: string,
  storefront: string,
  signal?: AbortSignal,
): Promise<SongSearchResult[]> {
  if (!searchThroughServer) {
    try {
      return await searchDirect(term, storefront, signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      if (error instanceof SongSearchError && error.reason === "rate_limited") throw error;
      searchThroughServer = true;
    }
  }
  return searchViaServer(term, storefront, signal);
}

async function searchDirect(term: string, storefront: string, signal?: AbortSignal) {
  let response = await fetch(buildItunesSearchUrl(term, storefront), { signal });
  // Unknown storefronts are rejected; fall back to the US catalog.
  if (response.status === 400 && storefront !== DEFAULT_STOREFRONT) {
    storefront = DEFAULT_STOREFRONT;
    response = await fetch(buildItunesSearchUrl(term, storefront), { signal });
  }
  if (!response.ok) {
    throw new SongSearchError(response.status === 403 || response.status === 429 ? "rate_limited" : "failed");
  }
  const body = (await response.json()) as { results?: unknown };
  return parseItunesSongs(body?.results, storefront);
}

async function searchViaServer(term: string, storefront: string, signal?: AbortSignal) {
  const params = new URLSearchParams({ term, country: storefront });
  const response = await fetch(`/api/songs?${params}`, { signal });
  if (!response.ok) {
    throw new SongSearchError(response.status === 429 ? "rate_limited" : "failed");
  }
  const body = (await response.json()) as { storefront: string; results: unknown };
  return parseItunesSongs(body.results, body.storefront);
}

export const DEFAULT_SEARCH_STOREFRONT = DEFAULT_STOREFRONT;

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
