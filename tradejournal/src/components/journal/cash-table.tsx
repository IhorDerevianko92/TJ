import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDelete } from "@/components/journal/confirm-delete";
import { fmtDate, fmtMoneySigned } from "@/lib/journal/format";
import { forexTransferMoves, journalCashMoves } from "@/lib/journal/books";
import { useJournal } from "@/lib/journal/store";
import type { CashMove } from "@/lib/journal/types";

function moveKind(c: CashMove) {
  if (c.id.startsWith("xfer:")) return "Перевод";
  if (c.id.startsWith("spot:")) return c.amount >= 0 ? "Продажа" : "Покупка";
  return c.amount >= 0 ? "Пополнение" : "Вывод";
}

export function CashTable({ book = "journal" }: { book?: "journal" | "forex" }) {
  const cashMoves = useJournal((s) => s.cashMoves);
  const spots = useJournal((s) => s.spots);
  const transfers = useJournal((s) => s.transfers);
  const deleteCash = useJournal((s) => s.deleteCash);
  const [kill, setKill] = useState<CashMove | null>(null);
  const rows = (book === "forex" ? forexTransferMoves(transfers) : journalCashMoves(cashMoves, spots, transfers)).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="bg-header text-header-foreground">
            {["Дата", "Тип", "Сумма", "Комментарий", ""].map((h) => (
              <th
                key={h}
                className="px-2.5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                Касса пустая.{book === "forex" ? " Перевод делается во вкладке «Общее»." : ""}
              </td>
            </tr>
          ) : (
            rows.map((c) => (
              <tr
                key={c.id}
                className="border-t border-border bg-card odd:bg-card even:bg-row-alt"
              >
                <td className="whitespace-nowrap px-2.5 py-2 font-mono text-xs tabular-nums text-muted-foreground">
                  {fmtDate(c.date)}
                </td>
                <td className="px-2.5 py-2">{moveKind(c)}</td>
                <td
                  className={`px-2.5 py-2 font-mono tabular-nums ${
                    c.amount >= 0 ? "text-long" : "text-short"
                  }`}
                >
                  {fmtMoneySigned(c.amount)}
                </td>
                <td className="px-2.5 py-2">{c.note || "—"}</td>
                <td className="px-2.5 py-2">
                  {c.id.startsWith("spot:") || c.id.startsWith("xfer:") ? (
                    <span className="text-xs text-muted-foreground">
                      {c.id.startsWith("xfer:") ? "из общего" : "из портфеля"}
                    </span>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setKill(c)}
                    >
                      ×
                    </Button>
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <ConfirmDelete
        open={!!kill}
        title={kill ? `Запись кассы «${kill.note || "без комментария"}» будет удалена.` : ""}
        onCancel={() => setKill(null)}
        onConfirm={() => {
          if (kill) deleteCash(kill.id);
          setKill(null);
        }}
      />
    </div>
  );
}
