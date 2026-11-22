-- Every fantasy team's roster as ESPN has it, one row per rostered player.
-- This is the source of truth for "which team is this player on": the site
-- used to guess it from weekly lineups (whoever rostered him most), which kept
-- showing dropped players on their old team and traded players on the wrong
-- one. Lineups also miss teams with no game that week (playoff byes, eliminated
-- teams), and this doesn't.
--
-- Refreshed by the daily sync (update_season.py) for the active season. A past
-- season holds ESPN's final roster for that year. A player with no row for a
-- season is a free agent (or was at the end of that season).
-- Teams are franchise espn_ids (teams.espn_id), not teams.id.
create table if not exists public.rosters (
  year integer not null,
  player_id integer not null,
  espn_id integer not null,
  player_name text not null,
  position text,
  pro_team text,
  lineup_slot text,
  acquisition_type text,
  primary key (year, player_id)
);

alter table public.rosters enable row level security;

-- Public read (anon key). No write policies: only the service role (the sync)
-- writes, and it bypasses RLS.
drop policy if exists "rosters_public_read" on public.rosters;
create policy "rosters_public_read"
  on public.rosters for select
  using (true);
