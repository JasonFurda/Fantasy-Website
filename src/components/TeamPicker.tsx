"use client";

import { useRouter } from "next/navigation";
import { MY_TEAM_COOKIE, MY_TEAM_MAX_AGE } from "@/lib/my-team";

type PickTeam = { espnId: number; name: string; color: string };

export default function TeamPicker({ teams }: { teams: PickTeam[] }) {
  const router = useRouter();

  const choose = (value: string) => {
    document.cookie = `${MY_TEAM_COOKIE}=${value}; path=/; max-age=${MY_TEAM_MAX_AGE}; samesite=lax`;
    router.refresh();
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {teams.map((t) => (
          <button
            key={t.espnId}
            type="button"
            onClick={() => choose(String(t.espnId))}
            className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-3 text-left text-sm font-medium transition-colors hover:border-accent hover:bg-surface-2"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ backgroundColor: t.color }}
            />
            <span className="truncate">{t.name}</span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => choose("none")}
        className="mt-3 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
      >
        Just browsing — no team
      </button>
    </div>
  );
}
