// The weekly window for manual power-ranking submissions.
//
// A window runs Thursday 00:00 -> Wednesday 23:59 in US Eastern time, so it
// "resets Wednesday night". Each window is identified by its Thursday date
// (week_start, YYYY-MM-DD in Eastern). Bucketing by the Eastern *calendar date*
// is DST-safe: we only ever compare which Eastern day it is.

const ZONE = "America/New_York";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export type RankingWeek = {
  /** Thursday that starts the window, YYYY-MM-DD (Eastern). Unique per window. */
  weekStart: string;
  /** Human label for the window, e.g. "Thu Sep 4 – Wed Sep 10". */
  label: string;
  /** Date the current window closes (the Wednesday), e.g. "Wed, Sep 10". */
  closesLabel: string;
};

/** Eastern calendar Y/M/D for an instant. */
function easternYMD(d: Date): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: get("year"), m: get("month"), day: get("day") };
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function niceDate(d: Date): string {
  // d is a UTC-midnight stand-in for an Eastern calendar date.
  return `${DAYS[d.getUTCDay()]} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** The submission window that `now` falls in. */
export function currentRankingWeek(now: Date = new Date()): RankingWeek {
  const { y, m, day } = easternYMD(now);
  // Represent the Eastern calendar date as a UTC-midnight Date for weekday math.
  const today = new Date(Date.UTC(y, m - 1, day));
  const dow = today.getUTCDay(); // 0=Sun .. 6=Sat
  const daysSinceThu = (dow - 4 + 7) % 7; // Thu = 4

  const thu = new Date(today);
  thu.setUTCDate(thu.getUTCDate() - daysSinceThu);
  const wed = new Date(thu);
  wed.setUTCDate(wed.getUTCDate() + 6);

  return {
    weekStart: ymd(thu),
    label: `${niceDate(thu)} – ${niceDate(wed)}`,
    closesLabel: niceDate(wed),
  };
}
