"use server";

import { isValidRankingToken } from "@/lib/rankings-auth";
import { currentRankingWeek } from "@/lib/ranking-week";
import { getActiveRankingSeason, saveSubmission } from "@/lib/rankings";

export type SubmitState = {
  ok: boolean;
  message: string;
  savedAt?: string;
};

/** Save this week's power rankings. Re-verifies the secret and re-derives the
 *  window server-side — nothing from the client is trusted. */
export async function submitRankings(
  _prev: SubmitState,
  formData: FormData,
): Promise<SubmitState> {
  const token = String(formData.get("token") ?? "");
  if (!isValidRankingToken(token)) {
    return { ok: false, message: "Not authorized." };
  }

  let order: unknown;
  try {
    order = JSON.parse(String(formData.get("order") ?? "[]"));
  } catch {
    return { ok: false, message: "Could not read the submitted order." };
  }
  if (!Array.isArray(order) || order.some((v) => typeof v !== "number")) {
    return { ok: false, message: "Invalid ranking data." };
  }
  const submitted = order as number[];

  const season = await getActiveRankingSeason();
  if (!season) {
    return { ok: false, message: "No active season to rank." };
  }

  // The order must be a full permutation of exactly the league's teams.
  const valid = new Set(season.teams.map((t) => t.espn_id));
  const unique = new Set(submitted);
  const isPermutation =
    submitted.length === valid.size &&
    unique.size === submitted.length &&
    submitted.every((id) => valid.has(id));
  if (!isPermutation) {
    return {
      ok: false,
      message: "Please rank every team exactly once before submitting.",
    };
  }

  const { weekStart } = currentRankingWeek();
  try {
    await saveSubmission(season.year, weekStart, submitted);
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error ? `Save failed: ${e.message}` : "Save failed.",
    };
  }

  return {
    ok: true,
    message: "Rankings saved.",
    savedAt: new Date().toISOString(),
  };
}
