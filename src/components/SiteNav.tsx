"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/teams", label: "Teams" },
  { href: "/year-stats", label: "Year Stats" },
  { href: "/player-comparisons", label: "Players" },
];

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-1 text-sm md:flex">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-1.5 transition-colors hover:bg-surface-2 hover:text-foreground ${
              isActive(item.href) ? "text-foreground" : "text-muted"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Mobile toggle */}
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Menu"
        aria-expanded={open}
        className="rounded-md p-2 text-foreground md:hidden"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M6 18L18 6" />
          ) : (
            <>
              <path d="M3 6h18" />
              <path d="M3 12h18" />
              <path d="M3 18h18" />
            </>
          )}
        </svg>
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute inset-x-0 top-full border-b border-border bg-surface md:hidden">
          <nav className="mx-auto flex max-w-5xl flex-col px-3 py-2">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={`rounded-md px-3 py-2.5 text-sm transition-colors hover:bg-surface-2 ${
                  isActive(item.href) ? "text-foreground" : "text-muted"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </>
  );
}
