import type { MetadataRoute } from "next";

/**
 * Keeps crawlers from burning the Vercel Fast Origin Transfer allowance.
 *
 * Every year / week / tab / player combination is its own URL (?year=…&week=…),
 * so a crawler following links can request thousands of server-rendered pages.
 * Search engines may still index the plain pages; query-string variants, the
 * API and the token/submit forms are off limits, and AI-training and SEO
 * scrapers are turned away entirely. (robots.txt is advisory — badly behaved
 * bots ignore it; Vercel's firewall bot rules are the backstop.)
 */
const BLOCKED_BOTS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "CCBot",
  "Google-Extended",
  "Bytespider",
  "Amazonbot",
  "Applebot-Extended",
  "PerplexityBot",
  "meta-externalagent",
  "FacebookBot",
  "Diffbot",
  "cohere-ai",
  "ImagesiftBot",
  "Omgilibot",
  "AhrefsBot",
  "SemrushBot",
  "MJ12bot",
  "DotBot",
  "PetalBot",
  "DataForSeoBot",
  "BLEXBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: BLOCKED_BOTS, disallow: "/" },
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/*?", "/api/", "/rankings-entry/", "/articlessubmit"],
      },
    ],
  };
}
