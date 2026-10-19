"use client";

import dynamic from "next/dynamic";
import type { TradeCalcData } from "@/lib/queries";

// Browser-only: the calculator starts from the URL and the "my team" cookie,
// which the static page can't know at build time.
const TradeCalculator = dynamic(() => import("@/components/TradeCalculator"), {
  ssr: false,
  loading: () => (
    <p className="mt-6 rounded-xl border border-dashed border-border px-5 py-6 text-center text-sm text-muted">
      Loading rosters…
    </p>
  ),
});

export default function TradeCalculatorClient({ data }: { data: TradeCalcData }) {
  return <TradeCalculator data={data} />;
}
