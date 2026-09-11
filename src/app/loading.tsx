// A loading boundary for every route.
//
// This exists for cost, not just polish. Next prefetches <Link>s as they enter
// the viewport, and for a *dynamic* route a prefetch normally renders the whole
// destination page on the server. With nine nav links on every page that meant
// a handful of full renders per visit, which is what ate the Vercel Fluid
// Active CPU allowance. A loading boundary caps a prefetch at this skeleton, so
// prefetching stays free while navigation still feels instant.
export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <div className="h-7 w-56 animate-pulse rounded-md bg-surface-2" />
      <div className="mt-3 h-4 w-36 animate-pulse rounded bg-surface-2" />
      <div className="mt-8 space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="h-11 animate-pulse rounded-lg border border-border bg-surface"
          />
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
