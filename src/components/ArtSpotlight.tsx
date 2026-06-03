"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import type { ArtPiece } from "@/lib/homepage-config";

export default function ArtSpotlight({
  art,
  rotationMs,
}: {
  art: ArtPiece[];
  rotationMs: number;
}) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback(
    (next: number) => setIndex((next + art.length) % art.length),
    [art.length],
  );

  useEffect(() => {
    if (paused || art.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % art.length);
    }, rotationMs);
    return () => clearInterval(id);
  }, [paused, art.length, rotationMs]);

  if (art.length === 0) return null;

  return (
    <section
      className="relative flex h-full flex-col"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carousel"
    >
      <div className="relative min-h-[440px] flex-1 overflow-hidden rounded-2xl border border-border bg-surface-2">
        {art.map((piece, i) => (
          <Image
            key={piece.src}
            src={piece.src}
            alt={piece.title}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, 960px"
            className={`object-contain p-3 transition-opacity duration-700 ${
              i === index ? "opacity-100" : "opacity-0"
            }`}
          />
        ))}

        {/* Arrows */}
        <button
          onClick={() => go(index - 1)}
          aria-label="Previous artwork"
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/70"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() => go(index + 1)}
          aria-label="Next artwork"
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-2 text-white backdrop-blur transition hover:bg-black/70"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* Dots */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {art.map((piece, i) => (
          <button
            key={piece.src}
            onClick={() => setIndex(i)}
            aria-label={`Show ${piece.title}`}
            className={`h-2 rounded-full transition-all ${
              i === index ? "w-6 bg-accent" : "w-2 bg-border hover:bg-muted"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
