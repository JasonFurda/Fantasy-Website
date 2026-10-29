import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import SiteNav from "@/components/SiteNav";
import { MY_TEAM_HEAD_SCRIPT } from "@/lib/my-team-highlight";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The head script below sets data-my-team before hydration.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MY_TEAM_HEAD_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-accent" />
              <span className="whitespace-nowrap tracking-tight">Chamoms Fantasy</span>
            </Link>
            <SiteNav />
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
