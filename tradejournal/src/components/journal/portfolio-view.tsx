import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Area, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDelete } from "@/components/journal/confirm-delete";
import { CopyButton } from "@/components/journal/copy-button";
import { fmtDate, fmtMoney, fmtMoneySigned, fmtPrice, fmtVolume, parseNum, todayIso } from "@/lib/journal/format";
import { buildPnlSeries, computePortfolio, type SpotHolding } from "@/lib/journal/portfolio";
import { AmountGear } from "@/components/journal/amount-gear";
import { computeBooks } from "@/lib/journal/books";
import { RANGE_LABEL, type RangeKey } from "@/lib/journal/series";
import { useJournal } from "@/lib/journal/store";

const RANGES: RangeKey[] = ["day", "week", "month", "half", "year"];

function Stat({
  label,
  value,
  tone = "default",
  hint,
  action,
}: {
  label: string;
  value: string;
  tone?: "default" | "up" | "down";
  hint?: string;
  action?: ReactNode;
}) {
  const color =
    tone === "up" ? "text-equity" : tone === "down" ? "text-danger" : "text-foreground";
  return (
    <div className="relative flex min-w-0 flex-col gap-1 rounded-lg border border-border bg-card px-3 py-2.5">
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

function BuyForm({ active, onDone }: { active: boolean; onDone: () => void }) {
  const buySpot = useJournal((s) => s.buySpot);
  const cash = useJournal((s) =>
    computeBooks({
      startingEquity: s.startingEquity,
      trades: s.trades,
      cashMoves: s.cashMoves,
      spots: s.spots,
      transfers: s.transfers,
    }).portfolioCash,
  );
  const [coin, setCoin] = useState("");
  const [date, setDate] = useState(todayIso);
  const [usd, setUsd] = useState("");
  const [price, setPrice] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!active) return;
    setCoin("");
    setDate(todayIso());
    setUsd("");
    setPrice("");
    setError("");
  }, [active]);

  const sum = parseNum(usd);
  const px = parseNum(price);
  const qty = px > 0 && sum > 0 ? sum / px : 0;
  const over = sum > cash + 0.009;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!coin.trim() || !(sum > 0) || !(px > 0)) return;
    const ok = buySpot({ coin, date: date || todayIso(), usd: sum, price: px });
    if (!ok) {
      setError("На портфеле не хватает кэша. Сумму задаёт шестерёнка на карточке «Кэш».");
      return;
    }
    onDone();
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-next">Спот</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Купить</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Списывается только кэш портфеля, не журнал. Сейчас доступно {fmtMoney(cash)}.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="spot-coin">Монета</Label>
          <Input
            id="spot-coin"
            value={coin}
            onChange={(e) => setCoin(e.target.value)}
            placeholder="ETH"
            required
            autoFocus
            className="h-11 uppercase"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="spot-date">Дата</Label>
          <Input
            id="spot-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="spot-usd">Сумма, $</Label>
          <Input
            id="spot-usd"
            inputMode="decimal"
            value={usd}
            onChange={(e) => setUsd(e.target.value)}
            placeholder="500"
            required
            className="h-11"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="spot-price">Цена</Label>
          <Input
            id="spot-price"
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="2635,51"
            required
            className="h-11"
          />
        </div>
        <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Количество: <span className="font-mono text-foreground">{qty > 0 ? fmtVolume(qty) : "—"}</span>
          </p>
          <Button type="submit" disabled={!(sum > 0) || !(px > 0) || !coin.trim() || over}>
            Купить
          </Button>
        </div>
        {over || error ? (
          <p className="sm:col-span-2 text-sm text-danger">
            {over
              ? `Больше, чем кэш портфеля (${fmtMoney(cash)}).`
              : error}
          </p>
        ) : null}
      </form>
    </section>
  );
}

