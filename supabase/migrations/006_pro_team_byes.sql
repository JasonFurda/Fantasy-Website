-- NFL bye week per pro team per season. Filled by the daily sync
-- (update_season.py) from ESPN's pro-team schedule. The trade calculator uses
-- it to know which weeks a player can't score in the rest of the season.
create table if not exists public.pro_team_byes (
  year integer not null,
  pro_team text not null,
  bye_week integer not null,
  primary key (year, pro_team)
);

alter table public.pro_team_byes enable row level security;

-- Public read (anon key). Only the service role (the sync) writes.
drop policy if exists "pro_team_byes_public_read" on public.pro_team_byes;
create policy "pro_team_byes_public_read"
  on public.pro_team_byes for select
  using (true);
