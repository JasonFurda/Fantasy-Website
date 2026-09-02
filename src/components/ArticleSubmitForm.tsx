"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import {
  paragraphs,
  TITLE_MAX,
  AUTHOR_MAX,
  BODY_MAX,
} from "@/lib/article-format";
import {
  submitArticle,
  type ArticleSubmitState,
} from "@/app/articlessubmit/actions";

const INITIAL: ArticleSubmitState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

export default function ArticleSubmitForm() {
  const [state, formAction, pending] = useActionState(submitArticle, INITIAL);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  // Which published slug the writer has already dismissed via "Write another".
  // useActionState has no reset, so this is what takes the success panel back
  // to an empty form — and it re-arms itself when the next publish returns a
  // different slug.
  const [dismissed, setDismissed] = useState<string | null>(null);

  const paras = paragraphs(body);

  const startAnother = () => {
    setDismissed(state.slug ?? null);
    setTitle("");
    setAuthor("");
    setBody("");
    setPreview(false);
  };

  // After a successful publish, show the link instead of the form — the action
  // creates a new article every time, so leaving the form filled invites dupes.
  if (state.ok && state.slug && state.slug !== dismissed) {
    return (
      <div className="rounded-xl border border-accent/40 bg-accent/10 px-5 py-6">
        <h2 className="text-lg font-semibold text-accent">
          Your article is live.
        </h2>
        <p className="mt-1 text-sm text-muted">
          It&apos;s on the homepage and in the articles list now.
        </p>
        <div className="mt-4 flex flex-wrap gap-2 text-sm">
          <Link
            href={`/articles/${state.slug}`}
            className="rounded-lg bg-accent px-4 py-2 font-semibold text-background transition-opacity hover:opacity-90"
          >
            Read it →
          </Link>
          <button
            type="button"
            onClick={startAnother}
            className="rounded-lg border border-border px-4 py-2 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Write another
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label
          htmlFor="article-title"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Title
        </label>
        <input
          id="article-title"
          name="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={TITLE_MAX}
          required
          placeholder="Week 3 was a war crime"
          className={inputCls}
        />
      </div>

      <div>
        <label
          htmlFor="article-author"
          className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted"
        >
          Your name
        </label>
        <input
          id="article-author"
          name="author"
          value={author}
          onChange={(e) => setAuthor(e.target.value)}
          maxLength={AUTHOR_MAX}
          required
          placeholder="Who's writing this?"
          className={`${inputCls} sm:max-w-xs`}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-3">
          <label
            htmlFor="article-body"
            className="block text-xs font-semibold uppercase tracking-wide text-muted"
          >
            Article
          </label>
          <div className="flex items-center gap-3 text-xs">
            <span
              className={`tabular-nums ${
                body.length > BODY_MAX ? "text-red-400" : "text-muted"
              }`}
            >
              {body.length.toLocaleString()} / {BODY_MAX.toLocaleString()}
            </span>
            <button
              type="button"
              onClick={() => setPreview((p) => !p)}
              className="text-accent hover:underline"
            >
              {preview ? "Keep writing" : "Preview"}
            </button>
          </div>
        </div>

        {preview ? (
          <div className="min-h-[18rem] rounded-lg border border-border bg-surface px-4 py-4">
            <h3 className="text-xl font-bold tracking-tight">
              {title.trim() || "Untitled"}
            </h3>
            <p className="mt-0.5 text-sm text-muted">
              {author.trim() || "Anonymous"}
            </p>
            <div className="mt-4 space-y-3.5 text-[15px] leading-relaxed">
              {paras.length > 0 ? (
                paras.map((p, i) => (
                  <p key={i} className="whitespace-pre-line">
                    {p}
                  </p>
                ))
              ) : (
                <p className="text-muted">Nothing written yet.</p>
              )}
            </div>
          </div>
        ) : (
          <textarea
            id="article-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={16}
            placeholder={
              "Write away.\n\nLeave a blank line between paragraphs."
            }
            className={`${inputCls} min-h-[18rem] resize-y leading-relaxed`}
          />
        )}
        {preview && (
          // Keep the value in the submitted form data while previewing.
          <input type="hidden" name="body" value={body} />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending ? "Publishing…" : "Publish article"}
        </button>
        {state.message && !state.ok && (
          <span className="text-sm text-red-500">{state.message}</span>
        )}
      </div>

      <p className="text-xs text-muted">
        Publishing puts the article on the homepage and the Articles page under
        your name. Blank lines become paragraphs; everything is shown as plain
        text.
      </p>
    </form>
  );
}
