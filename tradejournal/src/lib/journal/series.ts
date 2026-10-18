import { round2 } from "./engine";
import { todayIso } from "./format";
import type { CashMove, ComputedRow } from "./types";

export type RangeKey = "day" | "week" | "month" | "half" | "year";

export const RANGE_DAYS: Record<RangeKey, number> = {
  day: 1,
  week: 7,
  month: 30,
  half: 182,
  year: 365,
};

export const RANGE_LABEL: Record<RangeKey, string> = {
  day: "День",
  week: "Неделя",
  month: "Месяц",
  half: "Полгода",
  year: "Год",
};

export function shiftIso(iso: string, days: number) {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toIso(d);
}

export function parseIso(iso: string) {
  const [y, m, day] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, day || 1);
}

export function toIso(d: Date) {
  const z = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

/** Monday=0 … Sunday=6 */
export function mondayIndex(year: number, month: number, day: number) {
  const wd = new Date(year, month, day).getDay();
  return wd === 0 ? 6 : wd - 1;
}

export function pnlByDay(rows: ComputedRow[]) {
  const map = new Map<string, number>();
  for (const t of rows) {
    for (const r of t.realizations) {
      if (!r.date || !r.amount) continue;
      map.set(r.date, round2((map.get(r.date) ?? 0) + r.amount));
    }
  }
  return map;
}

export function monthPnl(map: Map<string, number>, year: number, month: number) {
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  let sum = 0;
  for (const [date, v] of map) {
    if (date.startsWith(prefix)) sum += v;
  }
  return round2(sum);
}

export type DayPoint = {
  date: string;
  label: string;
  equity: number | null;
  forecast: number | null;
  pnl: number;
};

export function buildDailySeries(input: {
  startingEquity: number;
  rows: ComputedRow[];
  cashMoves: CashMove[];
  range: RangeKey;
  forecast: boolean;
}): DayPoint[] {
  const today = todayIso();
  const span = RANGE_DAYS[input.range];
  const start = shiftIso(today, -(span - 1));
  const pnlMap = pnlByDay(input.rows);
  const cashMap = new Map<string, number>();
  for (const c of input.cashMoves) {
    cashMap.set(c.date, round2((cashMap.get(c.date) ?? 0) + c.amount));
  }

  const firstEvent = earliestDate(input.rows, input.cashMoves) ?? start;
  const histStart = firstEvent < start ? firstEvent : start;

  let equity = input.startingEquity;
  let cursor = histStart < today ? histStart : today;
  const byDate = new Map<string, number>();
  while (cursor <= today) {
    equity = round2(
      equity + (pnlMap.get(cursor) ?? 0) + (cashMap.get(cursor) ?? 0),
    );
    byDate.set(cursor, equity);
    cursor = shiftIso(cursor, 1);
  }

  const actual: DayPoint[] = [];
  cursor = start;
  let last = byDate.get(start) ?? input.startingEquity;
  while (cursor <= today) {
    if (byDate.has(cursor)) last = byDate.get(cursor)!;
    actual.push({
      date: cursor,
      label: cursor.slice(8),
      equity: last,
      forecast: null,
      pnl: pnlMap.get(cursor) ?? 0,
    });
    cursor = shiftIso(cursor, 1);
  }

  if (!input.forecast || actual.length === 0) return actual;

  const histDays = Math.max(1, isoDiff(firstEvent, today));
  const totalPnl = round2([...pnlMap.values()].reduce((s, v) => s + v, 0));
  const avgDaily = totalPnl / histDays;
  const base = actual[0].equity ?? input.startingEquity;
  const rate = base > 0 ? avgDaily / base : 0;
  const safeRate = Math.max(-0.05, Math.min(0.05, rate));

  return actual.map((p, i) => ({
    ...p,
    forecast: round2((actual[0].equity ?? input.startingEquity) * (1 + safeRate) ** i),
  }));
}

function earliestDate(rows: ComputedRow[], cash: CashMove[]) {
  let min: string | null = null;
  for (const t of rows) {
    if (t.date && (!min || t.date < min)) min = t.date;
    for (const r of t.realizations) {
      if (r.date && (!min || r.date < min)) min = r.date;
    }
  }
  for (const c of cash) {
    if (c.date && (!min || c.date < min)) min = c.date;
  }
  return min;
}

function isoDiff(a: string, b: string) {
  return Math.max(1, Math.round((parseIso(b).getTime() - parseIso(a).getTime()) / 86400000));
}
