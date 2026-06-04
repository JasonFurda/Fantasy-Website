/**
 * League structure config. EDIT per year as the league changes.
 *
 * Records/standings across the site count REGULAR-SEASON games only; playoff
 * weeks are omitted. A week is a playoff week if it's >= the season's
 * playoff start week.
 */
export const PLAYOFF_START_WEEK: Record<number, number> = {
  2024: 15, // weeks 1-14 regular season, 15-16 playoffs
  2025: 15,
};

export const DEFAULT_PLAYOFF_START_WEEK = 15;

export function playoffStartWeek(year: number): number {
  return PLAYOFF_START_WEEK[year] ?? DEFAULT_PLAYOFF_START_WEEK;
}

export function isPlayoffWeek(year: number, week: number): boolean {
  return week >= playoffStartWeek(year);
}
