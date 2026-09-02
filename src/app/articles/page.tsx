import Link from "next/link";
import type { Metadata } from "next";
import { getArticles } from "@/lib/articles";
import { articleDate, excerpt, readMinutes } from "@/lib/article-format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Articles · Chamoms Fantasy",
  description: "Articles written by the league.",
};

export default async function ArticlesPage() {
  const articles = await getArticles();

  return (
    <main className="mx-auto max-w-3xl px-5 py-10">
      <h1 className="mb-8 text-2xl font-bold tracking-tight">Articles</h1>

      {articles.length === 0 ? (
        <p className="rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          Nothing published yet. Ask Jason for the writer link and be the first.
        </p>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/articles/${a.slug}`}
              className="block rounded-xl border border-border bg-surface px-5 py-4 transition-colors hover:border-accent hover:bg-surface-2"
            >
              <h2 className="text-lg font-semibold tracking-tight">
                {a.title}
              </h2>
              <div className="mt-0.5 text-xs text-muted">
                {a.author} · {articleDate(a.createdAt)} ·{" "}
                {readMinutes(a.body)} min read
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {excerpt(a.body)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
