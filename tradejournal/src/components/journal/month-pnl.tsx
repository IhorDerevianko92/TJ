import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { fmtMoneySigned, todayIso } from "@/lib/journal/format";
import {
  daysInMonth,
  mondayIndex,
  monthPnl,
  parseIso,
  pnlByDay,
  toIso,
} from "@/lib/journal/series";
import type { ComputedRow } from "@/lib/journal/types";

const WEEK = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

function monthTitle(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString("ru-RU", {
    month: "long",
    year: "numeric",
  });
}

function cellTone(v: number | undefined) {
  if (v == null || v === 0) return "text-muted-foreground";
  return v > 0 ? "text-long" : "text-short";
}

function cellBg(v: number | undefined) {
  if (v == null || v === 0) return "";
  return v > 0 ? "bg-long-bg/20" : "bg-short-bg/20";
}

export function MonthPnl({ rows }: { rows: ComputedRow[] }) {
  const now = parseIso(todayIso());
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const map = useMemo(() => pnlByDay(rows), [rows]);
  const current = monthPnl(map, now.getFullYear(), now.getMonth());
  const viewed = monthPnl(map, year, month);

  function shift(delta: number) {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  }

  const dim = daysInMonth(year, month);
  const pad = mondayIndex(year, month, 1);
  const cells: (number | null)[] = [
    ...Array.from({ length: pad }, () => null),
    ...Array.from({ length: dim }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setYear(now.getFullYear());
          setMonth(now.getMonth());
          setOpen(true);
        }}
        className="flex w-full flex-col items-start gap-1 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors hover:border-ring"
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Чистая прибыль · {monthTitle(now.getFullYear(), now.getMonth())}
        </span>
        <span
          className={`font-mono text-2xl font-semibold tabular-nums ${
            current > 0 ? "text-long" : current < 0 ? "text-short" : "text-foreground"
          }`}
        >
          {fmtMoneySigned(current)}
        </span>
        <span className="text-xs text-muted-foreground">Нажми — календарь по дням</span>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(100%-1.5rem,26rem)]">
          <DialogTitle>P&L по дням</DialogTitle>
          <DialogDescription>
            Зелёный — плюс за день, красный — минус. Только сделки, без кассы.
          </DialogDescription>

          <div className="mt-3 flex items-center justify-between">
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
              onClick={() => shift(-1)}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeft className="size-4" />
            </button>
            <p className="text-sm font-semibold capitalize">{monthTitle(year, month)}</p>
            <button
              type="button"
              className="flex size-9 items-center justify-center rounded-md hover:bg-muted"
              onClick={() => shift(1)}
              aria-label="Следующий месяц"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <p
            className={`mt-1 text-center font-mono text-lg font-semibold tabular-nums ${
              viewed > 0 ? "text-long" : viewed < 0 ? "text-short" : "text-muted-foreground"
            }`}
          >
            {fmtMoneySigned(viewed)}
          </p>

          <div className="mt-3 grid grid-cols-7 gap-1">
            {WEEK.map((d) => (
              <div
                key={d}
                className="py-1 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
              >
                {d}
              </div>
            ))}
            {cells.map((day, i) => {
              if (!day) return <div key={`e-${i}`} className="h-14" />;
              const iso = toIso(new Date(year, month, day));
              const v = map.get(iso);
              const isToday = iso === todayIso();
              return (
                <div
                  key={iso}
                  className={`flex h-14 flex-col items-center justify-center rounded-md ${cellBg(v)} ${
                    isToday ? "ring-1 ring-ring" : ""
                  }`}
                >
                  <span className="text-[11px] text-muted-foreground">{day}</span>
                  <span className={`font-mono text-[10px] tabular-nums ${cellTone(v)}`}>
                    {v == null || v === 0
                      ? "—"
                      : v.toLocaleString("ru-RU", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
