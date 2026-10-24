import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { songMatches } from "@/db/schema";
import { APPLE_MUSIC_URL_PATTERN } from "@/lib/apple-music";
import { getMusicMatchEnv } from "@/lib/env";

// Finds a card's song on Spotify and YouTube, so the card page can offer those players too.
// Each song is looked up once (its result is stored in song_matches and shared by every card
// with that song); "not found" is retried after a while in case it appears later (or the
// search missed it).

const RETRY_AFTER_DAYS = 30;
/**
 * YouTube's "not found" is retried sooner: its search can miss a video it has (an empty or odd
 * result now and then), and a few days without a player beats searching on every visit.
 */
const YOUTUBE_RETRY_AFTER_DAYS = 3;
/** A Spotify match must be within this many seconds of the Apple Music track's length. */
const DURATION_TOLERANCE_S = 4;

export type SongMatches = { spotifyTrackId: string | null; youtubeVideoId: string | null };

type Song = { title: string; artist: string; appleMusicUrl: string | null };

function songKey({ title, artist, appleMusicUrl }: Song) {
  const apple = appleMusicUrl ? APPLE_MUSIC_URL_PATTERN.exec(appleMusicUrl) : null;
  return apple ? `apple:${apple[3]}` : `manual:${title.trim().toLowerCase()}|${artist.trim().toLowerCase()}`;
}

