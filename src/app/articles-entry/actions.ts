"use server";

import { isValidArticleToken } from "@/lib/articles-auth";
import { createArticle } from "@/lib/articles";
import { TITLE_MAX, AUTHOR_MAX, BODY_MAX } from "@/lib/article-format";

export type ArticleSubmitState = {
  ok: boolean;
  message: string;
  slug?: string;
};

/** Publish a submitted article. Re-verifies the secret server-side — a direct
 *  POST to this action can't bypass the page's 404. */
export async function submitArticle(
  _prev: ArticleSubmitState,
  formData: FormData,
): Promise<ArticleSubmitState> {
  const token = String(formData.get("token") ?? "");
  if (!isValidArticleToken(token)) {
    return { ok: false, message: "Not authorized." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const author = String(formData.get("author") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();

  if (!title) return { ok: false, message: "Give the article a title." };
  if (!author) return { ok: false, message: "Add your name as the author." };
  if (!body) return { ok: false, message: "The article is empty." };
  if (title.length > TITLE_MAX)
    return { ok: false, message: `Title is too long (max ${TITLE_MAX}).` };
  if (author.length > AUTHOR_MAX)
    return { ok: false, message: `Author name is too long (max ${AUTHOR_MAX}).` };
  if (body.length > BODY_MAX)
    return {
      ok: false,
      message: `That's longer than the ${BODY_MAX.toLocaleString()}-character limit.`,
    };

  try {
    const slug = await createArticle({ title, author, body });
    return { ok: true, message: "Published.", slug };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? `Publish failed: ${e.message}` : "Publish failed.",
    };
  }
}
