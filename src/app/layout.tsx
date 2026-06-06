import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Chamoms Fantasy Football",
  description: "Fantasy football league history, matchups, and stats.",
};

const NAV = [
  { href: "/", label: "Home" },
  { href: "/standings", label: "Standings" },
  { href: "/power-rankings", label: "Power Rankings" },
  { href: "/matchups", label: "Matchups" },
  { href: "/teams", label: "Teams" },
  { href: "/year-stats", label: "Year Stats" },
  { href: "/player-comparisons", label: "Players" },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-10 border-b border-border bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="tracking-tight">Chamoms Fantasy</span>
            </Link>
            <nav className="flex items-center gap-1 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-md px-3 py-1.5 text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>

        <div className="flex-1">{children}</div>

        <footer className="border-t border-border py-6 text-center text-xs text-muted">
          Chamoms Fantasy Football · data synced from ESPN
        </footer>
      </body>
    </html>
  );
}
