/**
 * Per-franchise styling — EDIT THIS FILE to set each team's color and art.
 *
 * Teams are keyed by ESPN franchise id (`espn_id`), which is STABLE across seasons
 * even when the team name changes year to year. New franchises (e.g. the 2 teams
 * being added in 2026) don't need an entry here — they automatically get a color
 * from PALETTE via `teamColor()`. Add an entry when you want to lock in a specific
 * color or drop in real art.
 */

export type TeamMeta = {
  color: string; // hex; the franchise's signature color
  art?: string; // path under /public to the team's art (placeholder used if absent)
};

// NOTE: `art` values below are PLACEHOLDER assignments from the existing
// /public/art folder, guessed by owner nickname, just to preview the look.
// Swap them for each team's real art when you have it.
export const teamMeta: Record<number, TeamMeta> = {
  1: { color: "#f97316", art: "/art/mich-vs-viola-playoffs.jpg" }, // Festive7 — orange
  3: { color: "#7c4a21", art: "/art/me-vs-duck-playoffs.jpg" }, // jasonsexybod — brown
  4: { color: "#dc2626", art: "/art/me-v-brum.png" }, // drasktic — red
  5: { color: "#ffb7c5", art: "/art/jason-vs-west-2.jpg" }, // ESPNfan2807758783 — sakura pink
  6: { color: "#1e3a8a", art: "/art/me-v-mich.png" }, // espn62403996 — dark blue
  7: { color: "#9333ea", art: "/art/me-v-sauce.png" }, // sauc3 — purple
  10: { color: "#eab308", art: "/art/jason-vs-varca-kicker-bowl.jpg" }, // fflubb — gold
  11: { color: "#3b82f6", art: "/art/west-vs-yeakel-playoffs.jpg" }, // Westy318 — (unchanged) blue
};

// Fallback colors for franchises without an explicit entry (e.g. future teams).
const PALETTE = [
  "#14b8a6",
  "#f97316",
  "#6366f1",
  "#84cc16",
  "#e11d48",
  "#0ea5e9",
  "#d946ef",
  "#22c55e",
];

export function teamColor(espnId: number): string {
  return teamMeta[espnId]?.color ?? PALETTE[espnId % PALETTE.length];
}

export function teamArt(espnId: number): string | null {
  return teamMeta[espnId]?.art ?? null;
}
