"use server";

import { revalidatePath } from "next/cache";
import { createArticle, uploadArticleImageFile } from "@/lib/articles";
import {
  TITLE_MAX,
  AUTHOR_MAX,
  BODY_MAX,
  IMAGES_MAX,
  IMAGE_MAX_BYTES,
  imageCount,
} from "@/lib/article-format";

export type ImageUploadState =
  | { ok: true; file: string }
  | { ok: false; message: string };

/** Store one inline image for an article being written and return its file
 *  name, which the form drops into the body as an image marker. As open as
 *  submitArticle, so the bytes are checked here: the form always sends a
 *  downscaled JPEG, and anything that isn't one is refused. */
export async function uploadArticleImage(
  formData: FormData,
): Promise<ImageUploadState> {
  const image = formData.get("image");
  if (!(image instanceof File) || image.size === 0)
    return { ok: false, message: "No image received." };
  if (image.size > IMAGE_MAX_BYTES)
    return { ok: false, message: "That image is too large." };

  const bytes = new Uint8Array(await image.arrayBuffer());
  // JPEG magic number — don't trust the declared content type.
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff)
    return { ok: false, message: "That file isn't a usable image." };

  try {
    return { ok: true, file: await uploadArticleImageFile(bytes) };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? `Upload failed: ${e.message}` : "Upload failed.",
    };
  }
}

export type ArticleSubmitState = {
  ok: boolean;
  message: string;
  slug?: string;
};

/** Publish a submitted article. Open by design (see /articlessubmit): this
 *  action is reachable by anyone, so every field is validated and length-capped
 *  here rather than trusting the form. */
export async function submitArticle(
  _prev: ArticleSubmitState,
  formData: FormData,
): Promise<ArticleSubmitState> {
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

  if (imageCount(body) > IMAGES_MAX)
    return { ok: false, message: `Too many images (max ${IMAGES_MAX}).` };

  try {
    const slug = await createArticle({ title, author, body });
    // /articles and the homepage feed are statically cached, so push the new
    // post out now instead of waiting for the ISR window to lapse.
    revalidatePath("/articles");
    revalidatePath(`/articles/${slug}`);
    revalidatePath("/");
    return { ok: true, message: "Published.", slug };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? `Publish failed: ${e.message}` : "Publish failed.",
    };
  }
}
