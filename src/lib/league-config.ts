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
 * Fixed per-position baseline for a "good" fantasy week. Used to judge weekly
 * boom/bust and to color the weekly chart, so a "bust" means the same thing for
 * every player at a position. Boom = ≥ 1.25× baseline, bust = ≤ 0.75× baseline.
 */
export const POS_FANTASY_BASELINE: Record<string, number> = {
  QB: 20,
  RB: 15,
  WR: 15,
  TE: 12,
  K: 8,
  "D/ST": 8,
};

export function baselineFor(position: string): number {
  return POS_FANTASY_BASELINE[position] ?? 12;
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

/**
 * Manual preseason power rankings (by espn_id, best → worst), shown on the
 * homepage before any games are played that season — the algorithm needs game
 * scores, which don't exist yet. EDIT each preseason; once games are played the
 * computed rankings take over automatically.
 */
export const PRESEASON_POWER_RANKINGS: Record<number, number[]> = {
  // BiJettas, Magic in the Hampton, Threepeat, Strib Club, Immaculate Concepcion,
  // Maltby's Mans, 2 Warrens 1 Love, Sauce, Chathamite, Holier than Thou
  2026: [5, 1, 10, 11, 6, 12, 3, 7, 13, 4],
};

export function preseasonPowerRankings(year: number): number[] {
  return PRESEASON_POWER_RANKINGS[year] ?? [];
}

/**
 * League divisions per year, by espn_id (from ESPN's schedule settings). Used to
 * split standings by division on the homepage. EDIT when divisions change.
 */
export const DIVISIONS_BY_YEAR: Record<
  number,
  { name: string; espnIds: number[] }[]
> = {
  2026: [
    { name: "Chamoms", espnIds: [1, 3, 5, 6, 11] },
    { name: "BBAFA", espnIds: [4, 7, 10, 12, 13] },
  ],
};

export function divisionsFor(
  year: number,
): { name: string; espnIds: number[] }[] {
  return DIVISIONS_BY_YEAR[year] ?? [];
}
