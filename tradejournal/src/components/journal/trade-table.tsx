import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/journal/confirm-delete";
import { fmtDate, fmtMoneySigned, fmtPct } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";
import type { ComputedRow } from "@/lib/journal/types";

const OUTCOME: Record<string, { label: string; variant: "win" | "loss" | "be" }> = {
  win: { label: "✓", variant: "win" },
  loss: { label: "✗", variant: "loss" },
  be: { label: "б/о", variant: "be" },
};

function closeIso(r: ComputedRow): string {
  return r.closedAt || r.date;
}

export function TradeTable({
  rows,
  onManage,
  dateMode = "open",
}: {
  rows: ComputedRow[];
  onManage: (row: ComputedRow) => void;
  dateMode?: "open" | "close";
}) {
  const deleteTrade = useJournal((s) => s.deleteTrade);
  const [kill, setKill] = useState<ComputedRow | null>(null);
  const ordered =
    dateMode === "close"
      ? [...rows].sort((a, b) => {
          const d = closeIso(b).localeCompare(closeIso(a));
          if (d !== 0) return d;
          return b.id.localeCompare(a.id);
        })
      : [...rows].reverse();
  const dateHeader = dateMode === "close" ? "Дата закрытия" : "Дата открытия";

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="bg-header text-header-foreground">
            {["Пара", dateHeader, "Напр.", "Риск %", "Статус", "P&L", ""].map(
              (h) => (
                <th
                  key={h || "actions"}
                  className="px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
                >
                  {h}
                </th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {ordered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                Сделок пока нет — откройте первую.
              </td>
            </tr>
          ) : (
            ordered.map((r) => {
              const statusLabel =
                r.status === "closed"
                  ? "Закрыта"
                  : r.atBreakeven
                    ? "Открыта · БУ"
                    : "Открыта";
              const outcome = r.outcome;
              const shown = dateMode === "close" ? closeIso(r) : r.date;
              return (
                <tr
                  key={r.id}
                  className="border-t border-border bg-card odd:bg-card even:bg-row-alt"
                >
                  <td className="px-2.5 py-2 font-medium">{r.pair}</td>
                  <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                    {fmtDate(shown)}
                  </td>
                  <td className="px-2.5 py-2">
                    <Badge variant={r.direction === "Long" ? "long" : "short"}>
                      {r.direction}
                    </Badge>
                  </td>
                  <td className="px-2.5 py-2 font-mono tabular-nums">
                    {r.riskPct.toLocaleString("ru-RU", { maximumFractionDigits: 2 })}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex flex-wrap items-center gap-1">
                      <Badge
                        variant={
                          r.status === "open"
                            ? r.atBreakeven
                              ? "be"
                              : "open"
                            : "closed"
                        }
                      >
                        {statusLabel}
                      </Badge>
                      {r.status === "closed" && outcome ? (
                        <Badge variant={OUTCOME[outcome].variant}>
                          {OUTCOME[outcome].label} {fmtPct(r.resultPct)}
                        </Badge>
                      ) : null}
                    </div>
                  </td>
                  <td
                    className={`px-2.5 py-2 font-mono tabular-nums ${
                      r.realizedPnl > 0
                        ? "text-long"
                        : r.realizedPnl < 0
                          ? "text-short"
                          : "text-muted-foreground"
                    }`}
                  >
                    {r.realizations.length ? fmtMoneySigned(r.realizedPnl) : "—"}
                  </td>
                  <td className="px-2.5 py-2">
                    <div className="flex gap-1">
                      {r.status === "open" ? (
                        <Button size="sm" onClick={() => onManage(r)}>
                          Тейк / БУ
                        </Button>
                      ) : null}
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setKill(r)}
                      >
                        ×
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      <ConfirmDelete
        open={!!kill}
        title={kill ? `Сделка ${kill.pair} будет удалена без возврата.` : ""}
        onCancel={() => setKill(null)}
        onConfirm={() => {
          if (kill) deleteTrade(kill.id);
          setKill(null);
        }}
      />
    </div>
  );
}
