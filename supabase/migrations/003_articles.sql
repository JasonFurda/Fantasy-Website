-- League articles written by members and submitted by hand through the private
-- /articles-entry/<secret> interface (same shape of gate as the power-rankings
-- tool). One row per article.
--
-- `body` is plain text: blank lines separate paragraphs. It is rendered as text
-- (never as HTML) so a submission can't inject markup.
create table if not exists public.articles (
  id bigint generated always as identity primary key,
  slug text not null unique,
  title text not null,
  author text not null,
  body text not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The list pages read newest-first among published rows.
create index if not exists articles_published_created_idx
  on public.articles (published, created_at desc);

alter table public.articles enable row level security;

-- Public read of published articles only (anon key). Unpublishing a row hides
-- it from the site without deleting it.
drop policy if exists "articles_public_read" on public.articles;
create policy "articles_public_read"
  on public.articles for select
  using (published);

-- No insert/update/delete policies on purpose: writes happen only via the
-- service role (the Next.js server action), which bypasses RLS.
