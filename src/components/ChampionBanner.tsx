export default function ChampionBanner({
  year,
  teamName,
  owner,
  blurb,
}: {
  year: number;
  teamName: string;
  owner: string;
  blurb: string;
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-surface to-surface p-6 sm:p-8">
      <div className="flex items-center gap-2 text-sm font-medium text-accent">
        <span aria-hidden>🏆</span>
        {year} League Champion
      </div>
      <h2 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
        {teamName}
      </h2>
      <p className="mt-1 text-sm text-muted">Managed by {owner}</p>
      <p className="mt-4 max-w-xl text-foreground/90">{blurb}</p>
    </section>
  );
}
