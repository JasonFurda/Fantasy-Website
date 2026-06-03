import Image from "next/image";

/**
 * Team art frame. Renders real art if `src` is provided, otherwise a
 * team-colored placeholder. Art is wired per-franchise in teams-config.ts.
 */
export default function TeamArt({
  src,
  name,
  color,
  className = "",
}: {
  src: string | null;
  name: string;
  color: string;
  className?: string;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div
      className={`relative aspect-square w-full overflow-hidden rounded-2xl border ${className}`}
      style={{ borderColor: `${color}66` }}
    >
      {src ? (
        <Image
          src={src}
          alt={`${name} art`}
          fill
          sizes="(max-width: 768px) 100vw, 420px"
          className="object-cover"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-3"
          style={{
            background: `radial-gradient(circle at 50% 35%, ${color}33, transparent 70%), var(--surface-2)`,
          }}
        >
          <span
            className="flex h-24 w-24 items-center justify-center rounded-full text-5xl font-black text-white"
            style={{ backgroundColor: color }}
          >
            {initial}
          </span>
          <span className="text-xs uppercase tracking-widest text-muted">
            Art coming soon
          </span>
        </div>
      )}
    </div>
  );
}
