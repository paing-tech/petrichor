import "server-only";
import { cacheLife } from "next/cache";
import { getMusicMatchEnv } from "@/lib/env";

/**
 * A YouTube video's shape (width ÷ height), so a player can match it: square art tracks fill a
 * square player, music videos a 16:9 one. Read from the YouTube Data API's embed size (oEmbed
 * reports square art tracks as 4:3, so it can't be used). Cached for weeks, since a video's
 * shape doesn't change. Throws on failure so failures aren't cached.
 */
async function fetchYouTubeAspect(videoId: string, apiKey: string): Promise<number> {
  "use cache";
  cacheLife("weeks");

  const url = new URL("https://www.googleapis.com/youtube/v3/videos");
  url.search = new URLSearchParams({ part: "player", id: videoId, maxWidth: "1000", key: apiKey }).toString();
  const response = await fetch(url);
  if (!response.ok) throw new Error(`YouTube videos.list failed with ${response.status}`);
  const body = (await response.json()) as {
    items?: { player?: { embedWidth?: string | number; embedHeight?: string | number } }[];
  };
  const width = Number(body.items?.[0]?.player?.embedWidth);
  const height = Number(body.items?.[0]?.player?.embedHeight);
  if (!width || !height) throw new Error("YouTube returned no embed size");
  return width / height;
}

/** The video's shape, or null if it can't be read right now (or there's no API key). Never throws. */
export async function getYouTubeAspect(videoId: string): Promise<number | null> {
  const { youtubeApiKey } = getMusicMatchEnv();
  if (!youtubeApiKey) return null;
  try {
    return await fetchYouTubeAspect(videoId, youtubeApiKey);
  } catch {
    return null;
  }
}
