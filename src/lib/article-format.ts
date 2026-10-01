// Pure helpers and limits for article text. No DB access and no "server-only"
// guard, so components on either side of the boundary can use them. (A
// "use server" file can only export async functions, so the limits can't live
// in the submit action alongside the validation that enforces them.)

export const TITLE_MAX = 140;
export const AUTHOR_MAX = 60;
export const BODY_MAX = 40000;

// Inline images. The body stays plain text: an image is a marker line,
// `[[image:<file>]]`, naming a file in the public `article-images` storage
// bucket. Only the exact name shape the upload action generates (uuid + .jpg)
// is recognised, so a marker can never point an <img> at an arbitrary URL —
// anything else just renders as the text it is.
export const IMAGE_BUCKET = "article-images";
export const IMAGES_MAX = 12;
/** Cap on an uploaded image, after the form has downscaled it. */
export const IMAGE_MAX_BYTES = 1_500_000;

const IMAGE_FILE = "[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}\\.jpg";
const IMAGE_LINE = new RegExp(`^\\[\\[image:(${IMAGE_FILE})\\]\\]$`);
const IMAGE_MARKERS = new RegExp(`\\[\\[image:${IMAGE_FILE}\\]\\]`, "g");

export function imageMarker(file: string): string {
  return `[[image:${file}]]`;
}

export function imageUrl(file: string): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${IMAGE_BUCKET}/${file}`;
}

/** How many image markers a body contains (for the per-article cap). */
export function imageCount(body: string): number {
  return body.match(IMAGE_MARKERS)?.length ?? 0;
}

export type ArticleBlock =
  | { type: "text"; text: string }
  | { type: "image"; file: string };

/** The body as renderable blocks: blank-line-separated paragraphs of text,
 *  with any line that is exactly an image marker pulled out as an image. */
export function articleBlocks(body: string): ArticleBlock[] {
  const blocks: ArticleBlock[] = [];
  for (const para of body.replace(/\r\n/g, "\n").split(/\n{2,}/)) {
    let text: string[] = [];
    const flush = () => {
      const t = text.join("\n").trim();
      if (t) blocks.push({ type: "text", text: t });
      text = [];
    };
    for (const line of para.split("\n")) {
      const m = IMAGE_LINE.exec(line.trim());
      if (m) {
        flush();
        blocks.push({ type: "image", file: m[1] });
      } else {
        text.push(line);
      }
    }
    flush();
  }
  return blocks;
}

/** First ~`max` characters of the body, for list/card previews. */
export function excerpt(body: string, max = 220): string {
  const flat = body.replace(IMAGE_MARKERS, " ").replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${cut.slice(0, lastSpace > 40 ? lastSpace : max).trimEnd()}…`;
}

/** Rough reading time in minutes, for the byline. */
export function readMinutes(body: string): number {
  const words = body
    .replace(IMAGE_MARKERS, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
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