const due = (checkedAt: Date | null, days = RETRY_AFTER_DAYS) =>
  !checkedAt || Date.now() - checkedAt.getTime() > days * 24 * 60 * 60 * 1000;

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
    if (env.youtubeApiKey && !result.youtubeVideoId && due(row?.youtubeCheckedAt ?? null, YOUTUBE_RETRY_AFTER_DAYS)) {
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

/** Like normalize, but keeping what's in brackets: "봄여름가을겨울 (Still Life)" keeps "still life". */
const normalizeLoose = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

/**
 * Whether a video's title names the song: with brackets set aside (so "Song (Official Video)"
 * matches "Song"), or with them kept, for songs whose English name is in brackets beside the
 * original, such as BIGBANG's "봄여름가을겨울 (Still Life)".
 */
const titleNamesSong = (videoTitle: string, songTitle: string) =>
  normalize(videoTitle).includes(normalize(songTitle)) ||
  normalizeLoose(videoTitle).includes(normalizeLoose(songTitle));

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

export type YouTubeVideoInfo = {
  title: string;
  channel: string;
  /** Whether it can play in a player on another site (some uploads are YouTube-only). */
  embeddable: boolean;
  /** Whether its title names the song, as a hint that it's the right video. */
  namesSong: boolean;
  /** Its length, in seconds. */
  durationSeconds: number;
};

/**
 * One video's title, channel, and whether it can be embedded, for a link pasted by a card's
 * creator; null if there's no such video (or it's private), or YouTube isn't set up. Throws when
 * YouTube can't be reached, so a failed check isn't mistaken for a missing video.
 */
export async function lookUpYouTubeVideo(videoId: string, songTitle: string): Promise<YouTubeVideoInfo | null> {
  const { youtubeApiKey } = getMusicMatchEnv();
  if (!youtubeApiKey) return null;
  const params = new URLSearchParams({ part: "snippet,status,contentDetails", id: videoId, key: youtubeApiKey });
  const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
  if (!response.ok) throw new Error(`YouTube videos lookup failed (${response.status})`);
  const [video] = ((await response.json()) as { items?: YouTubeVideo[] }).items ?? [];
  if (!video) return null;
  return {
    title: video.snippet.title,
    channel: video.snippet.channelTitle,
    embeddable: video.status.embeddable,
    namesSong: titleNamesSong(video.snippet.title, songTitle),
    durationSeconds: isoDurationSeconds(video.contentDetails.duration),
  };
}

/** How close (seconds) a "Topic" audio upload must be to the Apple Music track's length. */
const YOUTUBE_DURATION_TOLERANCE_S = 5;
/** Uploads that aren't the song as released, unless the song's own title says so. */
const NOT_THE_RELEASE =
  /\b(live|cover|covers|karaoke|instrumental|remix|sped ?up|slowed|nightcore|reverb|8d|reaction|lyrics?|transition|mashup|acoustic|demo|tour|concert|livestream|fan ?made|tiktok)\b/i;

/** How an artist titles their own music video: "Official (Music) Video", or "M/V" / "MV" (K-pop's). */
const OFFICIAL_VIDEO = /official (music )?video|\bm\/?v\b/i;

/** "PT4M1S" → 241. */
function isoDurationSeconds(iso: string) {
  const [, h = "0", m = "0", sec = "0"] = /PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(iso) ?? [];
  return Number(h) * 3600 + Number(m) * 60 + Number(sec);
}

type YouTubeVideo = {
  id: string;
  snippet: { title: string; channelTitle: string };
  contentDetails: { duration: string };
  status: { embeddable: boolean };
};

/** One YouTube search, with the found videos' details (channel, title, length, embeddable). */
async function searchYouTube(query: string, apiKey: string): Promise<YouTubeVideo[]> {
  const search = new URLSearchParams({
    part: "snippet",
    q: query,
    type: "video",
    videoEmbeddable: "true",
    maxResults: "15",
    key: apiKey,
  });
  const searchResponse = await fetch(`https://www.googleapis.com/youtube/v3/search?${search}`);
  if (!searchResponse.ok) throw new Error(`YouTube search failed (${searchResponse.status})`);
  const found = (await searchResponse.json()) as { items?: { id: { videoId?: string } }[] };
  const ids = (found.items ?? []).flatMap((item) => (item.id.videoId ? [item.id.videoId] : []));
  if (ids.length === 0) return [];

  const details = new URLSearchParams({ part: "snippet,contentDetails,status", id: ids.join(","), key: apiKey });
  const detailsResponse = await fetch(`https://www.googleapis.com/youtube/v3/videos?${details}`);
  if (!detailsResponse.ok) throw new Error(`YouTube videos lookup failed (${detailsResponse.status})`);
  const videos = ((await detailsResponse.json()) as { items?: YouTubeVideo[] }).items ?? [];
  // In YouTube's relevance order.
  return videos.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
}

/**
 * An official YouTube video of this song that can be played in an embed, or null. Prefers the
 * artist's official music video, then the artist's "Topic" audio (same length as the Apple Music
 * track), then the artist's own official audio or visualizer. Never falls back to other uploads
 * (fans' re-uploads, live versions, lyric videos): no player is better than the wrong song.
 * Searches for the artist and title, then, if nothing official turns up, once more asking for
 * the official video.
 */
async function findOnYouTube(song: Song, apiKey: string) {
  const durationMs = await appleDurationMs(song.appleMusicUrl);
  const artist = leadArtist(song.artist).replace(/\s+/g, "");
  const titleAllows = (word: RegExp) => word.test(song.title);

  const channel = (video: YouTubeVideo) => normalize(video.snippet.channelTitle).replace(/\s+/g, "");
  const isTopic = (video: YouTubeVideo) =>
    channel(video) === `${artist}topic` || /^(.*) - topic$/i.test(video.snippet.channelTitle) && channel(video).startsWith(artist);
  // The artist's own channel (named after them, or their VEVO channel), not a fan's.
  const isArtists = (video: YouTubeVideo) => channel(video) === artist || channel(video) === `${artist}vevo` || channel(video) === `${artist}official`;
  const sameLength = (video: YouTubeVideo) =>
    durationMs === null ||
    Math.abs(isoDurationSeconds(video.contentDetails.duration) - durationMs / 1000) <= YOUTUBE_DURATION_TOLERANCE_S;

  const pick = (videos: YouTubeVideo[]) => {
    const candidates = videos
      .filter((video) => video.status.embeddable)
      .filter((video) => titleNamesSong(video.snippet.title, song.title))
      .filter((video) => !NOT_THE_RELEASE.test(video.snippet.title) || titleAllows(NOT_THE_RELEASE));
    // Uploads on the artist's VEVO channel are the label's own, whatever their title says.
    const officialVideo = candidates.find(
      (video) =>
        isArtists(video) && (OFFICIAL_VIDEO.test(video.snippet.title) || channel(video) === `${artist}vevo`),
    );
    const topicAudio = candidates.find((video) => isTopic(video) && sameLength(video));
    const officialAudio = candidates.find(
      (video) => isArtists(video) && /official (audio|visuali[sz]er)|\(audio\)|\(visuali[sz]er\)/i.test(video.snippet.title),
    );
    return { match: officialVideo ?? topicAudio ?? officialAudio ?? null, candidates: candidates.length };
  };

  const queries = [`${song.artist} ${song.title}`, `${song.artist} ${song.title} official video`];
  const tried: string[] = [];
  for (const query of queries) {
    const videos = await searchYouTube(query, apiKey);
    const { match, candidates } = pick(videos);
    if (match) return match.id;
    tried.push(`"${query}": ${videos.length} found, ${candidates} named the song, none official`);
  }
  // Why it wasn't matched, for looking into misses.
  console.info(`No official YouTube video for ${song.artist} – ${song.title}. ${tried.join("; ")}`);
  return null;
}
