import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { CopyButton } from "@/components/journal/copy-button";
import {
  fmtDate,
  fmtMoney,
  fmtMoneySigned,
  fmtPct,
  fmtPrice,
  fmtR,
} from "@/lib/journal/format";
import type { ComputedRow } from "@/lib/journal/types";

function Row({
  label,
  value,
  copy,
  copyLabel,
  tone,
}: {
  label: string;
  value: string;
  copy?: number | string | null;
  copyLabel?: string;
  tone?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2 last:border-b-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="flex min-w-0 items-center gap-0.5">
        <span className={`font-mono text-sm tabular-nums ${tone ?? "text-foreground"}`}>
          {value}
        </span>
        {copy != null ? <CopyButton value={copy} label={copyLabel ?? label} /> : null}
      </div>
    </div>
  );
}

function displayRr(trade: ComputedRow): { label: string; value: number | null } {
  if (trade.realizations.length > 0) {
    return { label: "RR факт", value: trade.rMultiple };
  }
  return { label: "RR план", value: trade.rr ?? trade.rMultiple };
}

export function TradeInfoCard({
  trade,
  onClose,
}: {
  trade: ComputedRow | null;
  onClose: () => void;
}) {
  if (!trade) return null;

  const statusLabel =
    trade.status === "closed"
      ? "Закрыта"
      : trade.atBreakeven
        ? "Открыта · БУ"
        : "Открыта";

  const volumeUsd =
    trade.positionUsd ??
    (trade.volume != null && trade.entryPrice != null
      ? trade.volume * trade.entryPrice
      : null);

  const rr = displayRr(trade);

  return (
    <Dialog open={!!trade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[min(100%-1.5rem,420px)]">
        <DialogTitle className="pr-6">{trade.pair}</DialogTitle>
        <DialogDescription>
          {fmtDate(trade.date)} · {trade.direction === "Long" ? "Лонг" : "Шорт"}
        </DialogDescription>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant={trade.direction === "Long" ? "long" : "short"}>
            {trade.direction === "Long" ? "Лонг" : "Шорт"}
          </Badge>
          <Badge
            variant={
              trade.status === "open" ? (trade.atBreakeven ? "be" : "open") : "closed"
            }
          >
            {statusLabel}
          </Badge>
        </div>

        <div className="mt-3 rounded-lg border border-border bg-muted/40 px-3">
          <Row label="Дата" value={fmtDate(trade.date)} />
          <Row
            label="Размер счёта"
            value={fmtMoney(trade.accountSize)}
            copy={trade.accountSize}
            copyLabel="размер счёта"
          />
          <Row label="Риск %" value={fmtPct(trade.riskPct, 2)} />
          <Row
            label="Риск $"
            value={fmtMoney(trade.riskUsd)}
            copy={trade.riskUsd}
            copyLabel="риск"
          />
          <Row
            label="Объём $"
            value={fmtMoney(volumeUsd)}
            copy={volumeUsd}
            copyLabel="объём $"
          />
          <Row
            label="Цена открытия"
            value={fmtPrice(trade.entryPrice)}
            copy={trade.entryPrice}
            copyLabel="цену открытия"
          />
          <Row
            label="Цена закрытия"
            value={fmtPrice(trade.stopPrice)}
            copy={trade.stopPrice}
            copyLabel="цену закрытия"
          />
          <Row
            label="Тейк"
            value={fmtPrice(trade.takeProfit)}
            copy={trade.takeProfit}
            copyLabel="тейк"
          />
          <Row label={rr.label} value={fmtR(rr.value)} />
          {trade.realizations.length ? (
            <Row
              label="Зафиксировано"
              value={fmtMoneySigned(trade.realizedPnl)}
              copy={trade.realizedPnl}
              copyLabel="P&L"
              tone={
                trade.realizedPnl > 0
                  ? "text-long"
                  : trade.realizedPnl < 0
                    ? "text-short"
                    : undefined
              }
            />
          ) : null}
        </div>

        {trade.note ? (
          <p className="mt-3 text-sm text-muted-foreground">{trade.note}</p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
