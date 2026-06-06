import Image from "next/image";

/**
 * Full-page background for a matchup: the two teams' art slide in from the
 * sides, clash in the middle with a flash, then STAY as a dimmed split
 * backdrop behind all the UI. Fixed + pointer-events-none, so it never blocks
 * clicks. Remounts (replays the entrance) when the matchup changes via `key`.
 */
export default function MatchupClash({
  awayArt,
  homeArt,
  awayColor,
  homeColor,
}: {
  awayArt: string | null;
  homeArt: string | null;
  awayColor: string;
  homeColor: string;
}) {
  const Half = ({
    art,
    color,
    side,
  }: {
    art: string | null;
    color: string;
    side: "left" | "right";
  }) => (
    <div
      className={`absolute inset-y-0 w-3/5 ${side === "left" ? "left-0" : "right-0"}`}
      style={{
        animation: `${side === "left" ? "clashInLeft" : "clashInRight"} 0.7s cubic-bezier(0.2,0.8,0.2,1) both`,
      }}
    >
      {art ? (
        <Image src={art} alt="" fill sizes="60vw" className="object-cover" priority />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${color}, transparent 70%)`,
          }}
        />
      )}
      {/* blend the inner edge toward the page background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to ${side === "left" ? "right" : "left"}, transparent 30%, var(--background))`,
        }}
      />
    </div>
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
    >
      <Half art={awayArt} color={awayColor} side="left" />
      <Half art={homeArt} color={homeColor} side="right" />

      {/* keep the art subtle so the UI stays readable */}
      <div className="absolute inset-0 bg-background/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-background/40 via-transparent to-background" />

      {/* one-shot center clash flash */}
      <div
        className="absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.85), transparent 65%)",
          animation: "clashFlash 0.95s ease-out both",
        }}
      />
    </div>
  );
}
