---
name: supabase-project
description: Supabase project ref, keys, schema, and RLS setup for the fantasy website
metadata:
  type: reference
---

Supabase project for the fantasy website ([[fantasy-website-architecture]]).

- **Project ref / id**: `ixxltpuzpwsdwqhupaor` (name "Chamoms Fantasy Website", region us-west-2)
- **URL**: https://ixxltpuzpwsdwqhupaor.supabase.co
- **Publishable (anon) key**: `sb_publishable_-ecI4qXWNBPkKiKG3o1uEA_-Qa4r_J2` (safe for browser; in `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`)
- **Service key**: in root `.env` as `SUPABASE_SERVICE_KEY` (Python sync only; bypasses RLS)

Schema (public): `seasons` (year PK, current_week, is_active) → `teams` (id, espn_id, year, name, owner) → `matchups` (id, year, week, home/away_team_id, scores, projected) → `player_slots` (id, matchup_id, team_side, slot, player_name, points, etc.).
NOTE: live schema uses **integer** ids (sequences), not the UUIDs described in seed.py's docstring.

RLS: enabled on all tables; public `SELECT` policies added (migration `public_read_policies`) so the anon key can read. Writes only via service role.

Seeded 2026-06-02 from data-2024.json / data-2025.json: 2 seasons, 16 teams, 128 matchups, 4223 player_slots. Both seasons current_week=16, is_active=false.
