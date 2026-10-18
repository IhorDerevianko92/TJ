import { useMemo, useState, type FormEvent } from "react";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { allocationRoom, computeBooks } from "@/lib/journal/books";
import { fmtMoney, parseNum } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";

export function AmountGear({ book }: { book: "journal" | "forex" | "portfolio" }) {
  const allocate = useJournal((s) => s.allocate);
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const spots = useJournal((s) => s.spots);
  const transfers = useJournal((s) => s.transfers);
  const room = useMemo(() => {
    const books = computeBooks({ startingEquity, trades, cashMoves, spots, transfers });
    const current =
      book === "journal" ? books.journal : book === "forex" ? books.forex : books.portfolioCash;
    return { current, free: books.free, total: books.current, ...allocationRoom(books, book, current) };
  }, [book, startingEquity, trades, cashMoves, spots, transfers]);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const amount = parseNum(value);
  const tooHigh = value.trim() !== "" && amount > room.max + 0.001;
  const tooLow = value.trim() !== "" && amount < room.min - 0.001;
  const title =
    book === "journal" ? "Журнал крипто" : book === "forex" ? "Журнал форекс" : "Кэш портфеля";

  function submit(e: FormEvent) {
    e.preventDefault();
    if (tooHigh || tooLow) return;
    const ok = allocate(book, amount);
    if (!ok) {
      setError(`Больше доступного капитала (${fmtMoney(room.max)}) поставить нельзя.`);
      return;
    }
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label={title}
        className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        onClick={() => {
          setValue(
            room.current.toLocaleString("ru-RU", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }),
          );
          setError("");
          setOpen(true);
        }}
      >
        <Settings className="size-3.5" />
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Общая сумма {fmtMoney(room.total)}. Свободно {fmtMoney(room.free)} — только эти деньги можно дописать сюда.
            Другой журнал при этом не трогается. Сюда можно поставить до {fmtMoney(room.max)}.
            {room.min > 0 ? ` Меньше ${fmtMoney(room.min)} нельзя — сумма уже в риске.` : ""}
          </DialogDescription>
          <form onSubmit={submit} className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor={`alloc-${book}`}>Сумма, $</Label>
              <Input
                id={`alloc-${book}`}
                inputMode="decimal"
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setError("");
                }}
                autoFocus
              />
            </div>
            {tooHigh || error ? (
              <p className="text-sm text-danger">
                {error || `Больше доступного капитала (${fmtMoney(room.max)}).`}
              </p>
            ) : tooLow ? (
              <p className="text-sm text-danger">Меньше {fmtMoney(room.min)} нельзя.</p>
            ) : (
              <p className="text-sm text-muted-foreground">Доступно до {fmtMoney(room.max)}</p>
            )}
            <Button type="submit" disabled={tooHigh || tooLow}>
              Сохранить
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
