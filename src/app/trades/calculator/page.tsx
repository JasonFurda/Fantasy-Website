import type { Metadata } from "next";
import { getTradeCalcData } from "@/lib/queries";
import TradesTabs from "@/components/TradesTabs";
import TradeCalculator from "@/components/TradeCalculatorClient";

// Static and refreshed hourly: all the trade math runs in the browser.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Trade Calculator · Chamoms Fantasy",
  description:
    "Try out a trade and see what it does to both teams' lineups and expected wins for the rest of the season.",
};

export default async function TradeCalculatorPage() {
  const data = await getTradeCalcData();

  return (
    <main className="mx-auto max-w-5xl px-5 py-10">
      <TradesTabs active="calculator" />
      <h1 className="text-2xl font-bold tracking-tight">Trade Calculator</h1>
      {!data || data.weeks.length === 0 ? (
        <p className="mt-6 rounded-xl border border-border bg-surface px-5 py-8 text-sm text-muted">
          The calculator works during the regular season — there are no
          regular-season weeks left to play out right now.
        </p>
      ) : (
        <>
          <p className="mt-1 text-sm text-muted">
            Pick two teams and the players each side gives up. The trade is
            played out over{" "}
            {data.weeks.length === 1
              ? `week ${data.weeks[0]}`
              : `weeks ${data.weeks[0]}–${data.weeks[data.weeks.length - 1]}`}{" "}
            using both teams&apos; full rosters, byes and remaining schedules.
          </p>
          <TradeCalculator data={data} />
        </>
      )}
    </main>
  );
}
