import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { round2 } from "@/lib/journal/engine";
import {
  fmtMoney,
  fmtMoneySigned,
  parseNum,
  todayIso,
} from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";
import type { ComputedRow } from "@/lib/journal/types";

export function CloseTradeForm({
  trade,
  onClose,
}: {
  trade: ComputedRow | null;
  onClose: () => void;
}) {
  const addRealization = useJournal((s) => s.addRealization);
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso);

  useEffect(() => {
    if (!trade) return;
    setAmount("0");
    setNote("");
    setDate(todayIso());
  }, [trade?.id]);

  if (!trade) return null;

  const enteredTotal = parseNum(amount);
  const takeDelta =
    enteredTotal === 0 ? 0 : round2(enteredTotal - trade.realizedPnl);

  function applyTake() {
    if (!trade) return;
    addRealization({
      tradeId: trade.id,
      amount: takeDelta,
      note: note.trim() || "тейк",
      date: date || todayIso(),
      moveToBe: true,
      close: false,
    });
    onClose();
  }

  function applyStop() {
    if (!trade) return;
    addRealization({
      tradeId: trade.id,
      amount: -trade.remainingRiskUsd,
      note: note.trim() || "стоп",
      date: date || todayIso(),
      moveToBe: true,
      close: true,
    });
    onClose();
  }

  function applyClose() {
    if (!trade) return;
    addRealization({
      tradeId: trade.id,
      amount: takeDelta,
      note: note.trim() || "закрытие",
      date: date || todayIso(),
      moveToBe: true,
      close: true,
    });
    onClose();
  }

  return (
    <Dialog open={!!trade} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogTitle>{trade.pair}</DialogTitle>
        <DialogDescription>
          Риск {fmtMoney(trade.riskUsd)}
          {trade.atBreakeven
            ? " · уже в безубытке"
            : ` · в риске ${fmtMoney(trade.remainingRiskUsd)}`}
          . Пиши итоговую сумму тейков.
        </DialogDescription>

        {trade.realizations.length > 0 ? (
          <ul className="mt-3 space-y-1 rounded-md border border-border bg-muted px-3 py-2 text-xs">
            {trade.realizations.map((r) => (
              <li key={r.id} className="flex justify-between gap-2">
                <span className="text-muted-foreground">
                  {r.kind === "partial" ? "тейк" : "стоп"}
                  {r.note ? ` · ${r.note}` : ""}
                </span>
                <span className="font-mono tabular-nums">
                  {fmtMoneySigned(r.amount)}
                </span>
              </li>
            ))}
            <li className="flex justify-between border-t border-border pt-1 font-medium">
              <span>Уже зафиксировано</span>
              <span className="font-mono">{fmtMoneySigned(trade.realizedPnl)}</span>
            </li>
          </ul>
        ) : null}

        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            applyTake();
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <div className="grid gap-1.5">
              <Label htmlFor="pnl">Итого тейк, $</Label>
              <Input
                id="pnl"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="close-date">Дата</Label>
              <Input
                id="close-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
                className="scheme-dark"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button
              type="submit"
              className="h-11 bg-long text-primary-foreground hover:bg-long/90"
            >
              Тейк профит
            </Button>
            <Button type="button" variant="destructive" className="h-11" onClick={applyStop}>
              Стоп лосс
            </Button>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="cnote">Комментарий</Label>
            <Input
              id="cnote"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="необязательно"
            />
          </div>

          <Button type="button" variant="outline" className="h-11 w-full" onClick={applyClose}>
            Закрыть сделку
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
