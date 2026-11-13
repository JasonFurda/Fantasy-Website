-- Each team's ESPN trading block: the players its owner has marked "on the
-- block" (available) or "untouchable". Replaced on every daily sync
-- (update_season.py) from the `tradeBlock` field of ESPN's mTeam view, so it
-- is always the current state — ESPN keeps no history or dates for it.
--
-- Only players still on that team's roster are stored: ESPN leaves stale
-- entries behind after a player is dropped or traded.
-- Teams are franchise espn_ids (teams.espn_id), not teams.id.
create table if not exists public.trade_block (
  year integer not null,
  player_id integer not null,
  espn_id integer not null,
  player_name text not null,
  position text,
  pro_team text,
  status text not null check (status in ('ON_THE_BLOCK', 'UNTOUCHABLE')),
  primary key (year, player_id)
);

alter table public.trade_block enable row level security;

-- Public read (anon key). No write policies: only the service role (the sync)
-- writes, and it bypasses RLS.
drop policy if exists "trade_block_public_read" on public.trade_block;
create policy "trade_block_public_read"
  on public.trade_block for select
  using (true);
