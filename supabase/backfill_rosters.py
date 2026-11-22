"""
Fill the `rosters` table from ESPN for every season in `seasons`.

The daily sync (update_season.py) keeps the active season current; this is for
past seasons, where ESPN returns each team's final roster. Safe to re-run.

Run from repo root:
  python supabase/backfill_rosters.py
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
for p in (ROOT, Path(__file__).resolve().parent):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

import slimify_fantasy_html as slim  # noqa: E402
from espn_api.football import League  # noqa: E402
from seed import create_supabase_client, sync_rosters  # noqa: E402


def main() -> None:
    client = create_supabase_client()
    years = [r["year"] for r in client.table("seasons").select("year").execute().data]
    for year in sorted(years):
        league = League(
            league_id=slim.LEAGUE_ID, year=year, espn_s2=slim.ESPN_S2, swid=slim.SWID
        )
        rows = slim.build_rosters(league)
        sync_rosters(client, year, rows)
        print(f"{year}: {len(rows)} rostered players")


if __name__ == "__main__":
    main()
