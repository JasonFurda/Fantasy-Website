"use client";

import { useActionState, useState } from "react";
import { teamColor } from "@/lib/teams-config";
import { submitRankings, type SubmitState } from "@/app/rankings-entry/actions";

export type EntryTeam = { espnId: number; name: string };

const INITIAL: SubmitState = { ok: false, message: "" };

export default function RankingEntryForm({
  token,
  teams,
  initialOrder,
  windowLabel,
  closesLabel,
  alreadySubmitted,
  lastUpdated,
}: {
  token: string;
  teams: EntryTeam[];
  initialOrder: number[];
  windowLabel: string;
  closesLabel: string;
  alreadySubmitted: boolean;
  lastUpdated: string | null;
}) {
  const byEspn = new Map(teams.map((t) => [t.espnId, t]));
  const [order, setOrder] = useState<number[]>(initialOrder);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [state, formAction, pending] = useActionState(submitRankings, INITIAL);

  const move = (from: number, to: number) => {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((prev) => {
      const next = [...prev];
      const [item] = next.splice(from, 1);
      next.splice(to, 0, item);
      return next;
    });
  };

  const savedTime = state.ok
    ? "just now"
    : lastUpdated
      ? new Date(lastUpdated).toLocaleString()
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="order" value={JSON.stringify(order)} />

      <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-sm">
        <div className="font-medium">This week: {windowLabel}</div>
        <div className="mt-0.5 text-muted">
          Submissions lock {closesLabel} night, then a new week opens. You can
          update your rankings as many times as you like until then.
          {alreadySubmitted && savedTime && (
            <>
              {" "}
              <span className="text-foreground">
                Last saved {savedTime}.
              </span>
            </>
          )}
        </div>
      </div>

      <ol className="space-y-1.5">
        {order.map((espnId, i) => {
          const team = byEspn.get(espnId);
          if (!team) return null;
          return (
            <li
              key={espnId}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragIdx !== null && dragIdx !== i) {
                  move(dragIdx, i);
                  setDragIdx(i);
                }
              }}
              onDragEnd={() => setDragIdx(null)}
              className={`flex items-center gap-3 rounded-lg border bg-surface px-3 py-2.5 ${
                dragIdx === i
                  ? "border-accent opacity-60"
                  : "border-border"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold tabular-nums text-muted">
                {i + 1}
              </span>
              <span
                className="h-3 w-3 shrink-0 rounded-full"
                style={{ backgroundColor: teamColor(espnId) }}
              />
              <span className="min-w-0 flex-1 truncate font-medium">
                {team.name.trim()}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Move up"
                  disabled={i === 0}
                  onClick={() => move(i, i - 1)}
                  className="rounded-md border border-border px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label="Move down"
                  disabled={i === order.length - 1}
                  onClick={() => move(i, i + 1)}
                  className="rounded-md border border-border px-2 py-1 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
                >
                  ↓
                </button>
                <span className="ml-1 hidden cursor-grab select-none text-muted sm:inline">
                  ⠿
                </span>
              </span>
            </li>
          );
        })}
      </ol>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending
            ? "Saving…"
            : alreadySubmitted
              ? "Update rankings"
              : "Submit rankings"}
        </button>
        {state.message && (
          <span
            className={`text-sm ${state.ok ? "text-accent" : "text-red-500"}`}
          >
            {state.message}
          </span>
        )}
      </div>

      <p className="text-xs text-muted">
        Drag the rows (or use ↑ / ↓) to order every team from best (1) to worst.
      </p>
    </form>
  );
}
