import { newId, round2 } from "./engine";
import { todayIso } from "./format";
import { RANGE_DAYS, shiftIso, type RangeKey } from "./series";
import type { CashMove, SpotFill, SpotSide } from "./types";

export type SpotHolding = {
  coin: string;
  qty: number;
  cost: number;
  avgPrice: number;
};

export type LedgerRow = {
  id: string;
  coin: string;
  date: string;
  side: SpotSide;
  usd: number;
  price: number;
  qty: number;
  pnl: number | null;
};

export type PortfolioStats = {
  invested: number;
  realized: number;
  coins: number;
  holdings: SpotHolding[];
  ledger: LedgerRow[];
};

export type PnlPoint = {
  date: string;
  pnl: number;
};

function roundQty(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

export function normalizeFill(raw: Partial<SpotFill> | null | undefined): SpotFill | null {
  if (!raw) return null;
  const coin = String(raw.coin ?? "")
    .trim()
    .toUpperCase()
    .replace(/\s+/g, "");
  const price = Number(raw.price);
  if (!coin || !(price > 0)) return null;
  const side: SpotSide = raw.side === "sell" ? "sell" : "buy";
  const usdIn = Number(raw.usd);
  const qtyIn = Number(raw.qty);
  const qty = qtyIn > 0 ? qtyIn : usdIn > 0 ? usdIn / price : 0;
  const usd = usdIn > 0 ? usdIn : qty * price;
  if (!(qty > 0) || !(usd > 0)) return null;
  return {
    id: raw.id || newId(),
    coin,
    date: raw.date || todayIso(),
    side,
    usd: round2(usd),
    price,
    qty: roundQty(qty),
    note: raw.note ?? "",
    wallet: raw.wallet === "portfolio" ? "portfolio" : "journal",
  };
}

export function computePortfolio(fills: SpotFill[]): PortfolioStats {
  const book = new Map<string, { qty: number; cost: number }>();
  const ledger: LedgerRow[] = [];
  let realized = 0;

  fills.forEach((fill, index) => {
    const coin = fill.coin;
    const slot = book.get(coin) ?? { qty: 0, cost: 0 };
    if (fill.side === "buy") {
      slot.qty = roundQty(slot.qty + fill.qty);
      slot.cost = round2(slot.cost + fill.usd);
      book.set(coin, slot);
      ledger.push({ ...fill, pnl: null });
      return;
    }
    const avg = slot.qty > 0 ? slot.cost / slot.qty : 0;
    const sold = Math.min(fill.qty, slot.qty);
    if (!(sold > 0)) {
      ledger.push({ ...fill, pnl: 0 });
      return;
    }
    const cost = round2(avg * sold);
    const proceeds = round2(fill.price * sold);
    const pnl = round2(proceeds - cost);
    slot.qty = roundQty(slot.qty - sold);
    slot.cost = round2(Math.max(0, slot.cost - cost));
    if (slot.qty <= 1e-8) {
      slot.qty = 0;
      slot.cost = 0;
    }
    book.set(coin, slot);
    realized = round2(realized + pnl);
    ledger.push({
      id: fill.id || `s${index}`,
      coin,
      date: fill.date,
      side: "sell",
      usd: proceeds,
      price: fill.price,
      qty: roundQty(sold),
      pnl,
    });
  });

  const holdings: SpotHolding[] = [];
  let invested = 0;
  for (const [coin, slot] of book) {
    if (!(slot.qty > 0)) continue;
    invested = round2(invested + slot.cost);
    holdings.push({
      coin,
      qty: slot.qty,
      cost: slot.cost,
      avgPrice: slot.qty > 0 ? slot.cost / slot.qty : 0,
    });
  }
  holdings.sort((a, b) => b.cost - a.cost || a.coin.localeCompare(b.coin));

  return { invested, realized, coins: holdings.length, holdings, ledger };
}

export function holdingOf(stats: PortfolioStats, coin: string) {
  return stats.holdings.find((h) => h.coin === coin) ?? null;
}

/** Money leaving or returning to the journal balance. Buy is negative. */
export function spotCashMoves(fills: SpotFill[]): CashMove[] {
  return fills.map((f) => ({
    id: `spot:${f.id}`,
    date: f.date,
    amount: f.side === "buy" ? -round2(f.usd) : round2(f.usd),
    note: f.side === "buy" ? `Покупка ${f.coin}` : `Продажа ${f.coin}`,
  }));
}

/** Cumulative realized P&L. Flat at 0 until the first sale, then steps. */
export function buildPnlSeries(ledger: LedgerRow[], range: RangeKey): PnlPoint[] {
  const sales = ledger.filter((r) => r.side === "sell" && r.pnl != null && r.date);
  const today = todayIso();
  const start = shiftIso(today, -(RANGE_DAYS[range] - 1));
  let base = 0;
  const day = new Map<string, number>();
  for (const s of sales) {
    const pnl = s.pnl ?? 0;
    if (s.date < start) base = round2(base + pnl);
    else day.set(s.date, round2((day.get(s.date) ?? 0) + pnl));
  }
  const points: PnlPoint[] = [];
  let cursor = start;
  let cum = base;
  while (cursor <= today) {
    if (day.has(cursor)) cum = round2(cum + (day.get(cursor) ?? 0));
    points.push({ date: cursor, pnl: cum });
    cursor = shiftIso(cursor, 1);
  }
  return points;
}
