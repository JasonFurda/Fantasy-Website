"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlayerName } from "@/lib/queries";

// "__NAME__" in hrefTemplate is replaced with the chosen player's
// URL-encoded name to build the compare link.
export default function ComparePicker({
  players,
  hrefTemplate,
}: {
  players: PlayerName[];
  hrefTemplate: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const results =
    query.length >= 2
      ? players.filter((p) => p.name.toLowerCase().includes(query)).slice(0, 12)
      : [];

  const hrefFor = (name: string) =>
    hrefTemplate.replace("__NAME__", encodeURIComponent(name));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`rounded-md border px-2.5 py-1 text-sm font-medium transition-colors ${
          open
            ? "border-accent bg-accent/10 text-foreground"
            : "border-border text-muted hover:bg-surface-2 hover:text-foreground"
        }`}
      >
        Compare
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-border bg-surface shadow-xl">
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search a player…"
            className="w-full rounded-t-lg border-b border-border bg-transparent px-3 py-2 text-sm outline-none placeholder:text-muted"
          />
          <ul className="max-h-64 overflow-y-auto py-1">
            {results.map((p) => (
              <li key={p.name}>
                <Link
                  href={hrefFor(p.name)}
                  scroll={false}
                  onClick={() => setOpen(false)}
                  className="flex items-center justify-between gap-2 px-3 py-1.5 text-sm hover:bg-surface-2"
                >
                  <span className="truncate">{p.name}</span>
                  {p.position && (
                    <span className="shrink-0 text-xs text-muted">
                      {p.position}
                    </span>
                  )}
                </Link>
              </li>
            ))}
            {query.length >= 2 && results.length === 0 && (
              <li className="px-3 py-2 text-sm text-muted">No matches.</li>
            )}
            {query.length < 2 && (
              <li className="px-3 py-2 text-xs text-muted">
                Type at least 2 letters.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
