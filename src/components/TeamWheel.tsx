"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

export type WheelTeam = {
  espnId: number;
  name: string;
  owner: string;
  color: string;
  art: string | null;
  record: string | null;
  rank: number | null;
  teamCount: number | null;
  titles: number;
  seasons: number;
};

const IDLE_SPEED = 0.08; // deg per frame before any selection
const RADIUS = 330; // px — size of the wheel
const ITEM_WIDTH = 460; // px

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
        if (Math.abs(diff) < 0.12) {
          r = targetRef.current;
          modeRef.current = "rest";
        } else {
          r += diff * 0.12;
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

  const nudge = useCallback(
    (dir: 1 | -1) => {
      const cur = selected ?? Math.round(-rotationRef.current / step);
      selectIndex(((cur + dir) % n + n) % n);
    },
    [selected, step, n, selectIndex],
  );

  if (n === 0) return <p className="text-muted">No teams found.</p>;

  const selectedTeam = selected != null ? teams[selected] : null;

  return (
    <section className="relative h-[88vh] min-h-[620px] w-full overflow-hidden bg-background">
      {/* Gigantic background art for the selected team */}
      <div className="absolute inset-0">
        {selectedTeam ? (
          selectedTeam.art ? (
            <Image
              key={selectedTeam.espnId}
              src={selectedTeam.art}
              alt=""
              fill
              priority
              sizes="100vw"
              className="animate-[fadeIn_0.6s_ease] object-cover"
            />
          ) : (
            <div
              key={selectedTeam.espnId}
              className="h-full w-full animate-[fadeIn_0.6s_ease]"
              style={{
                background: `radial-gradient(circle at 35% 45%, ${selectedTeam.color}66, transparent 60%), var(--background)`,
              }}
            >
              <span
                className="absolute left-[8%] top-1/2 -translate-y-1/2 select-none text-[40vh] font-black leading-none opacity-10"
                style={{ color: selectedTeam.color }}
              >
                {selectedTeam.name.trim().charAt(0).toUpperCase()}
              </span>
            </div>
          )
        ) : null}
        {/* readability overlay */}
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/70 to-background/30" />
        <div className="absolute inset-0 bg-background/30" />
      </div>

      {/* The 3D vertical wheel (left/center) */}
      <div
        className="relative z-10 flex h-full items-center pl-[4vw]"
        style={{ perspective: "1300px" }}
      >
        <div
          className="relative"
          style={{
            width: ITEM_WIDTH,
            height: RADIUS * 2,
            transformStyle: "preserve-3d",
            transform: `rotateX(${rotation}deg)`,
          }}
        >
          {teams.map((team, i) => {
            const a = ((i * step + rotation) * Math.PI) / 180;
            const cos = Math.cos(a);
            const visible = cos > -0.15;
            const isSel = selected === i;
            return (
              <button
                key={team.espnId}
                onClick={() => selectIndex(i)}
                aria-label={team.name}
                className="absolute left-0 top-1/2 flex w-full items-center justify-start rounded-2xl border-2 px-7 py-5 text-left font-black tracking-tight"
                style={{
                  backfaceVisibility: "hidden",
                  transform: `translateY(-50%) rotateX(${i * step}deg) translateZ(${RADIUS}px)`,
                  opacity: visible ? Math.max(0.15, Math.pow((cos + 1) / 2, 1.5)) : 0,
                  pointerEvents: visible ? "auto" : "none",
                  borderColor: team.color,
                  backgroundColor: isSel ? team.color : `${team.color}26`,
                  color: isSel ? "#0b0f14" : "var(--foreground)",
                  fontSize: "clamp(1.75rem, 4vw, 3rem)",
                  boxShadow: isSel ? `0 0 40px ${team.color}99` : "none",
                }}
              >
                {team.name.trim()}
              </button>
            );
          })}
        </div>

        {/* up/down controls */}
        <div className="absolute left-[calc(4vw+0.5rem)] bottom-6 z-20 flex gap-2">
          <button
            onClick={() => nudge(-1)}
            aria-label="Previous team"
            className="rounded-full border border-border bg-surface/80 p-3 backdrop-blur transition hover:bg-surface-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 15l-6-6-6 6" /></svg>
          </button>
          <button
            onClick={() => nudge(1)}
            aria-label="Next team"
            className="rounded-full border border-border bg-surface/80 p-3 backdrop-blur transition hover:bg-surface-2"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
        </div>
      </div>

      {/* Middle-right stats box */}
      {selectedTeam && (
        <aside
          key={selectedTeam.espnId}
          className="absolute right-[4vw] top-1/2 z-20 w-[min(380px,42vw)] -translate-y-1/2 animate-[fadeIn_0.5s_ease] rounded-2xl border bg-surface/85 p-6 backdrop-blur"
          style={{ borderColor: selectedTeam.color }}
        >
          <div
            className="inline-block rounded-full px-3 py-1 text-xs font-semibold"
            style={{ backgroundColor: `${selectedTeam.color}26`, color: selectedTeam.color }}
          >
            {selectedTeam.owner}
          </div>
          <h2 className="mt-3 text-3xl font-bold tracking-tight">
            {selectedTeam.name.trim()}
          </h2>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
            <Stat label="Last record" value={selectedTeam.record ?? "—"} />
            <Stat
              label="Last finish"
              value={
                selectedTeam.rank && selectedTeam.teamCount
                  ? `${ordinal(selectedTeam.rank)} of ${selectedTeam.teamCount}`
                  : "—"
              }
            />
            <Stat label="Seasons" value={String(selectedTeam.seasons)} />
            <Stat
              label="Titles"
              value={selectedTeam.titles > 0 ? `🏆 ${selectedTeam.titles}` : "0"}
            />
          </dl>

          <Link
            href={`/teams/${selectedTeam.espnId}`}
            className="mt-6 inline-flex w-full items-center justify-center rounded-lg px-5 py-3 text-sm font-semibold text-[#0b0f14] transition-opacity hover:opacity-90"
            style={{ backgroundColor: selectedTeam.color }}
          >
            Enter team page →
          </Link>
        </aside>
      )}

      {/* Hint before first selection */}
      {!selectedTeam && (
        <div className="absolute right-[6vw] top-1/2 z-20 hidden -translate-y-1/2 text-right sm:block">
          <p className="text-2xl font-semibold">Pick your team</p>
          <p className="mt-1 max-w-xs text-sm text-muted">
            Tap a name on the wheel or use the arrows.
          </p>
        </div>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-surface-2 px-3 py-2">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
