import "server-only";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { getSeasons, getTeams, type Team } from "@/lib/queries";

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
