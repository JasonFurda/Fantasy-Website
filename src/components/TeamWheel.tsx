"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import TeamArt from "./TeamArt";

export type WheelTeam = {
  espnId: number;
  name: string;
  owner: string;
  color: string;
  art: string | null;
};

const IDLE_SPEED = 0.12; // degrees per frame while idle
const RADIUS_PCT = 40; // ring radius as % of the square container

export default function TeamWheel({ teams }: { teams: WheelTeam[] }) {
  const n = teams.length;
  const step = n > 0 ? 360 / n : 0;

  const [rotation, setRotation] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const rotationRef = useRef(0);
  const targetRef = useRef<number | null>(null);
  const modeRef = useRef<"idle" | "snap" | "rest">("idle");
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const tick = () => {
      let r = rotationRef.current;
      const mode = modeRef.current;
      if (mode === "idle") {
        r += IDLE_SPEED;
      } else if (mode === "snap" && targetRef.current != null) {
        const diff = targetRef.current - r;
        if (Math.abs(diff) < 0.15) {
          r = targetRef.current;
          modeRef.current = "rest";
        } else {
          r += diff * 0.1;
        }
      }
      rotationRef.current = r;
      setRotation(r);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const selectIndex = useCallback(
    (i: number, extraSpins = 0) => {
      const base = i * step;
      const current = rotationRef.current;
      const mod = (((-base - current) % 360) + 360) % 360;
      targetRef.current = current + mod + extraSpins * 360;
      modeRef.current = "snap";
      setSelected(i);
    },
    [step],
  );

  const spin = useCallback(() => {
    if (n === 0) return;
    const i = Math.floor(Math.random() * n);
    selectIndex(i, 3);
  }, [n, selectIndex]);

  if (n === 0) {
    return <p className="text-muted">No teams found.</p>;
  }

  const selectedTeam = selected != null ? teams[selected] : null;

  return (
    <div className="grid items-center gap-10 lg:grid-cols-2">
      {/* Wheel */}
      <div className="relative mx-auto aspect-square w-full max-w-[540px]">
        {/* selection pointer at top */}
        <div className="absolute left-1/2 top-0 z-30 -translate-x-1/2 -translate-y-1 text-accent">
          <svg width="22" height="14" viewBox="0 0 22 14" fill="currentColor">
            <path d="M11 14 0 0h22z" />
          </svg>
        </div>

        {/* hub */}
        <button
          onClick={spin}
          className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-border bg-surface text-center transition-colors hover:bg-surface-2"
          style={selectedTeam ? { borderColor: selectedTeam.color } : undefined}
          aria-label="Spin the wheel"
        >
          <span className="text-2xl">🎡</span>
          <span className="mt-1 text-xs font-medium uppercase tracking-wide text-muted">
            Spin
          </span>
        </button>

        {teams.map((team, i) => {
          const angle = ((i * step + rotation) * Math.PI) / 180;
          const x = 50 + RADIUS_PCT * Math.sin(angle);
          const y = 50 - RADIUS_PCT * Math.cos(angle);
          const focus = (Math.cos(angle) + 1) / 2; // 1 at top
          const scale = 0.72 + 0.5 * focus;
          const opacity = 0.4 + 0.6 * focus;
          const isSel = selected === i;
          return (
            <button
              key={team.espnId}
              onClick={() => selectIndex(i)}
              className="absolute whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-[border-color,background-color] duration-200"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: `translate(-50%, -50%) scale(${scale})`,
                opacity,
                zIndex: Math.round(focus * 100),
                borderColor: team.color,
                backgroundColor: isSel ? team.color : `${team.color}1f`,
                color: isSel ? "#0b0f14" : "var(--foreground)",
              }}
            >
              {team.name}
            </button>
          );
        })}
      </div>

      {/* Detail panel */}
      <div className="min-h-[420px]">
        {selectedTeam ? (
          <div
            className="rounded-2xl border bg-surface p-6"
            style={{ borderColor: `${selectedTeam.color}66` }}
          >
            <div className="mb-5 grid grid-cols-[140px_1fr] items-center gap-5">
              <TeamArt
                src={selectedTeam.art}
                name={selectedTeam.name}
                color={selectedTeam.color}
              />
              <div>
                <div
                  className="inline-block rounded-full px-2.5 py-0.5 text-xs font-medium"
                  style={{
                    backgroundColor: `${selectedTeam.color}26`,
                    color: selectedTeam.color,
                  }}
                >
                  Team
                </div>
                <h2 className="mt-2 text-3xl font-bold tracking-tight">
                  {selectedTeam.name}
                </h2>
                <p className="mt-1 text-sm text-muted">
                  Managed by {selectedTeam.owner}
                </p>
              </div>
            </div>
            <Link
              href={`/teams/${selectedTeam.espnId}`}
              className="inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-semibold text-[#0b0f14] transition-opacity hover:opacity-90"
              style={{ backgroundColor: selectedTeam.color }}
            >
              Enter team page →
            </Link>
          </div>
        ) : (
          <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-border p-6 text-center">
            <p className="text-lg font-medium">Pick your team</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              Tap a name on the wheel — or hit Spin — to see its art and open the
              team page.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
