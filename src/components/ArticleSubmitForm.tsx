"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import ArticleBody from "@/components/ArticleBody";
import {
  TITLE_MAX,
  AUTHOR_MAX,
  BODY_MAX,
  IMAGES_MAX,
  IMAGE_MAX_BYTES,
  imageCount,
  imageMarker,
} from "@/lib/article-format";
import {
  submitArticle,
  uploadArticleImage,
  type ArticleSubmitState,
} from "@/app/articlessubmit/actions";

const INITIAL: ArticleSubmitState = { ok: false, message: "" };

const inputCls =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus:border-accent";

const IMAGE_MAX_EDGE = 1600;

/** Shrink a picked image to a JPEG that fits the upload cap. Phone photos are
 *  several MB — far past what a server action accepts — so this runs in the
 *  browser before anything is sent. */
async function downscaleToJpeg(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(
    1,
    IMAGE_MAX_EDGE / Math.max(bitmap.width, bitmap.height),
  );
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("no canvas");
  // JPEG has no alpha: put transparent PNGs on white rather than black.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.5]) {
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (blob && blob.size <= IMAGE_MAX_BYTES) return blob;
  }
  throw new Error("too large");
}

export default function ArticleSubmitForm() {
  const [state, formAction, pending] = useActionState(submitArticle, INITIAL);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [body, setBody] = useState("");
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imageError, setImageError] = useState("");
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  // Which published slug the writer has already dismissed via "Write another".
  // useActionState has no reset, so this is what takes the success panel back
  // to an empty form — and it re-arms itself when the next publish returns a
  // different slug.
  const [dismissed, setDismissed] = useState<string | null>(null);

  const atImageLimit = imageCount(body) >= IMAGES_MAX;

  const startAnother = () => {
    setDismissed(state.slug ?? null);
    setTitle("");
    setAuthor("");
    setBody("");
    setPreview(false);
    setImageError("");
  };

  /** Upload the picked image, then drop its marker into the body on a line of
   *  its own where the cursor was. */
  const addImage = async (picked: File) => {
    // Read the cursor before awaiting; the textarea keeps its selection while
    // the file dialog is open.
    const at = bodyRef.current?.selectionStart ?? body.length;
    setImageError("");
    setUploading(true);
    try {
      let jpeg: Blob;
      try {
        jpeg = await downscaleToJpeg(picked);
      } catch {
        setImageError("Couldn't read that image — try a JPEG or PNG.");
        return;
      }
      const data = new FormData();
      data.set("image", new File([jpeg], "image.jpg", { type: "image/jpeg" }));
      const result = await uploadArticleImage(data);
      if (!result.ok) {
        setImageError(result.message);
        return;
      }
      setBody((b) => {
        const pos = Math.min(at, b.length);
        const before = b.slice(0, pos).replace(/\s+$/, "");
        const after = b.slice(pos).replace(/^\s+/, "");
        return [before, imageMarker(result.file), after]
          .filter(Boolean)
          .join("\n\n")
          .concat(after ? "" : "\n\n");
      });
    } catch {
      setImageError("Upload failed — check your connection and try again.");
    } finally {
      setUploading(false);
    }
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
            {!preview && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || atImageLimit}
                title={
                  atImageLimit ? `Max ${IMAGES_MAX} images per article` : undefined
                }
                className="text-accent hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
              >
                {uploading ? "Uploading…" : "Add image"}
              </button>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const picked = e.target.files?.[0];
                // Clear it so picking the same file again still fires.
                e.target.value = "";
                if (picked) addImage(picked);
              }}
            />
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
            <ArticleBody
              body={body}
              className="mt-4 space-y-3.5 text-[15px] leading-relaxed"
              empty={<p className="text-muted">Nothing written yet.</p>}
            />
          </div>
        ) : (
          <textarea
            ref={bodyRef}
            id="article-body"
            name="body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={16}
            className={`${inputCls} min-h-[18rem] resize-y leading-relaxed`}
          />
        )}
        {preview && (
          // Keep the value in the submitted form data while previewing.
          <input type="hidden" name="body" value={body} />
        )}
        {imageError && (
          <p className="mt-1.5 text-sm text-red-500">{imageError}</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending || uploading}
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
        text. &ldquo;Add image&rdquo; puts a picture where your cursor is — it
        shows up as an <code>[[image:…]]</code> line you can move or delete.
      </p>
    </form>
  );
}
