---
name: fantasy-website-architecture
description: High-level architecture of the redesigned Chamoms fantasy football website
metadata:
  type: project
---

Redesign (started 2026-06-02) of Jason's fantasy football website. Football only — no other sports.

Stack:
- **Frontend**: Next.js 16 + TypeScript + Tailwind, App Router, at repo root. Reads live from Supabase via `@supabase/supabase-js` using the publishable (anon) key. Client at `src/lib/supabase.ts`.
- **Database**: Supabase (Postgres) — source of truth. See [[supabase-project]].
- **Data sync**: Python in `supabase/`, scheduled via GitHub Actions. See [[data-sync-pipeline]].
- **Hosting**: Vercel, auto-deploys on push to `main`. Repo: github.com/JasonFurda/Fantasy-Website. Live at https://fantasy-website-jade.vercel.app (Vercel project "fantasy-website", root dir ./, Hobby team). Confirmed working end-to-end 2026-06-02.
- **Old site**: archived under `archive/` (static HTML/CSS/JS generated from JSON).

Custom domain `www.duckfucks.com` (CNAME file is a GitHub Pages leftover; needs re-pointing in Vercel Domains).

Page build order: standings (done as stub) → matchups → team pages → player comparisons → year stats.
