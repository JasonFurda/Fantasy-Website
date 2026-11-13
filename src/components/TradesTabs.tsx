import Link from "next/link";

/** Sub-tabs shared by /trades, /trades/block and /trades/calculator. Phones
 *  get one-word labels so all three fit on one row at 320px. */
export default function TradesTabs({
  active,
}: {
  active: "history" | "block" | "calculator";
}) {
  const cls = (on: boolean) =>
    `-mb-px whitespace-nowrap border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
      on
        ? "border-accent text-foreground"
        : "border-transparent text-muted hover:text-foreground"
    }`;
  const label = (short: string, long: string) => (
    <>
      <span className="sm:hidden">{short}</span>
      <span className="hidden sm:inline">{long}</span>
    </>
  );
  return (
    <nav className="mb-6 flex gap-5 border-b border-border">
      {/* /trades is dynamic: don't let a prefetch render it. */}
      <Link href="/trades" prefetch={false} className={cls(active === "history")}>
        {label("History", "Trade History")}
      </Link>
      <Link href="/trades/block" className={cls(active === "block")}>
        {label("Block", "Trading Block")}
      </Link>
      <Link href="/trades/calculator" className={cls(active === "calculator")}>
        {label("Calculator", "Trade Calculator")}
      </Link>
    </nav>
  );
}
