import type { NextRequest } from "next/server";
import { searchItunesCatalog } from "@/lib/itunes-search";

/** Song search proxy for browsers that Apple won't answer directly (iPhones). */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  // Apple's search ignores case, so lowercasing makes more searches share a cache entry.
  const term = (params.get("term") ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  const country = (params.get("country") ?? "us").toLowerCase();
  if (term.length < 2 || term.length > 100 || !/^[a-z]{2}$/.test(country)) {
    return Response.json({ error: "Invalid search" }, { status: 400 });
  }

  try {
    const data = await searchItunesCatalog(term, country);
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
    });
  } catch (error) {
    console.error("Song search failed", error);
    return Response.json({ error: "Search isn't available right now" }, { status: 502 });
  }
}
