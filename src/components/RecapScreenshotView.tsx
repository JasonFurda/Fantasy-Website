"use client";

import { useEffect, useState, type ReactNode } from "react";

/** Phone-only button that opens the recap as a full-screen, compact sheet
 *  sized to fit in a single screenshot. `children` is the compact layout. */
export default function RecapScreenshotView({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-5 w-full rounded-lg border border-accent px-3 py-2 text-sm font-semibold text-accent transition-colors hover:bg-accent/10 md:hidden"
      >
        📸 Screenshottable view
      </button>
      {open && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-background md:hidden">
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close screenshottable view"
            className="absolute right-2 top-2 z-10 rounded-full px-2 py-0.5 text-lg leading-none text-muted hover:text-foreground"
          >
            ✕
          </button>
          {children}
        </div>
      )}
    </>
  );
}
