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
 *   2. An inline script in <head> (MY_TEAM_HEAD_SCRIPT) reads the cookie
 *      before first paint — no flash — and writes a small <style> that
 *      highlights only elements whose data-mine-team includes that team.
 *
 * Changing team just rewrites that <style> (setMyTeamAttr), so every highlight
 * follows instantly without a re-render.
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

// The rules are built in the browser for the chosen team only, rather than
// shipping one rule per franchise in every page (that was ~14 KB of CSS,
// counted twice — once in the HTML and again in the RSC payload).
const RULES_JSON = JSON.stringify(STYLE_RULES);

// Defines window.__setMyTeam(v): sets <html data-my-team> and (re)writes a
// <style id="my-team-css"> that highlights elements tagged for team v. Run
// inline in <head> so highlights are in place before first paint.
export const MY_TEAM_HEAD_SCRIPT = `(function(){var R=${RULES_JSON};window.__setMyTeam=function(v){var d=document,h=d.documentElement,s=d.getElementById("my-team-css");if(!/^\\d+$/.test(v||"")){h.removeAttribute("data-my-team");if(s)s.textContent="";return}h.setAttribute("data-my-team",v);if(!s){s=d.createElement("style");s.id="my-team-css";d.head.appendChild(s)}var c="";for(var k in R)c+="[data-mine=\\""+k+"\\"][data-mine-team~=\\""+v+"\\"]"+(k==="card"?":not(:hover)":"")+"{"+R[k]+"}";s.textContent=c};try{var m=document.cookie.match(/(?:^|; )${MY_TEAM_COOKIE}=([^;]*)/);window.__setMyTeam(m&&decodeURIComponent(m[1]))}catch(e){}})()`;

/** Call after writing or clearing the cookie on the client. */
export function setMyTeamAttr(value: string | null): void {
  (window as unknown as { __setMyTeam?: (v: string | null) => void })
    .__setMyTeam?.(value);
}
