import Image from "next/image";

/**
 * Decorative entrance: the two teams' art slide in from the sides, clash in the
 * middle with a flash, then the whole overlay fades out. Purely visual —
 * pointer-events-none so it never blocks clicks or navigation. Remounts (and
 * replays) whenever the matchup changes via a `key` on the parent.
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
        animation: `${side === "left" ? "clashInLeft" : "clashInRight"} 0.6s cubic-bezier(0.2,0.8,0.2,1) both`,
      }}
    >
      {art ? (
        <Image src={art} alt="" fill sizes="60vw" className="object-cover" />
      ) : (
        <div
          className="h-full w-full"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${color}, transparent 70%)`,
          }}
        />
      )}
      {/* fade the meeting edge toward center */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(to ${side === "left" ? "right" : "left"}, transparent, var(--background))`,
        }}
      />
    </div>
  );

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-2xl"
      style={{ animation: "clashFade 1.5s ease-out both" }}
    >
      <Half art={awayArt} color={awayColor} side="left" />
      <Half art={homeArt} color={homeColor} side="right" />
      {/* center clash flash */}
      <div
        className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(255,255,255,0.9), transparent 65%)",
          animation: "clashFlash 0.9s ease-out both",
        }}
      />
    </div>
  );
}
