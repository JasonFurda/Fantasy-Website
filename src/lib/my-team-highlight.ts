import { MY_TEAM_COOKIE } from "@/lib/my-team";

/**
 * "My team" highlighting that works on CDN-cached pages.
 *
 * Pages served from Vercel's CDN cache are the same bytes for every visitor, so
 * they can't read the my-team cookie on the server (a cookies() read would also
 * force a function render on every request — which is what burned through the
 * Fast Origin Transfer allowance). Instead:
 *
 *   1. The server tags highlightable elements with `mineProps(espnId, style)`,
 *      which renders `data-mine="<style>" data-mine-team="<espnId>"` (a
 *      space-separated list when an element belongs to two teams, e.g. a
 *      matchup card).
 *   2. An inline script in <head> (MY_TEAM_HEAD_SCRIPT) copies the cookie onto
 *      <html data-my-team="..."> before first paint — no flash.
 *   3. MY_TEAM_CSS only styles elements whose data-mine-team matches it.
 *
 * Changing team just updates the <html> attribute (setMyTeamAttr), so every
 * highlight follows instantly without a re-render.
 */

export type MineStyle =
  | "row" // bg-accent/10 — a highlighted table row
  | "text" // text-accent — a team name
  | "strong" // font-semibold text-accent — a team link in a table
  | "card"; // border-accent/40 bg-accent/5 — a matchup card

export function mineProps(
  espnId: number | null | undefined | (number | null | undefined)[],
  style: MineStyle,
): { "data-mine"?: MineStyle; "data-mine-team"?: string } {
  const ids = (Array.isArray(espnId) ? espnId : [espnId]).filter(
    (id): id is number => id != null,
  );
  return ids.length === 0
    ? {}
    : { "data-mine": style, "data-mine-team": ids.join(" ") };
}

const STYLE_RULES: Record<MineStyle, string> = {
  row: "background-color:color-mix(in oklab,var(--color-accent) 10%,transparent)",
  text: "color:var(--color-accent)",
  strong: "color:var(--color-accent);font-weight:600",
  card:
    "border-color:color-mix(in oklab,var(--color-accent) 40%,transparent);background-color:color-mix(in oklab,var(--color-accent) 5%,transparent)",
};

// Attribute selectors can't compare two attributes, so emit one rule per
// franchise id. ESPN ids in this league are small; 1–32 leaves headroom.
const MAX_ESPN_ID = 32;

export const MY_TEAM_CSS = Array.from({ length: MAX_ESPN_ID }, (_, i) => i + 1)
  .flatMap((id) =>
    (Object.keys(STYLE_RULES) as MineStyle[]).map(
      (style) =>
        `html[data-my-team="${id}"] [data-mine="${style}"][data-mine-team~="${id}"]${style === "card" ? ":not(:hover)" : ""}{${STYLE_RULES[style]}}`,
    ),
  )
  .join("");

export const MY_TEAM_HEAD_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )${MY_TEAM_COOKIE}=([^;]*)/);var v=m&&decodeURIComponent(m[1]);if(v&&v!=="none")document.documentElement.setAttribute("data-my-team",v)}catch(e){}`;

/** Call after writing or clearing the cookie on the client. */
export function setMyTeamAttr(value: string | null): void {
  const el = document.documentElement;
  if (value && value !== "none") el.setAttribute("data-my-team", value);
  else el.removeAttribute("data-my-team");
}
