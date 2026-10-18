import { computeJournal, realizedPnlOf, round2 } from "./engine";
import type { BookId, CashMove, SpotFill, Trade, Transfer } from "./types";

export const BOOK_LABEL: Record<BookId, string> = {
  free: "Свободные",
  journal: "Крипто",
  forex: "Форекс",
  portfolio: "Портфель",
};

export type BookSnapshot = {
  starting: number;
  journal: number;
  journalFree: number;
  openRisk: number;
  free: number;
  portfolioCash: number;
  portfolioInvested: number;
  journalInvested: number;
  forex: number;
  forexFree: number;
  forexOpenRisk: number;
  current: number;
  cryptoPnl: number;
  forexPnl: number;
  tradePnl: number;
  spotPnl: number;
  netPnl: number;
};

function roundQty(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 1e8) / 1e8;
}

export function normalizeTransfer(raw: Partial<Transfer> | null | undefined): Transfer | null {
  if (!raw) return null;
  const from = raw.from;
  const to = raw.to;
  const books: BookId[] = ["free", "journal", "portfolio", "forex"];
  if (!from || !to || !books.includes(from) || !books.includes(to) || from === to) return null;
  const amount = round2(Number(raw.amount));
  if (!(amount > 0)) return null;
  return {
    id: raw.id || "",
    date: raw.date || "",
    from,
    to,
    amount,
    note: raw.note ?? "",
    status: "done",
  };
}

export function journalTransferMoves(transfers: Transfer[]): CashMove[] {
  return transfers
    .filter((t) => t.from === "journal" || t.to === "journal")
    .map((t) => ({
      id: `xfer:${t.id}`,
      date: t.date,
      amount: t.to === "journal" ? t.amount : -t.amount,
      note: `Перевод ${BOOK_LABEL[t.from]} → ${BOOK_LABEL[t.to]}`,
    }));
}

export function forexTransferMoves(transfers: Transfer[]): CashMove[] {
  return transfers
    .filter((t) => t.from === "forex" || t.to === "forex")
    .map((t) => ({
      id: `xfer:${t.id}`,
      date: t.date,
      amount: t.to === "forex" ? t.amount : -t.amount,
      note: `Перевод ${BOOK_LABEL[t.from]} → ${BOOK_LABEL[t.to]}`,
    }));
}

/** Cash that stays on the journal, plus portfolio cash and leftover coin cost. */
export function spotWalletCash(fills: SpotFill[]): {
  journalMoves: CashMove[];
  portfolioCash: number;
  portfolioInvested: number;
  journalInvested: number;
} {
  type Lot = { coin: string; qty: number; usdLeft: number; wallet: "journal" | "portfolio" };
  const lots: Lot[] = [];
  const journalMoves: CashMove[] = [];
  let portfolioCash = 0;

  fills.forEach((fill, index) => {
    const wallet = fill.wallet === "portfolio" ? "portfolio" : "journal";
    if (fill.side === "buy") {
      lots.push({ coin: fill.coin, qty: fill.qty, usdLeft: fill.usd, wallet });
      if (wallet === "journal") {
        journalMoves.push({
          id: `spot:${fill.id}`,
          date: fill.date,
          amount: -round2(fill.usd),
          note: `Покупка ${fill.coin}`,
        });
      } else {
        portfolioCash = round2(portfolioCash - fill.usd);
      }
      return;
    }
    let left = fill.qty;
    for (const lot of lots) {
      if (lot.coin !== fill.coin || lot.qty <= 1e-12 || left <= 1e-12) continue;
      const take = Math.min(lot.qty, left);
      const share = lot.qty > 0 ? take / lot.qty : 0;
      const cost = round2(lot.usdLeft * share);
      const proceeds = round2(fill.usd * (fill.qty > 0 ? take / fill.qty : 0));
      lot.qty = roundQty(lot.qty - take);
      lot.usdLeft = round2(Math.max(0, lot.usdLeft - cost));
      left -= take;
      if (lot.wallet === "journal") {
        journalMoves.push({
          id: `spot:${fill.id}:j:${index}:${journalMoves.length}`,
          date: fill.date,
          amount: proceeds,
          note: `Продажа ${fill.coin}`,
        });
      } else {
        portfolioCash = round2(portfolioCash + proceeds);
      }
    }
  });

  let portfolioInvested = 0;
  let journalInvested = 0;
  for (const lot of lots) {
    if (!(lot.qty > 1e-8)) continue;
    if (lot.wallet === "portfolio") portfolioInvested = round2(portfolioInvested + lot.usdLeft);
    else journalInvested = round2(journalInvested + lot.usdLeft);
  }
  return { journalMoves, portfolioCash, portfolioInvested, journalInvested };
}

