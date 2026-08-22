"""
One-off: rebuild `player_season` for completed seasons after fixing the
name/id resolution in build_player_season (players like Lamar Jackson were
dropped because two NFL players share a name). Resolves by box-score playerId
now, so those players get a full-season row.

Only touches player_season (not player_slots / free_agent_week).

Run from repo root (needs ESPN creds + Supabase service key in .env):
  python supabase/backfill_player_season.py
"""

from __future__ import annotations

import sys
from pathlib import Path

YEARS = [2024, 2025]
MAX_WEEK = 16


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    supa = Path(__file__).resolve().parent
    for p in (root, supa):
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))

    import slimify_fantasy_html as slim
    from seed import create_supabase_client, sync_player_season
    from espn_api.football import League

    if not slim.ESPN_S2 or not slim.SWID:
        raise SystemExit("Set ESPN_S2 and ESPN_SWID in .env first.")

    client = create_supabase_client()

    for year in YEARS:
        print(f"Rebuilding player_season for {year}…")
        league = League(
            league_id=slim.LEAGUE_ID,
            year=year,
            espn_s2=slim.ESPN_S2,
            swid=slim.SWID,
        )
        all_weeks: dict[int, list] = {}
        for week in range(1, MAX_WEEK + 1):
            try:
                box = league.box_scores(week=week)
                if box:
                    all_weeks[week] = box
            except Exception as e:
                print(f"  Week {week}: skip ({e})")

        payload = slim.build_year_json(league, all_weeks, year)
        ps = slim.build_player_season(league, payload)
        sync_player_season(client, year, ps)
        print(f"  Synced {len(ps)} player_season lines for {year}.")

    print("player_season rebuild complete.")


if __name__ == "__main__":
    main()
