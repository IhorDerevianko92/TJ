import { useState } from "react";
import { Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/journal/confirm-delete";
import { CopyButton } from "@/components/journal/copy-button";
import { fmtMoney, fmtPrice, fmtR } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";
import type { ComputedRow } from "@/lib/journal/types";

function Metric({
  label,
  value,
  copy,
  copyLabel,
}: {
  label: string;
  value: string;
  copy?: number | null;
  copyLabel?: string;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="truncate font-mono text-sm tabular-nums">{value}</p>
      </div>
      {copy != null ? <CopyButton value={copy} label={copyLabel ?? label} /> : null}
    </div>
  );
}

function displayRr(r: ComputedRow): number | null {
  if (r.realizations.length > 0) return r.rMultiple;
  return r.rr ?? r.rMultiple;
}

function volumeUsd(r: ComputedRow): number | null {
  if (r.positionUsd != null) return r.positionUsd;
  if (r.volume != null && r.entryPrice != null) return r.volume * r.entryPrice;
  return null;
}

export function OpenTrades({
  rows,
  onManage,
  onInfo,
}: {
  rows: ComputedRow[];
  onManage: (row: ComputedRow) => void;
  onInfo: (row: ComputedRow) => void;
}) {
  const deleteTrade = useJournal((s) => s.deleteTrade);
  const [kill, setKill] = useState<ComputedRow | null>(null);
  const reversed = [...rows].reverse();

  if (reversed.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Открытых сделок нет.
      </div>
    );
  }

  return (
    <>
    <div className="grid gap-3">
      {reversed.map((r) => {
        const usd = volumeUsd(r);
        const rr = displayRr(r);
        return (
          <article
            key={r.id}
            className="rounded-xl border border-border bg-card p-3 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]"
          >
            <header className="mb-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold">{r.pair}</h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <Badge variant={r.direction === "Long" ? "long" : "short"}>
                    {r.direction === "Long" ? "Лонг" : "Шорт"}
                  </Badge>
                  <Badge variant={r.atBreakeven ? "be" : "open"}>
                    {r.atBreakeven ? "БУ" : "В рынке"}
                  </Badge>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Информация о сделке"
                  onClick={() => onInfo(r)}
                >
                  <Info className="size-4" />
                  Инфо
                </Button>
                <Button size="sm" onClick={() => onManage(r)}>
                  Тейк / БУ
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Удалить сделку"
                  onClick={() => setKill(r)}
                >
                  ×
                </Button>
              </div>
            </header>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Metric
                label="Объём $"
                value={fmtMoney(usd)}
                copy={usd}
                copyLabel="объём $"
              />
              <Metric
                label="Открытие"
                value={fmtPrice(r.entryPrice)}
                copy={r.entryPrice}
                copyLabel="цену открытия"
              />
              <Metric
                label="Закрытие"
                value={fmtPrice(r.stopPrice)}
                copy={r.stopPrice}
                copyLabel="цену закрытия"
              />
              <Metric
                label="Тейк"
                value={fmtPrice(r.takeProfit)}
                copy={r.takeProfit}
                copyLabel="тейк"
              />
              <Metric
                label={r.realizations.length ? "RR факт" : "RR план"}
                value={fmtR(rr)}
              />
            </div>
          </article>
        );
      })}
    </div>
    <ConfirmDelete
      open={!!kill}
      title={kill ? `Сделка ${kill.pair} будет удалена без возврата.` : ""}
      onCancel={() => setKill(null)}
      onConfirm={() => {
        if (kill) deleteTrade(kill.id);
        setKill(null);
      }}
    />
    </>
  );
}
