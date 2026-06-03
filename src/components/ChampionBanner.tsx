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
    <section className="relative overflow-hidden rounded-2xl border border-accent/30 bg-gradient-to-br from-accent/15 via-surface to-surface p-8 sm:p-10">
      <div className="flex items-center gap-2 text-base font-medium text-accent">
        <span aria-hidden>🏆</span>
        {year} League Champion
      </div>
      <h2 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
        {teamName}
      </h2>
      <p className="mt-2 text-base text-muted">Managed by {owner}</p>
      <p className="mt-5 max-w-2xl text-lg text-foreground/90">{blurb}</p>
    </section>
  );
}
