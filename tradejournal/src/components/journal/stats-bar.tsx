import { fmtMoney, fmtPct } from "@/lib/journal/format";
import type { JournalStats } from "@/lib/journal/types";

function Stat({
  label,
  value,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  tone?: "default" | "equity" | "risk" | "avail" | "next";
  hint?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    equity: "text-equity",
    risk: "text-danger",
    avail: "text-long",
    next: "text-next",
  };
  return (
    <div className="relative flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${tones[tone]}`}>
        {value}
      </span>
      {hint ? <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

export function StatsBar({
  stats,
  depositHint = "счёт журнала",
}: {
  stats: JournalStats;
  depositHint?: string;
}) {
  return (
    <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      <Stat label="Кэш" value={fmtMoney(stats.currentEquity)} hint={depositHint} />
      <Stat
        label="Открытый риск"
        value={fmtMoney(stats.openRisk)}
        tone="risk"
        hint={`${stats.riskOnCount} со стопом · ${stats.openCount} открытых`}
      />
      <Stat
        label="Доступно"
        value={fmtMoney(stats.available)}
        tone="avail"
        hint="депозит − открытый риск"
      />
      <Stat
        label="Риск след. сделки"
        value={fmtMoney(stats.nextRisk)}
        tone="next"
        hint="1% от доступно"
      />
      <Stat
        label="Winrate"
        value={stats.winrate == null ? "—" : fmtPct(stats.winrate * 100, 1)}
        hint={`${stats.wins}W / ${stats.losses}L / ${stats.be} BE`}
      />
    </section>
  );
}
