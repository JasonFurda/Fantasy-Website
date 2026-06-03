---
name: data-sync-pipeline
description: How the fantasy website Supabase DB gets updated from the ESPN fantasy API
metadata:
  type: project
---

Data sync for [[supabase-project]] / [[fantasy-website-architecture]].

Code lives in `supabase/` (moved there 2026-06-02):
- `seed.py` — one-time load from `data-{year}.json` at repo root. `sync_year_payload()` is the shared upsert path.
- `update_season.py` — refreshes the season with `is_active=true` by pulling live ESPN box scores. Imports `slimify_fantasy_html.build_year_json` + `seed.sync_year_payload`.
- `slimify_fantasy_html.py` — ESPN fetch + `build_year_json`. Loads `.env` from repo root (parent.parent — fixed after the move).
- `espn_api/` — vendored cwendt94/espn-api library (all sports; only football/ used).

Decision: scheduled updates run via **GitHub Actions cron** running the existing Python (NOT a Supabase Edge Function — that would mean rewriting the whole pipeline in TS). Weekly now → daily before 2026 NFL season (flip the cron).

**Why:** reuses tested Python, no rewrite, GitHub-centric.
**How to apply:** workflow needs repo secrets (SUPABASE_URL, SUPABASE_SERVICE_KEY, ESPN_LEAGUE_ID, ESPN_S2, ESPN_SWID). IMPORTANT: `update_season.py` requires exactly ONE season with `is_active=true` — set 2025 active before first sync (and 2026 when it starts).
