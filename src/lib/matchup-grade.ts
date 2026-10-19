import type { DefenseVsPos } from "@/lib/queries";

/** Softest matchups get green, toughest get red. Ranks are 1 = allows the most,
 *  so low rank = good for your player. Shared by /outlook and the homepage. */
export function verdict(r: DefenseVsPos, total: number) {
  const pct = total > 1 ? (r.rank - 1) / (total - 1) : 0.5;
  if (pct <= 0.25) return { label: "Great", cls: "text-accent" };
  if (pct <= 0.45) return { label: "Good", cls: "text-accent/80" };
  if (pct <= 0.65) return { label: "Neutral", cls: "text-muted" };
  if (pct <= 0.85) return { label: "Tough", cls: "text-orange-400" };
  return { label: "Avoid", cls: "text-red-400" };
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
