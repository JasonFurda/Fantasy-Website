"""
Load static JSON exports into Supabase.

Expects `data-2024.json` and `data-2025.json` at the project root (parent of `supabase/`).

Prerequisites:
  pip install -r requirements.txt

Run from repo root:
  python supabase/seed.py

Apply this SQL in the Supabase SQL editor before first run:

  create table if not exists public.seasons (
    year int primary key,
    current_week int not null default 1,
    is_active boolean not null default false,
    updated_at timestamptz not null default now()
  );

  create table if not exists public.teams (
    id uuid primary key default gen_random_uuid(),
    espn_id int not null,
    year int not null references public.seasons(year) on delete cascade,
    name text not null,
    owner text not null,
    unique (espn_id, year)
  );

  create table if not exists public.matchups (
    id uuid primary key default gen_random_uuid(),
    year int not null references public.seasons(year) on delete cascade,
    week int not null,
    away_team_id uuid not null references public.teams(id) on delete cascade,
    home_team_id uuid not null references public.teams(id) on delete cascade,
    away_score numeric not null,
    home_score numeric not null,
    away_projected numeric not null,
    home_projected numeric not null,
    unique (year, week, away_team_id, home_team_id)
  );

  create index if not exists matchups_season_week_idx on public.matchups (year, week);

  create table if not exists public.player_slots (
    id bigserial primary key,
    matchup_id uuid not null references public.matchups(id) on delete cascade,
    team_side text not null check (team_side in ('away', 'home')),
    sort_idx int not null,
    slot text not null,
    player_name text not null,
    pro_team text not null default '',
    opponent text not null default '',
    points numeric not null,
    projected numeric not null,
    game_played int not null default 0,
    is_bye boolean not null default false,
    injury_status text not null default '',
    is_injured boolean not null default false,
    is_bench boolean not null default false
  );

  create index if not exists player_slots_matchup_idx on public.player_slots (matchup_id);
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from supabase import Client, create_client


def _project_root() -> Path:
    return Path(__file__).resolve().parent.parent


def load_env() -> None:
    load_dotenv(_project_root() / ".env")


def create_supabase_client() -> Client:
    load_env()
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    return create_client(url, key)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _collect_teams_from_weeks(weeks: dict[str, Any]) -> dict[int, dict[str, str]]:
    """espn_id -> {name, owner} (last write wins if duplicates disagree)."""
    teams: dict[int, dict[str, str]] = {}
    for games in weeks.values():
        if not isinstance(games, list):
            continue
        for m in games:
            for side in ("away", "home"):
                t = m.get(side) or {}
                tid = int(t.get("id", 0))
                if tid == 0:
                    continue
                teams[tid] = {"name": str(t.get("name", "Unknown")), "owner": str(t.get("owner", "Unknown"))}
    return teams


def _player_slot_rows(
    matchup_id: str,
    team_side: str,
    lineup: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for sort_idx, p in enumerate(lineup):
        rows.append(
            {
                "matchup_id": matchup_id,
                "team_side": team_side,
                "sort_idx": sort_idx,
                "slot": str(p.get("slot", "")),
                "position": str(p.get("position", "")),
                "eligible_slots": p.get("eligibleSlots") or [],
                "stats": p.get("stats") or {},
                "player_name": str(p.get("name", "Unknown")),
                "pro_team": str(p.get("proTeam", "")),
                "opponent": str(p.get("opp", "")),
                "points": float(p.get("points", 0) or 0),
                "projected": float(p.get("proj", 0) or 0),
                "game_played": int(p.get("gamePlayed", 0) or 0),
                "is_bye": bool(p.get("bye", False)),
                "injury_status": str(p.get("injuryStatus", "")),
                "is_injured": bool(p.get("injured", False)),
                "is_bench": bool(p.get("bench", False)),
            }
        )
    return rows


def sync_year_payload(client: Client, payload: dict[str, Any]) -> None:
    """
    Idempotent sync for one season JSON object:
    seasons -> teams (upsert on espn_id + year) -> matchups
    -> delete player_slots for each matchup -> insert fresh slots.
    """
    year = int(payload["year"])
    current_week = int(payload["current_week"])
    weeks_raw = payload.get("weeks") or {}
    # Normalize week keys to strings like exported JSON
    weeks: dict[str, Any] = {str(k): v for k, v in weeks_raw.items()}

    now = _now_iso()
    client.table("seasons").upsert(
        {"year": year, "current_week": current_week, "updated_at": now},
        on_conflict="year",
    ).execute()

    teams_meta = _collect_teams_from_weeks(weeks)
    if teams_meta:
        team_rows = [
            {"espn_id": eid, "year": year, "name": meta["name"], "owner": meta["owner"]}
            for eid, meta in sorted(teams_meta.items())
        ]
        client.table("teams").upsert(team_rows, on_conflict="espn_id,year").execute()

    team_map_res = client.table("teams").select("id, espn_id").eq("year", year).execute()
    id_by_espn: dict[int, str] = {int(r["espn_id"]): r["id"] for r in (team_map_res.data or [])}

    matchup_rows: list[dict[str, Any]] = []
    ordered_matchups: list[tuple[int, dict[str, Any]]] = []
    for wk_str in sorted(weeks.keys(), key=lambda x: int(x)):
        wk = int(wk_str)
        games = weeks.get(wk_str) or []
        if not isinstance(games, list):
            continue
        for m in games:
            away = m.get("away") or {}
            home = m.get("home") or {}
            aid = int(away.get("id", 0))
            hid = int(home.get("id", 0))
            if aid == 0 or hid == 0:
                continue
            if aid not in id_by_espn or hid not in id_by_espn:
                continue
            matchup_rows.append(
                {
                    "year": year,
                    "week": wk,
                    "away_team_id": id_by_espn[aid],
                    "home_team_id": id_by_espn[hid],
                    "away_score": float(away.get("score", 0) or 0),
                    "home_score": float(home.get("score", 0) or 0),
                    "away_projected": float(away.get("projected", 0) or 0),
                    "home_projected": float(home.get("projected", 0) or 0),
                }
            )
            ordered_matchups.append((wk, m))

    if matchup_rows:
        client.table("matchups").upsert(
            matchup_rows,
            on_conflict="year,week,away_team_id,home_team_id",
        ).execute()

    mid_res = (
        client.table("matchups")
        .select("id, week, away_team_id, home_team_id")
        .eq("year", year)
        .execute()
    )
    matchup_key_to_id: dict[tuple[int, str, str], str] = {}
    for r in mid_res.data or []:
        matchup_key_to_id[(int(r["week"]), r["away_team_id"], r["home_team_id"])] = r["id"]

    for (wk, m) in ordered_matchups:
        away = m.get("away") or {}
        home = m.get("home") or {}
        aid = id_by_espn.get(int(away.get("id", 0)))
        hid = id_by_espn.get(int(home.get("id", 0)))
        if not aid or not hid:
            continue
        mid = matchup_key_to_id.get((wk, aid, hid))
        if not mid:
            continue
        client.table("player_slots").delete().eq("matchup_id", mid).execute()
        slot_rows: list[dict[str, Any]] = []
        slot_rows.extend(_player_slot_rows(mid, team_side="away", lineup=away.get("lineup") or []))
        slot_rows.extend(_player_slot_rows(mid, team_side="home", lineup=home.get("lineup") or []))
        if slot_rows:
            client.table("player_slots").insert(slot_rows).execute()


def _read_year_json(root: Path, year: int) -> dict[str, Any]:
    path = root / f"data-{year}.json"
    if not path.is_file():
        raise FileNotFoundError(f"Missing {path.name} at project root")
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def main() -> None:
    root = _project_root()
    client = create_supabase_client()
    for year in (2024, 2025):
        print(f"Seeding {year}…")
        payload = _read_year_json(root, year)
        sync_year_payload(client, payload)
        print(f"Done {year}.")
    print("Seed complete.")


if __name__ == "__main__":
    main()
