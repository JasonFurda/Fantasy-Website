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

/**
 * Actual playoff champions per year, keyed by ESPN franchise id (espn_id).
 * EDIT this each season once the title is decided — it's not derivable from
 * the data (regular-season #1 ≠ champion).
 */
export const CHAMPIONS_BY_YEAR: Record<number, number> = {
  2024: 10, // fflubb
  2025: 10, // fflubb
};

export function isChampion(espnId: number, year: number): boolean {
  return CHAMPIONS_BY_YEAR[year] === espnId;
}

export function championshipsFor(espnId: number): number {
  return Object.values(CHAMPIONS_BY_YEAR).filter((id) => id === espnId).length;
}

/**
 * Final placement per year (playoff results), keyed by year → espn_id → finish.
 * These are the real end-of-year standings, derived from the playoff bracket
 * (weeks 15-16: top-4 championship bracket, seeds 5-8 consolation bracket).
 * EDIT/add each season once the playoffs finish. When a year is absent (e.g. a
 * season still in progress), the site falls back to regular-season rank.
 */
export const FINAL_PLACEMENT_BY_YEAR: Record<number, Record<number, number>> = {
  2024: { 10: 1, 3: 2, 7: 3, 11: 4, 5: 5, 6: 6, 4: 7, 1: 8 },
  2025: { 10: 1, 4: 2, 1: 3, 6: 4, 5: 5, 7: 6, 11: 7, 3: 8 },
};

export function finalPlacement(espnId: number, year: number): number | null {
  return FINAL_PLACEMENT_BY_YEAR[year]?.[espnId] ?? null;
}
