-- League trades, one row per player moved. Filled by the daily sync
-- (update_season.py) from ESPN's league activity feed, which only serves the
-- current season — earlier seasons have no rows.
--
-- `trade_id` is ESPN's activity topic id, shared by every player in one trade.
-- Teams are franchise espn_ids (teams.espn_id), not teams.id.
create table if not exists public.trade_players (
  id bigint generated always as identity primary key,
  year integer not null,
  trade_id text not null,
  traded_at timestamptz not null,
  player_id integer not null,
  player_name text not null,
  position text,
  pro_team text,
  from_espn_id integer not null,
  to_espn_id integer not null,
  unique (trade_id, player_id)
);

create index if not exists trade_players_year_idx
  on public.trade_players (year, traded_at desc);

alter table public.trade_players enable row level security;

-- Public read (anon key). No write policies: only the service role (the sync)
-- writes, and it bypasses RLS.
drop policy if exists "trade_players_public_read" on public.trade_players;
create policy "trade_players_public_read"
  on public.trade_players for select
  using (true);