function PnlChart() {
  const spots = useJournal((s) => s.spots);
  const [range, setRange] = useState<RangeKey>("month");
  const data = useMemo(() => buildPnlSeries(computePortfolio(spots).ledger, range), [spots, range]);
  const last = data.length ? data[data.length - 1].pnl : 0;
  const up = last >= 0;
  const stroke = up ? "var(--color-equity)" : "var(--color-danger)";
  const sold = data.some((p, i) => i > 0 && p.pnl !== data[0]?.pnl) || last !== 0;

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Прибыль после продаж
        </p>
        <div className="flex flex-wrap items-center justify-end gap-1">
          {RANGES.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setRange(key)}
              className={
                range === key
                  ? "h-7 rounded-md bg-primary px-2 text-[11px] font-semibold text-primary-foreground"
                  : "h-7 rounded-md px-2 text-[11px] text-muted-foreground hover:bg-muted"
              }
            >
              {RANGE_LABEL[key]}
            </button>
          ))}
        </div>
      </div>
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="spotPnl" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={stroke} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={stroke} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 10 }}
                interval="preserveStartEnd"
                tickFormatter={(v) => String(v).slice(8)}
              />
              <YAxis
                width={72}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
                tickFormatter={(v) =>
                  Number(v).toLocaleString("ru-RU", { maximumFractionDigits: 0 })
                }
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v) => [fmtMoneySigned(Number(v)), up ? "Прибыль" : "Убыток"]}
                labelFormatter={(v) => fmtDate(String(v))}
              />
              <Area
                type="stepAfter"
                dataKey="pnl"
                stroke={stroke}
                fill="url(#spotPnl)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
      </div>
      {!sold ? (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Линия на нуле, пока монету не продашь. Покупка график не двигает.
        </p>
      ) : null}
    </div>
  );
}

function SellDialog({
  holding,
  onClose,
}: {
  holding: SpotHolding | null;
  onClose: () => void;
}) {
  const sellSpot = useJournal((s) => s.sellSpot);
  const [date, setDate] = useState(todayIso);
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  useEffect(() => {
    if (!holding) return;
    setDate(todayIso());
    setQty(String(holding.qty).replace(".", ","));
    setPrice("");
  }, [holding]);

  if (!holding) return null;
  const q = parseNum(qty);
  const px = parseNum(price);
  const tooMuch = q > holding.qty + 1e-8;
  const proceeds = q > 0 && px > 0 ? q * px : 0;
  const pnl = proceeds > 0 ? proceeds - holding.avgPrice * Math.min(q, holding.qty) : 0;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!holding || !(q > 0) || !(px > 0) || tooMuch) return;
    sellSpot({ coin: holding.coin, date: date || todayIso(), qty: q, price: px });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-xl border border-border bg-card p-5 shadow-xl"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-next">Продать</p>
            <h2 className="mt-1 text-xl font-semibold">{holding.coin}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              В портфеле {fmtVolume(holding.qty)} · средняя {fmtPrice(holding.avgPrice)}.
              Деньги вернутся на тот счёт, с которого куплена монета.
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-muted-foreground hover:bg-muted" aria-label="Закрыть">
            <X className="size-4" />
          </button>
        </div>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="sell-date">Дата</Label>
            <Input id="sell-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sell-qty">Количество</Label>
            <Input id="sell-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="h-11" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="sell-price">Цена продажи</Label>
            <Input id="sell-price" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Цена" className="h-11" required />
          </div>
          {tooMuch ? (
            <p className="text-sm text-danger">Больше, чем есть в портфеле.</p>
          ) : proceeds > 0 ? (
            <p className="text-sm text-muted-foreground">
              Получишь {fmtMoney(proceeds)} ·{" "}
              <span className={pnl >= 0 ? "text-equity" : "text-danger"}>{fmtMoneySigned(pnl)}</span>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={!(q > 0) || !(px > 0) || tooMuch}>Продать</Button>
          </div>
        </div>
      </form>
    </div>
  );
}

