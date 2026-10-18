import { useMemo, useState } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtMoney } from "@/lib/journal/format";
import {
  RANGE_LABEL,
  buildDailySeries,
  type RangeKey,
} from "@/lib/journal/series";
import type { CashMove, ComputedRow } from "@/lib/journal/types";

const RANGES: RangeKey[] = ["day", "week", "month", "half", "year"];

export function EquityChart({
  startingEquity,
  rows,
  cashMoves,
}: {
  startingEquity: number;
  rows: ComputedRow[];
  cashMoves: CashMove[];
}) {
  const [range, setRange] = useState<RangeKey>("month");
  const [forecast, setForecast] = useState(false);
  const data = useMemo(
    () =>
      buildDailySeries({ startingEquity, rows, cashMoves, range, forecast }),
    [startingEquity, rows, cashMoves, range, forecast],
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Кривая депозита
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
          <button
            type="button"
            onClick={() => setForecast((v) => !v)}
            className={
              forecast
                ? "h-7 rounded-md border border-dashed border-next px-2 text-[11px] font-semibold text-next"
                : "h-7 rounded-md border border-dashed border-border px-2 text-[11px] text-muted-foreground hover:bg-muted"
            }
          >
            Прогноз
          </button>
        </div>
      </div>
      <div className="h-56 w-full">
        {data.length === 0 ? (
          <p className="flex h-full items-center justify-center text-sm text-muted-foreground">
            Пока нет точек — открой первую сделку
          </p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="eq" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-equity)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--color-equity)" stopOpacity={0} />
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
                domain={["auto", "auto"]}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-card)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v, name) => [
                  fmtMoney(Number(v)),
                  String(name) === "forecast" ? "Прогноз" : "Депозит",
                ]}
              />
              <Area
                type="monotone"
                dataKey="equity"
                stroke="var(--color-equity)"
                fill="url(#eq)"
                strokeWidth={2}
                isAnimationActive={false}
              />
              {forecast ? (
                <Line
                  type="monotone"
                  dataKey="forecast"
                  stroke="var(--color-next)"
                  strokeDasharray="5 5"
                  strokeWidth={2}
                  dot={false}
                  isAnimationActive={false}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
