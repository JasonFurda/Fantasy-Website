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
  1: { color: "#f43f5e", art: "/art/mich-vs-viola-playoffs.jpg" }, // Festive7 — Straight Dak'n it
  3: { color: "#f59e0b", art: "/art/me-vs-duck-playoffs.jpg" }, // jasonsexybod — duckrunners
  4: { color: "#a16207", art: "/art/me-v-brum.png" }, // drasktic — Brown Squad
  5: { color: "#8b5cf6", art: "/art/jason-vs-west-2.jpg" }, // ESPNfan… — Bell Milers
  6: { color: "#06b6d4", art: "/art/me-v-mich.png" }, // espn62403996 — MCDC
  7: { color: "#ec4899", art: "/art/me-v-sauce.png" }, // sauc3 — Sauce
  10: { color: "#eab308", art: "/art/jason-vs-varca-kicker-bowl.jpg" }, // fflubb — Jaxjigba (2025 champion)
  11: { color: "#3b82f6", art: "/art/west-vs-yeakel-playoffs.jpg" }, // Westy318 — Bell Meyers
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
