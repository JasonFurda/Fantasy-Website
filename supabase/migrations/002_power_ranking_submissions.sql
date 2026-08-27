-- Manual weekly power rankings submitted by hand through the private
-- /rankings-entry/<secret> interface. One row per (season year, weekly window).
-- The window is the Eastern-time Thursday 00:00 -> Wednesday 23:59 period; the
-- Thursday date is stored as week_start. rankings is an ordered array of team
-- espn_ids, best (rank 1) first.
create table if not exists public.power_ranking_submissions (
  id bigint generated always as identity primary key,
  year integer not null,
  week_start date not null,
  rankings jsonb not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (year, week_start)
);

alter table public.power_ranking_submissions enable row level security;

-- Public read (anon key) so the site can render the log + line chart later.
drop policy if exists "power_ranking_submissions_public_read" on public.power_ranking_submissions;
create policy "power_ranking_submissions_public_read"
  on public.power_ranking_submissions for select
  using (true);

-- No insert/update/delete policies on purpose: writes happen only via the
-- service role (the Next.js server action), which bypasses RLS.