export function PortfolioView({ buying, onDone }: { buying: boolean; onDone: () => void }) {
  const spots = useJournal((s) => s.spots);
  const deleteSpot = useJournal((s) => s.deleteSpot);
  const portfolioCash = useJournal((s) =>
    computeBooks({
      startingEquity: s.startingEquity,
      trades: s.trades,
      cashMoves: s.cashMoves,
      spots: s.spots,
      transfers: s.transfers,
    }).portfolioCash,
  );
  const stats = useMemo(() => computePortfolio(spots), [spots]);
  const [sell, setSell] = useState<SpotHolding | null>(null);
  const [kill, setKill] = useState<string | null>(null);
  const tone = stats.realized > 0 ? "up" : stats.realized < 0 ? "down" : "default";

  return (
    <>
      <div className="relative overflow-hidden">
        <div
          className={
            buying
              ? "pointer-events-none absolute inset-x-0 top-0 -translate-y-2 opacity-0"
              : "translate-y-0 opacity-100"
          }
          aria-hidden={buying}
          inert={buying || undefined}
        >
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
            <Stat
              label="Кэш"
              value={fmtMoney(portfolioCash)}
              hint="можно потратить на покупку"
              action={<AmountGear book="portfolio" />}
            />
            <Stat label="Вложено" value={fmtMoney(stats.invested)} hint="сумма открытых монет" />
            <Stat label="Монет" value={String(stats.coins)} hint="сейчас в портфеле" />
            <Stat
              label="Прибыль"
              value={fmtMoneySigned(stats.realized)}
              tone={tone}
              hint="только после продаж"
            />
          </div>
          <div className="mt-4">
            <PnlChart />
          </div>
        </div>
        <div
          className={
            buying
              ? "relative translate-y-0 opacity-100"
              : "pointer-events-none absolute inset-x-0 top-0 translate-y-2 opacity-0"
          }
          aria-hidden={!buying}
          inert={!buying || undefined}
        >
          <BuyForm active={buying} onDone={onDone} />
        </div>
      </div>

      <section className="mt-5">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Монеты
        </h2>
        {stats.holdings.length === 0 ? (
          <div className="rounded-xl border border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
            Портфель пуст. Деньги для покупок переводятся во вкладке «Общее», потом «Купить».
          </div>
        ) : (
          <div className="grid gap-3">
            {stats.holdings.map((h) => (
              <article key={h.coin} className="rounded-xl border border-border bg-card p-3">
                <header className="mb-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold">{h.coin}</h3>
                    <span className="rounded-full bg-open-bg px-2 py-0.5 text-[11px] font-semibold text-open">
                      Спот
                    </span>
                  </div>
                  <Button size="sm" onClick={() => setSell(h)}>
                    Продать
                  </Button>
                </header>
                <div className="grid grid-cols-3 gap-2">
                  <Metric label="Сумма" value={fmtMoney(h.cost)} copy={h.cost} />
                  <Metric label="Цена" value={fmtPrice(h.avgPrice)} copy={h.avgPrice} />
                  <Metric label="Кол-во" value={fmtVolume(h.qty)} copy={h.qty} />
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {stats.ledger.length > 0 ? (
        <section className="mt-5">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted-foreground">
            История
          </h2>
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Дата</th>
                  <th className="px-3 py-2 font-medium">Монета</th>
                  <th className="px-3 py-2 font-medium">Тип</th>
                  <th className="px-3 py-2 font-medium">Сумма</th>
                  <th className="px-3 py-2 font-medium">Цена</th>
                  <th className="px-3 py-2 font-medium">Итог</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {[...stats.ledger].reverse().map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-3 py-2 font-mono text-xs">{fmtDate(row.date)}</td>
                    <td className="px-3 py-2 font-medium">{row.coin}</td>
                    <td className="px-3 py-2">{row.side === "buy" ? "Покупка" : "Продажа"}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtMoney(row.usd)}</td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtPrice(row.price)}</td>
                    <td className={`px-3 py-2 font-mono text-xs ${row.pnl == null ? "text-muted-foreground" : row.pnl >= 0 ? "text-equity" : "text-danger"}`}>
                      {row.pnl == null ? "—" : fmtMoneySigned(row.pnl)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="text-xs text-muted-foreground hover:text-danger"
                        onClick={() => setKill(row.id)}
                      >
                        Удалить
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <SellDialog holding={sell} onClose={() => setSell(null)} />
      <ConfirmDelete
        open={kill != null}
        title="Запись исчезнет из портфеля. Прибыль пересчитается."
        onCancel={() => setKill(null)}
        onConfirm={() => {
          if (kill) deleteSpot(kill);
          setKill(null);
        }}
      />
    </>
  );
}

function Metric({ label, value, copy }: { label: string; value: string; copy?: number }) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-muted/50 px-2.5 py-2">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="truncate font-mono text-sm tabular-nums">{value}</p>
      </div>
      {copy != null ? <CopyButton value={copy} label={label} /> : null}
    </div>
  );
}
