import Link from "next/link";
import type { Article } from "@/lib/articles";
import { articleDate, excerpt, readMinutes } from "@/lib/article-format";

function Byline({ a }: { a: Article }) {
  return (
    <div className="mt-0.5 text-[11px] text-muted">
      {a.author} · {articleDate(a.createdAt)} · {readMinutes(a.body)} min
    </div>
  );
}

/** League-written articles.
 *
 *  `variant` picks the shape: "list" stacks them for the homepage's narrow
 *  right-hand column; "grid" spreads them across a full-width row. */
export default function ArticlesCard({
  articles,
  variant = "grid",
  className = "",
}: {
  articles: Article[];
  variant?: "grid" | "list";
  className?: string;
}) {
  return (
    <section
      className={`flex flex-col rounded-2xl border border-border bg-surface p-4 sm:p-5 ${className}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">
          Articles
        </h2>
        {articles.length > 0 && (
          <Link href="/articles" className="text-xs text-accent hover:underline">
            All articles →
          </Link>
        )}
      </div>

      {articles.length === 0 ? (
        // m-auto so the message centres when the card is stretched to fill a
        // homepage column rather than stranding it atop a tall empty box.
        <p className="m-auto max-w-xs text-center text-sm text-muted">
          No articles yet — ask Jason for the writer link and get the first one
          up.
        </p>
      ) : variant === "list" ? (
        <ol className="flex flex-col gap-2">
          {articles.map((a) => (
            <li key={a.id}>
              <Link
                href={`/articles/${a.slug}`}
                className="block rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-accent"
              >
                <h3 className="text-[15px] font-semibold leading-snug tracking-tight">
                  {a.title}
                </h3>
                <Byline a={a} />
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">
                  {excerpt(a.body, 160)}
                </p>
              </Link>
            </li>
          ))}
        </ol>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/articles/${a.slug}`}
              className="flex flex-col rounded-xl border border-border bg-surface-2 px-4 py-3 transition-colors hover:border-accent"
            >
              <h3 className="text-base font-semibold leading-snug tracking-tight">
                {a.title}
              </h3>
              <Byline a={a} />
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted">
                {excerpt(a.body, 160)}
              </p>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
