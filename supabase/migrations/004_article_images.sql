-- Inline images for league articles. The submit form downscales each image to
-- a JPEG and the server action uploads it here under a generated name; the
-- article body references it with an `[[image:<file>]]` marker line.
--
-- Public bucket: files are served from /storage/v1/object/public/ without a
-- SELECT policy. No storage.objects policies on purpose — uploads happen only
-- via the service role (the Next.js server action), which bypasses RLS. The
-- size/type limits are a second line behind the action's own checks.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('article-images', 'article-images', true, 1500000, array['image/jpeg'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
