import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songMatches } from "@/db/schema";
import { APPLE_MUSIC_URL_PATTERN } from "@/lib/apple-music";
import { getMusicMatchEnv } from "@/lib/env";

// Finds a card's song on Spotify and YouTube, so the card page can offer those players too.
// Each song is looked up once (its result is stored in song_matches and shared by every card
// with that song); "not found" is retried after RETRY_AFTER_DAYS in case it appears later.

const RETRY_AFTER_DAYS = 30;
/** A Spotify match must be within this many seconds of the Apple Music track's length. */
const DURATION_TOLERANCE_S = 4;

export type SongMatches = { spotifyTrackId: string | null; youtubeVideoId: string | null };

type Song = { title: string; artist: string; appleMusicUrl: string | null };

function songKey({ title, artist, appleMusicUrl }: Song) {
  const apple = appleMusicUrl ? APPLE_MUSIC_URL_PATTERN.exec(appleMusicUrl) : null;
  return apple ? `apple:${apple[3]}` : `manual:${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

const due = (checkedAt: Date | null) =>
  !checkedAt || Date.now() - checkedAt.getTime() > RETRY_AFTER_DAYS * 24 * 60 * 60 * 1000;

/** The song's Spotify and YouTube IDs, looking them up first if they're due. Never throws. */
export async function getSongMatches(song: Song): Promise<SongMatches> {
  const key = songKey(song);
  const env = getMusicMatchEnv();
  const db = getDb();
  try {
    const [row] = await db.select().from(songMatches).where(eq(songMatches.songKey, key)).limit(1);
    const result: SongMatches = { spotifyTrackId: row?.spotifyTrackId ?? null, youtubeVideoId: row?.youtubeVideoId ?? null };

    const lookups: Promise<void>[] = [];
    const now = new Date();
    const update: Partial<typeof songMatches.$inferInsert> = {};
    if (env.spotify && !result.spotifyTrackId && due(row?.spotifyCheckedAt ?? null)) {
      lookups.push(
        findOnSpotify(song, env.spotify).then((id) => {
          result.spotifyTrackId = id;
          Object.assign(update, { spotifyTrackId: id, spotifyCheckedAt: now });
        }),
      );
    }
    if (env.youtubeApiKey && !result.youtubeVideoId && due(row?.youtubeCheckedAt ?? null)) {
      lookups.push(
        findOnYouTube(song, env.youtubeApiKey).then((id) => {
          result.youtubeVideoId = id;
          Object.assign(update, { youtubeVideoId: id, youtubeCheckedAt: now });
        }),
      );
    }
    // A failed lookup (network, quota) isn't recorded, so it's simply tried again next time.
    await Promise.allSettled(lookups);
    if (Object.keys(update).length) {
      await db
        .insert(songMatches)
        .values({ songKey: key, ...update })
        .onConflictDoUpdate({ target: songMatches.songKey, set: update });
    }
    return result;
  } catch (error) {
    console.error("Song matching failed", error);
    return { spotifyTrackId: null, youtubeVideoId: null };
  }
}

const normalize = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/** The first artist named on the card (before "&", ",", "feat."), for loose comparisons. */
const leadArtist = (artist: string) => normalize(artist.split(/,|&| feat\.?| ft\.?| x /i)[0] ?? artist);

/** Apple Music's length for the track, to tell the right recording from remixes and live versions. */
async function appleDurationMs(appleMusicUrl: string | null) {
  const match = appleMusicUrl ? APPLE_MUSIC_URL_PATTERN.exec(appleMusicUrl) : null;
  if (!match) return null;
  const response = await fetch(`https://itunes.apple.com/lookup?id=${match[3]}&country=${match[1]}`);
  if (!response.ok) return null;
  const body = (await response.json()) as { results?: { trackTimeMillis?: number }[] };
  return body.results?.[0]?.trackTimeMillis ?? null;
}

let spotifyToken: { value: string; expiresAt: number } | null = null;

async function spotifyAccessToken({ clientId, clientSecret }: { clientId: string; clientSecret: string }) {
  if (spotifyToken && spotifyToken.expiresAt > Date.now() + 60_000) return spotifyToken.value;
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!response.ok) throw new Error(`Spotify token request failed (${response.status})`);
  const body = (await response.json()) as { access_token: string; expires_in: number };
  spotifyToken = { value: body.access_token, expiresAt: Date.now() + body.expires_in * 1000 };
  return spotifyToken.value;
}

/** The Spotify track for this song: same lead artist, and the same length when Apple's is known. */
async function findOnSpotify(song: Song, credentials: { clientId: string; clientSecret: string }) {
  const [token, durationMs] = await Promise.all([spotifyAccessToken(credentials), appleDurationMs(song.appleMusicUrl)]);
  const params = new URLSearchParams({ q: `track:${song.title} artist:${song.artist}`, type: "track", limit: "10" });
  const response = await fetch(`https://api.spotify.com/v1/search?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error(`Spotify search failed (${response.status})`);
  const body = (await response.json()) as {
    tracks?: { items?: { id: string; name: string; duration_ms: number; artists: { name: string }[] }[] };
  };
  const artist = leadArtist(song.artist);
  const title = normalize(song.title);
  const match = (body.tracks?.items ?? []).find(
    (t) =>
      t.artists.some((a) => normalize(a.name) === artist || normalize(a.name).includes(artist)) &&
      (normalize(t.name) === title || normalize(t.name).startsWith(title)) &&
      (durationMs === null || Math.abs(t.duration_ms - durationMs) <= DURATION_TOLERANCE_S * 1000),
  );
  return match?.id ?? null;
}

/** A YouTube video of this song that can be played in an embed (prefers official audio). */
async function findOnYouTube(song: Song, apiKey: string) {
  const params = new URLSearchParams({
    part: "snippet",
    q: `${song.artist} - ${song.title}`,
    type: "video",
    videoCategoryId: "10", // Music
    videoEmbeddable: "true",
    videoSyndicated: "true", // playable outside youtube.com
    maxResults: "5",
    key: apiKey,
  });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
  if (!response.ok) throw new Error(`YouTube search failed (${response.status})`);
  const body = (await response.json()) as { items?: { id: { videoId: string }; snippet: { channelTitle: string } }[] };
  const items = body.items ?? [];
  // The artist's auto-generated "… - Topic" channel carries the official audio; then the
  // artist's own channel; then YouTube's best match.
  const artist = leadArtist(song.artist);
  const topic = items.find((i) => normalize(i.snippet.channelTitle).startsWith(artist) && /topic$/i.test(i.snippet.channelTitle));
  const own = items.find((i) => normalize(i.snippet.channelTitle).includes(artist));
  return (topic ?? own ?? items[0])?.id.videoId ?? null;
}
