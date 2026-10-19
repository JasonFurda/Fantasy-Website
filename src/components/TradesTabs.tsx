import Link from "next/link";

/** Sub-tabs shared by /trades and /trades/calculator. */
export default function TradesTabs({ active }: { active: "history" | "calculator" }) {
  const cls = (on: boolean) =>
    `-mb-px border-b-2 px-1 pb-2 text-sm font-medium transition-colors ${
      on
        ? "border-accent text-foreground"
        : "border-transparent text-muted hover:text-foreground"
    }`;
  return (
    <nav className="mb-6 flex gap-5 border-b border-border">
      {/* /trades is dynamic: don't let a prefetch render it. */}
      <Link href="/trades" prefetch={false} className={cls(active === "history")}>
        Trade History
      </Link>
      <Link href="/trades/calculator" className={cls(active === "calculator")}>
        Trade Calculator
      </Link>
    </nav>
  );
}
