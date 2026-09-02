// Pure helpers and limits for article text. No DB access and no "server-only"
// guard, so components on either side of the boundary can use them. (A
// "use server" file can only export async functions, so the limits can't live
// in the submit action alongside the validation that enforces them.)

export const TITLE_MAX = 140;
export const AUTHOR_MAX = 60;
export const BODY_MAX = 40000;

/** Blank-line-separated paragraphs, for rendering a body as text. */
export function paragraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

/** First ~`max` characters of the body, for list/card previews. */
export function excerpt(body: string, max = 220): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

/** Rough reading time in minutes, for the byline. */
export function readMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/** "Sep 1, 2026" — fixed locale/zone so server and client agree. */
export function articleDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  });
}
