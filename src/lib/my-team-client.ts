"use client";

import { useEffect, useState } from "react";
import { MY_TEAM_COOKIE } from "@/lib/my-team";

/**
 * Browser-side twin of getMyTeamEspnId(). The cookie is written with plain
 * `document.cookie` (see TeamPickerModal), so the client can read it too.
 *
 * Reading it here instead of on the server is what lets pages that only use the
 * pick for a highlight stay statically rendered — a server-side cookies() read
 * would force every request through a function. Returns null on the first
 * render (no cookie access during hydration) and then the chosen franchise.
 */
export function useMyTeamEspnId(): number | null {
  const [espnId, setEspnId] = useState<number | null>(null);

  useEffect(() => {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${MY_TEAM_COOKIE}=`))
      ?.slice(MY_TEAM_COOKIE.length + 1);
    if (!raw || raw === "none") return;
    const n = Number(decodeURIComponent(raw));
    if (Number.isFinite(n)) setEspnId(n);
  }, []);

  return espnId;
}
