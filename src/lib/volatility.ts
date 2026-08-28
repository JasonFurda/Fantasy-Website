import { baselineFor } from "@/lib/league-config";

// Consistency / volatility metrics for a player's weekly fantasy scoring.
// Pass ONLY the weeks the player actually played (exclude byes / DNPs).
export type Volatility = {
  games: number;
  mean: number;
  sd: number; // standard deviation of weekly points
  variance: number;
  cv: number | null; // sd / mean; null when mean <= 0
  consistency: number | null; // 0-100, higher = steadier; null when mean <= 0
  floor: number | null; // 20th-percentile week (a typical bad week)
  ceiling: number | null; // 80th-percentile week (a typical good week)
  bustPct: number | null; // % of weeks below 0.75 × positional baseline
  boomPct: number | null; // % of weeks above 1.25 × positional baseline
};

// Below this many played weeks the spread stats are too noisy to trust (and a
// tiny flat sample makes scrubs look "perfectly consistent"), so we withhold
// the derived consistency metrics.
const MIN_GAMES = 6;

const EMPTY: Volatility = {
  games: 0,
  mean: 0,
  sd: 0,
  variance: 0,
  cv: null,
  consistency: null,
  floor: null,
  ceiling: null,
  bustPct: null,
  boomPct: null,
};

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function volatility(points: number[], position: string): Volatility {
  const n = points.length;
  if (n === 0) return { ...EMPTY };
  const mean = points.reduce((a, b) => a + b, 0) / n;
  const variance = points.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);
  // Too few games → report the raw mean/sd but withhold the noisy derived stats.
  if (n < MIN_GAMES) {
    return { ...EMPTY, games: n, mean, sd, variance };
  }
  const cv = mean > 0 ? sd / mean : null;
  const consistency =
    cv == null ? null : Math.max(0, Math.min(100, Math.round(100 * (1 - cv))));
  const sorted = [...points].sort((a, b) => a - b);
  const base = baselineFor(position);
  const bust = points.filter((p) => p < base * 0.75).length;
  const boom = points.filter((p) => p > base * 1.25).length;
  return {
    games: n,
    mean,
    sd,
    variance,
    cv,
    consistency,
    floor: percentile(sorted, 0.2),
    ceiling: percentile(sorted, 0.8),
    bustPct: (bust / n) * 100,
    boomPct: (boom / n) * 100,
  };
}
