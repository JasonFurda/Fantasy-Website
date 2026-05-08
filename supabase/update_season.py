"""
Refresh Supabase for the single season marked `is_active = true`.

Fetches live box scores the same way as `slimify_fantasy_html.py`, builds the same
JSON shape via `build_year_json`, then runs the same upsert path as `seed.py`.

Prerequisites:
  pip install -r requirements.txt

Run from repo root:
  python supabase/update_season.py

Requires ESPN credentials in `.env` (see `.env.example`); `slimify_fantasy_html.py` loads them via python-dotenv.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path


def _ensure_import_paths() -> Path:
    root = Path(__file__).resolve().parent.parent
    supabase_dir = Path(__file__).resolve().parent
    if str(root) not in sys.path:
        sys.path.insert(0, str(root))
    if str(supabase_dir) not in sys.path:
        sys.path.insert(0, str(supabase_dir))
    return root


def main() -> None:
    _ensure_import_paths()

    import slimify_fantasy_html as slim
    from seed import create_supabase_client, sync_year_payload

    if not slim.ESPN_S2 or not slim.SWID:
        raise SystemExit(
            "Set ESPN_S2 and ESPN_SWID in your .env file (see .env.example) before running."
        )

    from espn_api.football import League

    client = create_supabase_client()

    active = (
        client.table("seasons")
        .select("year")
        .eq("is_active", True)
        .limit(2)
        .execute()
    )
    rows = active.data or []
    if len(rows) != 1:
        raise SystemExit(
            f"Expected exactly one row with is_active=true on seasons; got {len(rows)}."
        )

    year = int(rows[0]["year"])
    print(f"Updating active season {year}…")

    league = League(
        league_id=slim.LEAGUE_ID,
        year=year,
        espn_s2=slim.ESPN_S2,
        swid=slim.SWID,
    )

    current_week = int(league.current_week)
    all_weeks_data: dict[int, list] = {}
    for week in range(1, current_week + 1):
        try:
            all_weeks_data[week] = league.box_scores(week=week)
            print(f"  Week {week}: OK ({len(all_weeks_data[week])} matchups)")
        except Exception as e:
            print(f"  Week {week}: error {e}")

    payload = slim.build_year_json(league, all_weeks_data, year)
    sync_year_payload(client, payload)

    now = datetime.now(timezone.utc).isoformat()
    client.table("seasons").update({"current_week": current_week, "updated_at": now}).eq(
        "year", year
    ).execute()

    print(f"Season {year} synced (current_week={current_week}).")


if __name__ == "__main__":
    main()
