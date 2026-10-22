/** A YouTube video ID: 11 letters, digits, "-" or "_". */
export const YOUTUBE_VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

/**
 * The video ID in a YouTube link: youtube.com/watch?v=…, youtu.be/…, music.youtube.com,
 * /shorts/…, /embed/…, /live/…, with or without "https://". Null if it isn't one.
 */
export function parseYouTubeVideoId(input: string): string | null {
  const text = input.trim();
  if (YOUTUBE_VIDEO_ID.test(text)) return text;
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  const [first, second] = url.pathname.split("/").filter(Boolean);
  let id: string | null | undefined = null;
  if (host === "youtu.be" || host === "www.youtu.be") id = first;
  else if (YOUTUBE_HOSTS.has(host)) {
    id = first === "watch" ? url.searchParams.get("v") : ["shorts", "embed", "live", "v"].includes(first ?? "") ? second : null;
  }
  return id && YOUTUBE_VIDEO_ID.test(id) ? id : null;
}
