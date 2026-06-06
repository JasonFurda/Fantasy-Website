"""
One-off backfill: re-pull each completed season from ESPN so player rows get
their `position` / `eligibleSlots`, rewrite data-{year}.json, and re-sync to
Supabase. Run once after adding the position columns.

Run from repo root (needs ESPN creds + Supabase service key in .env):
  python supabase/backfill_positions.py
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

YEARS = [2024, 2025]
# Both seasons ended at week 16; ESPN echoes the last week when over-requested,
# so cap here to avoid duplicate phantom weeks.
MAX_WEEK = 16


def main() -> None:
    root = Path(__file__).resolve().parent.parent
    supa = Path(__file__).resolve().parent
    for p in (root, supa):
        if str(p) not in sys.path:
            sys.path.insert(0, str(p))

    import slimify_fantasy_html as slim
    from seed import create_supabase_client, sync_year_payload, sync_player_season
    from espn_api.football import League

    if not slim.ESPN_S2 or not slim.SWID:
        raise SystemExit("Set ESPN_S2 and ESPN_SWID in .env first.")

    client = create_supabase_client()

    for year in YEARS:
        print(f"Backfilling {year}…")
        league = League(
            league_id=slim.LEAGUE_ID,
            year=year,
            espn_s2=slim.ESPN_S2,
            swid=slim.SWID,
        )

        all_weeks: dict[int, list] = {}
        last_week = 0
        for week in range(1, MAX_WEEK + 1):
            try:
                box = league.box_scores(week=week)
                if box:
                    all_weeks[week] = box
                    last_week = week
                    print(f"  Week {week}: OK ({len(box)} matchups)")
            except Exception as e:
                print(f"  Week {week}: skip ({e})")

        payload = slim.build_year_json(league, all_weeks, year)
        with open(root / f"data-{year}.json", "w", encoding="utf-8") as f:
            json.dump(payload, f)
        print(f"  Wrote data-{year}.json")

        sync_year_payload(client, payload)

        ps = slim.build_player_season(league, payload)
        sync_player_season(client, year, ps)
        print(f"  Player season lines: {len(ps)}")

        now = datetime.now(timezone.utc).isoformat()
        client.table("seasons").update(
            {"current_week": last_week, "updated_at": now}
        ).eq("year", year).execute()
        print(f"  Synced {year} (through week {last_week}).")

    print("Backfill complete.")


if __name__ == "__main__":
    main()
