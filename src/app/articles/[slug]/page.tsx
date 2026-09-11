import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getArticleBySlug, getArticles } from "@/lib/articles";
import {
  articleDate,
  excerpt,
  paragraphs,
  readMinutes,
} from "@/lib/article-format";

// Static + ISR: Vercel's CDN serves this page without invoking a function.
// Publishing an article calls revalidatePath(), so new posts still appear
// immediately rather than waiting out the hour.
export const revalidate = 3600;

/** Prerender the articles that exist at build time; anything published later
 *  renders on demand, then gets cached (and revalidatePath'd on publish). */
export async function generateStaticParams() {
  const articles = await getArticles();
  return articles.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) return { title: "Article not found" };
  return {
    title: `${article.title} · Chamoms Fantasy`,
    description: excerpt(article.body, 160),
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getArticleBySlug(slug);
  if (!article) notFound();

  const edited = article.updatedAt !== article.createdAt;

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <Link
        href="/articles"
        className="text-xs text-accent hover:underline"
      >
        ← All articles
      </Link>

      <h1 className="mt-4 text-3xl font-black leading-tight tracking-tight">
        {article.title}
      </h1>
      <div className="mt-2 text-sm text-muted">
        <span className="text-foreground">{article.author}</span> ·{" "}
        {articleDate(article.createdAt)} · {readMinutes(article.body)} min read
        {edited && ` · edited ${articleDate(article.updatedAt)}`}
      </div>

      <article className="mt-7 space-y-4 text-[15px] leading-relaxed">
        {paragraphs(article.body).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </article>
    </main>
  );
}
