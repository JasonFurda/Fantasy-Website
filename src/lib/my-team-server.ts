import { cookies } from "next/headers";
import { MY_TEAM_COOKIE } from "@/lib/my-team";

/**
 * The franchise (espn_id) the visitor picked on the homepage, read from the
 * cookie — used to highlight "their" team across the site. null if they haven't
 * chosen one (or are browsing without a team). Server Components only.
 */
export async function getMyTeamEspnId(): Promise<number | null> {
  const raw = (await cookies()).get(MY_TEAM_COOKIE)?.value;
  if (!raw || raw === "none") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}
