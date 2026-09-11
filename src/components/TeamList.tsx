"use client";

import Link from "next/link";
import { useMyTeamEspnId } from "@/lib/my-team-client";
import type { WheelTeam } from "@/components/TeamWheel";

/** Mobile counterpart to TeamWheel: a tappable list of every franchise.
 *  Client-side so the "You" highlight can come from the cookie without
 *  forcing /teams to render per request. */
export default function TeamList({ teams }: { teams: WheelTeam[] }) {
  const myEspnId = useMyTeamEspnId();

  return (
    <div className="mx-auto max-w-2xl px-5 py-8 md:hidden">
      <h1 className="mb-1 text-2xl font-bold tracking-tight">Teams</h1>
      <p className="mb-5 text-sm text-muted">{teams.length} teams</p>
      <div className="grid gap-3">
        {teams.map((t) => (
          <Link
            key={t.espnId}
            href={`/teams/${t.espnId}`}
            className={`flex items-center justify-between gap-3 rounded-xl border bg-surface p-4 ${
              t.espnId === myEspnId ? "ring-2 ring-accent" : ""
            }`}
            style={{ borderColor: `${t.color}66` }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="h-9 w-9 shrink-0 rounded-full"
                style={{ backgroundColor: t.color }}
              />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-semibold">{t.name}</span>
                  {t.espnId === myEspnId && (
                    <span className="shrink-0 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-background">
                      You
                    </span>
                  )}
                </div>
                <div className="truncate text-xs text-muted">{t.owner}</div>
              </div>
            </div>
            <div className="shrink-0 text-right text-xs text-muted">
              {t.titles > 0 && <div>🏆 {t.titles}</div>}
              {t.record && <div className="tabular-nums">{t.record}</div>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
