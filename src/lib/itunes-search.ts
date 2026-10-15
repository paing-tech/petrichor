import "server-only";
import { cacheLife } from "next/cache";
import { buildItunesSearchUrl, DEFAULT_SEARCH_STOREFRONT } from "@/lib/apple-music";

/**
 * Searches Apple's catalog from the server (for browsers Apple redirects to the Music
 * app). Results are cached for a day per term and country: every visitor shares the
 * server's IP and Apple allows only about 20 searches a minute per IP, so repeated
 * searches must not reach Apple again.
 */
export async function searchItunesCatalog(term: string, storefront: string) {
  "use cache";
  cacheLife("days");

  const headers = { "User-Agent": "Petrichor/1.0" };
  let response = await fetch(buildItunesSearchUrl(term, storefront), { headers });
  if (response.status === 400 && storefront !== DEFAULT_SEARCH_STOREFRONT) {
    storefront = DEFAULT_SEARCH_STOREFRONT;
    response = await fetch(buildItunesSearchUrl(term, storefront), { headers });
  }
  // Throwing keeps failures (including Apple's rate limit) out of the cache.
  if (!response.ok) throw new Error(`iTunes search failed with ${response.status}`);
  const body = (await response.json()) as { results?: unknown };
  return { storefront, results: Array.isArray(body.results) ? body.results : [] };
}
