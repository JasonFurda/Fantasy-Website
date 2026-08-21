"use client";

import { useState } from "react";
import type { MatchupDetail } from "@/lib/queries";
import MatchupBoxScore from "@/components/MatchupBoxScore";
import OptimalRoster from "@/components/OptimalRoster";

export default function MatchupBoard({
  detail,
  awayColor,
  homeColor,
}: {
  detail: MatchupDetail;
  awayColor: string;
  homeColor: string;
}) {
  const [view, setView] = useState<"box" | "optimal">("box");

  const tab = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
      active
        ? "bg-accent text-background"
        : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <div>
      <div className="mb-4 flex justify-center px-5 sm:px-0">
        <nav className="flex gap-1 rounded-lg border border-border bg-surface p-1">
          <button
            type="button"
            onClick={() => setView("box")}
            className={tab(view === "box")}
          >
            Box Score
          </button>
          <button
            type="button"
            onClick={() => setView("optimal")}
            className={tab(view === "optimal")}
          >
            Optimal Roster
          </button>
        </nav>
      </div>

      {view === "box" ? (
        <MatchupBoxScore
          detail={detail}
          awayColor={awayColor}
          homeColor={homeColor}
        />
      ) : (
        <OptimalRoster
          detail={detail}
          awayColor={awayColor}
          homeColor={homeColor}
        />
      )}
    </div>
  );
}
