"use client";

import { useRouter } from "next/navigation";
import { MY_TEAM_COOKIE, MY_TEAM_MAX_AGE } from "@/lib/my-team";

type PickTeam = { espnId: number; name: string; color: string };

// Popup shown on first visit to the homepage. Picking a team personalizes the
// page; dismissing (backdrop / ✕ / "Just browsing") keeps the default homepage.
export default function TeamPickerModal({ teams }: { teams: PickTeam[] }) {
  const router = useRouter();

  const choose = (value: string) => {
    document.cookie = `${MY_TEAM_COOKIE}=${value}; path=/; max-age=${MY_TEAM_MAX_AGE}; samesite=lax`;
    router.refresh();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close"
        onClick={() => choose("none")}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <div className="relative z-10 w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">
              Which team are you?
            </h2>
            <p className="mt-1 text-sm text-muted">
              Pick your team to personalize the homepage with your upcoming games
              and top players.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={() => choose("none")}
            className="shrink-0 rounded-md px-2 py-1 text-muted hover:bg-surface-2 hover:text-foreground"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
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
          className="mt-4 text-sm text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Just browsing — no team
        </button>
      </div>
    </div>
  );
}