function transferNets(transfers: Transfer[]) {
  const net: Record<BookId, number> = { free: 0, journal: 0, portfolio: 0, forex: 0 };
  for (const t of transfers) {
    net[t.from] = round2(net[t.from] - t.amount);
    net[t.to] = round2(net[t.to] + t.amount);
  }
  return net;
}

export function journalCashMoves(
  cashMoves: CashMove[],
  spots: SpotFill[],
  transfers: Transfer[] = [],
): CashMove[] {
  return [...cashMoves, ...spotWalletCash(spots).journalMoves, ...journalTransferMoves(transfers)];
}

export function computeBooks(input: {
  startingEquity: number;
  trades: Trade[];
  cashMoves: CashMove[];
  spots: SpotFill[];
  transfers: Transfer[];
}): BookSnapshot {
  const transfers = input.transfers ?? [];
  const spot = spotWalletCash(input.spots);
  const cryptoTrades = input.trades.filter((t) => t.market !== "forex");
  const forexTrades = input.trades.filter((t) => t.market === "forex");
  const stats = computeJournal(input.startingEquity, cryptoTrades, [
    ...input.cashMoves,
    ...spot.journalMoves,
    ...journalTransferMoves(transfers),
  ]);
  const forexStats = computeJournal(0, forexTrades, forexTransferMoves(transfers));
  const nets = transferNets(transfers);
  const portfolioCash = round2(nets.portfolio + spot.portfolioCash);
  const free = round2(nets.free);
  const journal = stats.currentEquity;
  const forex = forexStats.currentEquity;
  const cryptoPnl = round2(stats.rows.reduce((s, r) => s + r.realizedPnl, 0));
  const forexPnl = round2(forexStats.rows.reduce((s, r) => s + r.realizedPnl, 0));
  const tradePnl = round2(cryptoPnl + forexPnl);
  const spotPnl = realizedSpotPnl(input.spots);
  const netPnl = round2(tradePnl + spotPnl);
  const coins = round2(spot.portfolioInvested + spot.journalInvested);
  return {
    starting: stats.startingEquity,
    journal,
    journalFree: round2(Math.max(0, journal - stats.openRisk)),
    openRisk: stats.openRisk,
    free,
    portfolioCash,
    portfolioInvested: spot.portfolioInvested,
    journalInvested: spot.journalInvested,
    forex,
    forexFree: round2(Math.max(0, forex - forexStats.openRisk)),
    forexOpenRisk: forexStats.openRisk,
    current: round2(journal + free + portfolioCash + coins + forex),
    cryptoPnl,
    forexPnl,
    tradePnl,
    spotPnl,
    netPnl,
  };
}

function realizedSpotPnl(fills: SpotFill[]) {
  type Lot = { coin: string; qty: number; cost: number };
  const book = new Map<string, Lot>();
  let realized = 0;
  for (const fill of fills) {
    const slot = book.get(fill.coin) ?? { coin: fill.coin, qty: 0, cost: 0 };
    if (fill.side === "buy") {
      slot.qty = roundQty(slot.qty + fill.qty);
      slot.cost = round2(slot.cost + fill.usd);
      book.set(fill.coin, slot);
      continue;
    }
    const avg = slot.qty > 0 ? slot.cost / slot.qty : 0;
    const sold = Math.min(fill.qty, slot.qty);
    if (!(sold > 0)) continue;
    const cost = round2(avg * sold);
    const proceeds = round2(fill.usd * (fill.qty > 0 ? sold / fill.qty : 0));
    realized = round2(realized + (proceeds - cost));
    slot.qty = roundQty(slot.qty - sold);
    slot.cost = round2(Math.max(0, slot.cost - cost));
    book.set(fill.coin, slot);
  }
  return realized;
}

export function forexFunded(trades: Trade[], forexEquity: number) {
  const pnl = round2(
    trades
      .filter((t) => t.market === "forex")
      .reduce((s, t) => s + realizedPnlOf(t), 0),
  );
  return round2(forexEquity - pnl);
}

/** How far this account can move. Only unassigned cash (free) can be added. */
export function allocationRoom(
  books: BookSnapshot,
  book: "journal" | "forex" | "portfolio",
  current: number,
) {
  const extra = Math.max(0, books.free);
  const min =
    book === "journal" ? books.openRisk : book === "forex" ? books.forexOpenRisk : 0;
  const max = round2(Math.max(current, 0) + extra);
  return { min, max };
}

export function transferable(books: BookSnapshot, from: BookId) {
  if (from === "journal") return books.journalFree;
  if (from === "forex") return books.forexFree;
  if (from === "free") return Math.max(0, books.free);
  return Math.max(0, books.portfolioCash);
}

export function fitsAmount(amount: number, cap: number) {
  const n = round2(amount);
  const c = round2(Math.max(0, cap));
  return n > 0 && n <= c;
}
