import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { todayIso } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";

export function CashForm({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const addCash = useJournal((s) => s.addCash);
  const [kind, setKind] = useState<"in" | "out">("in");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(todayIso());

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(amount);
    if (!n) return;
    addCash({
      date,
      amount: kind === "out" ? -Math.abs(n) : Math.abs(n),
      note: note.trim() || (kind === "in" ? "пополнение" : "вывод"),
    });
    setAmount("");
    setNote("");
    setDate(todayIso());
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>Касса</DialogTitle>
        <DialogDescription>
          Пополнение или вывод меняют текущий депозит сразу. Следующая сделка
          возьмёт 1% уже от новой «доступно».
        </DialogDescription>
        <form onSubmit={submit} className="mt-4 grid gap-3">
          <div className="grid grid-cols-2 gap-1">
            <button
              type="button"
              onClick={() => setKind("in")}
              className={
                kind === "in"
                  ? "h-10 rounded-md bg-long-bg text-sm font-semibold text-long"
                  : "h-10 rounded-md border border-border text-sm text-muted-foreground"
              }
            >
              Пополнить
            </button>
            <button
              type="button"
              onClick={() => setKind("out")}
              className={
                kind === "out"
                  ? "h-10 rounded-md bg-short-bg text-sm font-semibold text-short"
                  : "h-10 rounded-md border border-border text-sm text-muted-foreground"
              }
            >
              Вывести
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="camt">Сумма $</Label>
              <Input
                id="camt"
                type="number"
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="cdate">Дата</Label>
              <Input
                id="cdate"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="cwhy">На что / зачем</Label>
            <Input
              id="cwhy"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="зп, вывод на карту, перевод..."
              required
            />
          </div>
          <Button type="submit" className="w-full">
            {kind === "in" ? "Зачислить" : "Списать"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
