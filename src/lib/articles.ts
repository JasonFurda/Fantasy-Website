import "server-only";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { IMAGE_BUCKET } from "@/lib/article-format";

export type Article = {
  id: number;
  slug: string;
  title: string;
  author: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

const COLUMNS = "id, slug, title, author, body, created_at, updated_at";

type ArticleRow = {
  id: number;
  slug: string;
  title: string;
  author: string;
  body: string;
  created_at: string;
  updated_at: string;
};

function rowToArticle(r: ArticleRow): Article {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    author: r.author,
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Published articles, newest first. `limit` caps the list (homepage card). */
export async function getArticles(limit?: number): Promise<Article[]> {
  let q = supabase
    .from("articles")
    .select(COLUMNS)
    .eq("published", true)
    .order("created_at", { ascending: false });
  if (limit != null) q = q.limit(limit);
  const { data } = await q;
  return ((data as ArticleRow[] | null) ?? []).map(rowToArticle);
}

/** One published article, or null if it doesn't exist / isn't published. */
export async function getArticleBySlug(slug: string): Promise<Article | null> {
  const { data } = await supabase
    .from("articles")
    .select(COLUMNS)
    .eq("slug", slug)
    .eq("published", true)
    .maybeSingle();
  return data ? rowToArticle(data as ArticleRow) : null;
}

/** Store an article image (already validated as a JPEG) under a generated
 *  name and return that name. Service-role write. */
export async function uploadArticleImageFile(bytes: Uint8Array): Promise<string> {
  const file = `${crypto.randomUUID()}.jpg`;
  const { error } = await supabaseAdmin()
    .storage.from(IMAGE_BUCKET)
    // Names are never reused, so the file can be cached for good.
    .upload(file, bytes, { contentType: "image/jpeg", cacheControl: "31536000" });
  if (error) throw new Error(error.message);
  return file;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base || "article";
}

/** Insert a new article, picking a slug that isn't taken yet.
 *  Returns the stored slug. Service-role write — callers must auth first. */
export async function createArticle(input: {
  title: string;
  author: string;
  body: string;
}): Promise<string> {
  const admin = supabaseAdmin();
  const base = slugify(input.title);

  // Try the clean slug first, then -2, -3, … A racing insert trips the unique
  // index (Postgres code 23505), which just means "try the next suffix".
  for (let n = 1; n <= 25; n++) {
    const slug = n === 1 ? base : `${base}-${n}`;
    const { error } = await admin.from("articles").insert({
      slug,
      title: input.title,
      author: input.author,
      body: input.body,
    });
    if (!error) return slug;
    if (error.code !== "23505") throw new Error(error.message);
  }
  throw new Error("Could not find an unused link for that title.");
}
