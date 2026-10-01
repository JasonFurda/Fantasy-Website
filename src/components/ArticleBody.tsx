import { articleBlocks, imageUrl } from "@/lib/article-format";

/** An article body: plain-text paragraphs plus inline images. Shared by the
 *  article page and the submit form's preview so the two can't drift. */
export default function ArticleBody({
  body,
  className,
  empty,
}: {
  body: string;
  className?: string;
  empty?: React.ReactNode;
}) {
  const blocks = articleBlocks(body);

  return (
    <div className={className}>
      {blocks.length === 0
        ? empty
        : blocks.map((b, i) =>
            b.type === "image" ? (
              // Plain <img> straight from Supabase storage: next/image would
              // spend Vercel image-optimization quota on already-downscaled
              // uploads.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={imageUrl(b.file)}
                alt=""
                loading="lazy"
                className="mx-auto max-h-[80vh] max-w-full rounded-lg"
              />
            ) : (
              <p key={i} className="whitespace-pre-line">
                {b.text}
              </p>
            ),
          )}
    </div>
  );
}
