import "server-only";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  getSeasons,
  getTeams,
  getLatestPowerRankings,
  type Team,
  type PowerRow,
} from "@/lib/queries";
import { weekStartLabel } from "@/lib/ranking-week";

export type RankingSubmission = {
  year: number;
  weekStart: string;
  rankings: number[]; // ordered espn_ids, rank 1 first
  submittedAt: string;
  updatedAt: string;
};

/** The season the friend is ranking: the newest season in the DB. */
export async function getActiveRankingSeason(): Promise<{
  year: number;
  teams: Team[];
} | null> {
  const seasons = await getSeasons(); // newest first
  const year = seasons[0]?.year;
  if (!year) return null;
  const teams = await getTeams(year);
  if (teams.length === 0) return null;
  return { year, teams };
}

function rowToSubmission(r: {
  year: number;
  week_start: string;
  rankings: number[];
  submitted_at: string;
  updated_at: string;
}): RankingSubmission {
  return {
    year: r.year,
    weekStart: r.week_start,
    rankings: r.rankings,
    submittedAt: r.submitted_at,
    updatedAt: r.updated_at,
  };
}

/** The submission for one specific window, or null. */
export async function getSubmissionForWeek(
  year: number,
  weekStart: string,
): Promise<RankingSubmission | null> {
  const { data } = await supabase
    .from("power_ranking_submissions")
    .select("year, week_start, rankings, submitted_at, updated_at")
    .eq("year", year)
    .eq("week_start", weekStart)
    .maybeSingle();
  return data ? rowToSubmission(data) : null;
}

/** The most recent submission for a season (any window), or null. */
export async function getLatestSubmission(
  year: number,
): Promise<RankingSubmission | null> {
  const { data } = await supabase
    .from("power_ranking_submissions")
    .select("year, week_start, rankings, submitted_at, updated_at")
    .eq("year", year)
    .order("week_start", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? rowToSubmission(data) : null;
}

/** Insert or replace the submission for a window (editable until the cutoff). */
export async function saveSubmission(
  year: number,
  weekStart: string,
  orderedEspnIds: number[],
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("power_ranking_submissions")
    .upsert(
      {
        year,
        week_start: weekStart,
        rankings: orderedEspnIds,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "year,week_start" },
    );
  if (error) throw new Error(error.message);
}

/** All submissions for a season, oldest window first. */
export async function getAllSubmissions(
  year: number,
): Promise<RankingSubmission[]> {
  const { data } = await supabase
    .from("power_ranking_submissions")
    .select("year, week_start, rankings, submitted_at, updated_at")
    .eq("year", year)
    .order("week_start", { ascending: true });
  return (
    (data as Parameters<typeof rowToSubmission>[0][] | null) ?? []
  ).map(rowToSubmission);
}

export type ManualRankings = {
  weekStart: string;
  label: string; // e.g. "Aug 27"
  rows: PowerRow[]; // rank 1 first, with change vs the previous submitted week
};

/** The latest submitted week as PowerRow[], with movement vs the prior week.
 *  Null if the season has no submissions. */
export async function getManualPowerRankings(
  year: number,
): Promise<ManualRankings | null> {
  const subs = await getAllSubmissions(year);
  if (subs.length === 0) return null;
  const teams = await getTeams(year);
  const byEspn = new Map(teams.map((t) => [t.espn_id, t]));

  const latest = subs[subs.length - 1];
  const prev = subs.length >= 2 ? subs[subs.length - 2] : null;
  const prevRank = prev
    ? new Map(prev.rankings.map((id, i) => [id, i + 1]))
    : null;

  const rows: PowerRow[] = [];
  latest.rankings.forEach((espnId, i) => {
    const team = byEspn.get(espnId);
    if (!team) return;
    const rank = i + 1;
    const pr = prevRank?.get(espnId);
    rows.push({ rank, team, change: pr == null ? null : pr - rank });
  });

  return { weekStart: latest.weekStart, label: weekStartLabel(latest.weekStart), rows };
}

export type RankingHistory = {
  weeks: { weekStart: string; label: string }[];
  series: { team: Team; ranks: (number | null)[] }[]; // ranks aligned to weeks
};

/** Every team's rank across every submitted week, for the rank-over-time chart. */
export async function getManualRankingHistory(
  year: number,
): Promise<RankingHistory> {
  const subs = await getAllSubmissions(year);
  const teams = await getTeams(year);
  const weeks = subs.map((s) => ({
    weekStart: s.weekStart,
    label: weekStartLabel(s.weekStart),
  }));
  const series = teams
    .map((team) => ({
      team,
      ranks: subs.map((s) => {
        const idx = s.rankings.indexOf(team.espn_id);
        return idx === -1 ? null : idx + 1;
      }),
    }))
    // Only teams that appear in at least one week.
    .filter((s) => s.ranks.some((r) => r != null));
  return { weeks, series };
}

/** Homepage power rankings, preferring the manual weekly ranking when a season
 *  has submissions, else the existing computed/preseason logic. */
export async function getHomepagePowerRankings(): Promise<{
  year: number;
  rows: PowerRow[];
  preseason: boolean;
}> {
  const seasons = await getSeasons(); // newest first
  for (const s of seasons) {
    const weekly = await getManualPowerRankings(s.year);
    if (weekly) return { year: s.year, rows: weekly.rows, preseason: false };
  }
  return getLatestPowerRankings();
}
