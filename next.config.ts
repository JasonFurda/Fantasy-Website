import type { NextConfig } from "next";

/**
 * Pages whose HTML/RSC responses are cached on Vercel's CDN.
 *
 * They are still `force-dynamic` (they read query params like ?year=, which
 * Next.js can't prerender), so without this every view, nav prefetch and bot
 * crawl ran a function and counted against the Fast Origin Transfer allowance.
 * With it, Vercel serves repeat requests for the same URL from the CDN.
 *
 * Safe because none of these pages read cookies or other per-visitor input on
 * the server — "my team" highlighting is applied in the browser (see
 * src/lib/my-team-highlight.ts). Don't add a page here that calls cookies() or
 * headers(): one visitor's render would be served to everyone.
 *
 * The cache key is the full URL (query string included), and Vercel honours the
 * Vary header Next.js sets, so HTML and RSC payloads are cached separately.
 * The daily sync calls /api/revalidate, which purges the "pages" tag.
 */
const CDN_CACHED_PAGES = [
  "/standings",
  "/matchups",
  "/recap",
  "/year-stats",
  "/power-rankings",
  "/player-comparisons",
  "/draft-recap",
  "/trades",
  "/defense-stats",
];

// The data only changes once a day, but some pages also use the clock (e.g.
// which week counts as "current"), so cap staleness at an hour; the sync's
// purge refreshes everything immediately after new data lands.
const CDN_CACHE_SECONDS = 3600;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Article image uploads go through a server action; the form downscales
      // them first, but a detailed photo can still pass the 1 MB default.
      bodySizeLimit: "2mb",
    },
  },
  async headers() {
    return CDN_CACHED_PAGES.map((source) => ({
      source,
      headers: [
        {
          key: "Vercel-CDN-Cache-Control",
          value: `public, s-maxage=${CDN_CACHE_SECONDS}`,
        },
        { key: "Vercel-Cache-Tag", value: "pages" },
      ],
    }));
  },
};

export default nextConfig;
