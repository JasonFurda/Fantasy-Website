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
  /** Human label for the window, e.g. "Post Week 1 · Thu Sep 10 – Wed Sep 16". */
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

const DAY_MS = 24 * 60 * 60 * 1000;

/** The Thursday that kicks off fantasy week 1: the Thursday after Labor Day
 *  (the first Monday of September), as a UTC-midnight stand-in. */
function weekOneThursday(year: number): Date {
  const sep1 = new Date(Date.UTC(year, 8, 1));
  const laborDay = 1 + ((1 - sep1.getUTCDay() + 7) % 7); // Mon = 1
  return new Date(Date.UTC(year, 8, laborDay + 3));
}

/** The fantasy week a stored week_start (a Thursday, YYYY-MM-DD Eastern) lines
 *  up with. Each window opens on the Thursday its fantasy week kicks off, so
 *  this is just whole weeks since week 1. Zero or negative means preseason. */
export function fantasyWeekOf(weekStart: string): number {
  const [y, m, d] = weekStart.split("-").map(Number);
  const thu = Date.UTC(y, m - 1, d);
  return Math.round((thu - weekOneThursday(y).getTime()) / (7 * DAY_MS)) + 1;
}

/** Label for a stored week_start by fantasy week. Rankings go in after their
 *  week's games, so they read "Post Week 3". The last one before the season is
 *  "Week 0" and anything earlier is "Preseason". `short` gives "Wk 3" /
 *  "Pre" for chart axes. */
export function fantasyWeekLabel(weekStart: string, short = false): string {
  const week = fantasyWeekOf(weekStart);
  if (week < 0) return short ? "Pre" : "Preseason";
  if (short) return `Wk ${week}`;
  return week === 0 ? "Week 0" : `Post Week ${week}`;
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
    label: `${fantasyWeekLabel(ymd(thu))} · ${niceDate(thu)} – ${niceDate(wed)}`,
    closesLabel: niceDate(wed),
  };
}
