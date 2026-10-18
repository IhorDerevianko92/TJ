import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";
import { Settings } from "lucide-react";
import { AmountGear } from "@/components/journal/amount-gear";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { computeBooks } from "@/lib/journal/books";
import { fmtMoney, fmtMoneySigned, fmtPct, parseNum } from "@/lib/journal/format";
import { useJournal } from "@/lib/journal/store";

function Stat({
  label,
  value,
  hint,
  tone = "default",
  action,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "up" | "down";
  action?: ReactNode;
}) {
  const color =
    tone === "up" ? "text-long" : tone === "down" ? "text-short" : "text-foreground";
  return (
    <div className="relative flex min-h-[76px] min-w-0 flex-col justify-center gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
      {action ? <div className="absolute right-1.5 top-1.5">{action}</div> : null}
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className={`font-mono text-lg font-semibold tabular-nums leading-none ${color}`}>
        {value}
      </span>
      {hint ? <span className="truncate text-[11px] text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

const SLICES = [
  { key: "crypto", name: "Крипто", color: "#8b5cc7" },
  { key: "forex", name: "Форекс", color: "#3dcc8a" },
  { key: "spot", name: "Портфель", color: "#f0c14b" },
] as const;

function ProfitSplit({
  crypto,
  forex,
  spot,
}: {
  crypto: number;
  forex: number;
  spot: number;
}) {
  const amounts = { crypto, forex, spot };
  const parts = SLICES.map((slice) => ({ ...slice, value: amounts[slice.key] }));
  const abs = parts.reduce((sum, part) => sum + Math.abs(part.value), 0);
  const rows = parts.map((part) => ({
    ...part,
    abs: Math.abs(part.value),
    pct: abs > 0 ? (Math.abs(part.value) / abs) * 100 : 0,
  }));
  const chart = rows.filter((part) => part.abs > 0.004);
  const data = chart.length > 0 ? chart : [{ key: "empty", name: "Нет", color: "#2c2238", value: 0, abs: 1, pct: 0 }];

  return (
    <div className="flex items-center gap-3">
      <div className="h-[116px] w-[116px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="abs"
              nameKey="name"
              innerRadius={36}
              outerRadius={54}
              paddingAngle={chart.length > 1 ? 2 : 0}
              stroke="none"
              isAnimationActive={false}
            >
              {data.map((part) => (
                <Cell key={part.key} fill={part.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="grid gap-1.5 text-sm">
        {rows.map((part) => (
          <li key={part.key} className="flex items-center gap-2">
            <span className="size-2 shrink-0 rounded-full" style={{ background: part.color }} />
            <span className="text-muted-foreground">{part.name}</span>
            <span className="font-mono tabular-nums">{fmtPct(part.pct, 0)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Overview() {
  const startingEquity = useJournal((s) => s.startingEquity);
  const trades = useJournal((s) => s.trades);
  const cashMoves = useJournal((s) => s.cashMoves);
  const spots = useJournal((s) => s.spots);
  const transfers = useJournal((s) => s.transfers);
  const setStartingEquity = useJournal((s) => s.setStartingEquity);
  const [startOpen, setStartOpen] = useState(false);
  const [startValue, setStartValue] = useState("");

  function saveStart(e: FormEvent) {
    e.preventDefault();
    const n = parseNum(startValue);
    if (!(n > 0)) return;
    setStartingEquity(n);
    setStartOpen(false);
  }

  const books = useMemo(
    () => computeBooks({ startingEquity, trades, cashMoves, spots, transfers }),
    [startingEquity, trades, cashMoves, spots, transfers],
  );

  const profitTone = books.netPnl > 0 ? "up" : books.netPnl < 0 ? "down" : "default";
  const tone = (n: number) => (n > 0 ? "up" : n < 0 ? "down" : "default") as "up" | "down" | "default";

  return (
    <div className="grid gap-2">
      <section className="flex flex-col gap-4 rounded-lg border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="grid gap-1">
          <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Чистая прибыль
          </span>
          <span
            className={`font-mono text-3xl font-semibold tabular-nums leading-none ${
              profitTone === "up" ? "text-long" : profitTone === "down" ? "text-short" : "text-foreground"
            }`}
          >
            {fmtMoneySigned(books.netPnl)}
          </span>
          <span className="text-[11px] text-muted-foreground">откуда пришла, в процентах</span>
        </div>
        <ProfitSplit crypto={books.cryptoPnl} forex={books.forexPnl} spot={books.spotPnl} />
      </section>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Stat
          label="Начальный капитал"
          value={fmtMoney(books.starting)}
          hint="отсюда раскладываются счета"
          action={
            <button
              type="button"
              aria-label="Изменить начальный капитал"
              className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => {
                setStartValue(
                  books.starting.toLocaleString("ru-RU", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }),
                );
                setStartOpen(true);
              }}
            >
              <Settings className="size-3.5" />
            </button>
          }
        />
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border">
          <div className="flex min-w-0 flex-col justify-center gap-1 bg-card px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Текущий
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums leading-none text-long">
              {fmtMoney(books.current)}
            </span>
          </div>
          <div className="flex min-w-0 flex-col justify-center gap-1 bg-card px-3 py-2.5">
            <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Свободный
            </span>
            <span className="font-mono text-lg font-semibold tabular-nums leading-none">
              {fmtMoney(books.free)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <Stat
          label="Крипто"
          value={fmtMoney(books.journal)}
          hint={books.openRisk > 0 ? `в риске ${fmtMoney(books.openRisk)}` : "доля общей суммы"}
          action={<AmountGear book="journal" />}
        />
        <Stat label="Прибыль крипто" value={fmtMoneySigned(books.cryptoPnl)} tone={tone(books.cryptoPnl)} />
        <Stat
          label="Форекс"
          value={fmtMoney(books.forex)}
          hint="доля общей суммы"
          action={<AmountGear book="forex" />}
        />
        <Stat label="Прибыль форекс" value={fmtMoneySigned(books.forexPnl)} tone={tone(books.forexPnl)} />
        <Stat
          label="Портфель"
          value={fmtMoney(books.portfolioCash)}
          hint={
            books.portfolioInvested > 0
              ? `в монетах ${fmtMoney(books.portfolioInvested)}`
              : "кэш на покупки"
          }
          action={<AmountGear book="portfolio" />}
        />
        <Stat label="Прибыль портфеля" value={fmtMoneySigned(books.spotPnl)} tone={tone(books.spotPnl)} />
      </section>

      <Dialog open={startOpen} onOpenChange={setStartOpen}>
        <DialogContent>
          <DialogTitle>Начальный капитал</DialogTitle>
          <DialogDescription>
            Вся сумма. Крипто, форекс и портфель получают из неё только свою долю.
          </DialogDescription>
          <form onSubmit={saveStart} className="mt-4 grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="start-eq">Сумма, $</Label>
              <Input
                id="start-eq"
                inputMode="decimal"
                value={startValue}
                onChange={(e) => setStartValue(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit">Сохранить</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
