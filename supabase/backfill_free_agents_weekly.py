"""
One-off backfill: populate `free_agent_week` (per-week free-agent fantasy
points) for the completed seasons, so the league-wide "best possible roster"
can pull from the waiver wire.

Reads rostered names from the existing data-{year}.json (so it does NOT touch
player_slots) and pulls weekly free-agent lines from ESPN. Going forward this is
handled automatically by backfill_positions.py / update_season.py.

Run from repo root (needs ESPN creds + Supabase service key in .env):
  python supabase/backfill_free_agents_weekly.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

YEARS = [2024, 2025]
MAX_WEEK = 16  # both seasons ended at week 16


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    supa = Path(__file__).resolve().parent
    for p in (root, supa):
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))

    import slimify_fantasy_html as slim
    from seed import create_supabase_client, sync_free_agent_weeks
    from espn_api.football import League

    if not slim.ESPN_S2 or not slim.SWID:
        raise SystemExit("Set ESPN_S2 and ESPN_SWID in .env first.")

    client = create_supabase_client()

    for year in YEARS:
        print(f"Free-agent weeks for {year}…")
        with open(root / f"data-{year}.json", encoding="utf-8") as f:
            payload = json.load(f)

        league = League(
            league_id=slim.LEAGUE_ID,
            year=year,
            espn_s2=slim.ESPN_S2,
            swid=slim.SWID,
        )

        faw = slim.build_free_agent_weeks(league, payload, max_week=MAX_WEEK)
        sync_free_agent_weeks(client, year, faw)
        print(f"  Synced {len(faw)} free-agent week lines for {year}.")

    print("Free-agent week backfill complete.")


if __name__ == "__main__":
    main()
