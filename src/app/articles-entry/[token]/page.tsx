import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isValidArticleToken } from "@/lib/articles-auth";
import { getArticles } from "@/lib/articles";
import ArticleSubmitForm from "@/components/ArticleSubmitForm";

export const dynamic = "force-dynamic";

// Keep the submission tool out of search engines even if the URL leaks.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Write an Article",
};

export default async function ArticlesEntryPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isValidArticleToken(token)) notFound();

  const recent = await getArticles(5);

  return (
    <main className="mx-auto max-w-2xl px-5 py-10">
      <h1 className="text-2xl font-bold tracking-tight">Write an article</h1>
      <p className="mt-1 mb-6 text-sm text-muted">
        Anyone with this link can publish to the league site. Hot takes,
        recaps, trade rants — it all goes on the homepage.
      </p>

      <ArticleSubmitForm token={token} />

      {recent.length > 0 && (
        <section className="mt-10 border-t border-border pt-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">
            Recently published
          </h2>
          <ul className="space-y-1.5 text-sm">
            {recent.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/articles/${a.slug}`}
                  className="flex items-baseline justify-between gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-surface-2"
                >
                  <span className="min-w-0 truncate font-medium">
                    {a.title}
                  </span>
                  <span className="shrink-0 text-xs text-muted">
                    {a.author}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
