import { calcPosition } from "./position";
import { newId, round2, suggestedRisk } from "./engine";
import type { CashMove, Direction, Market, Trade } from "./types";

export const DEFAULT_STARTING_EQUITY = 4000;

export function buildSeedCash(): CashMove[] {
  return [];
}

export function buildSeedTrades(): Trade[] {
  return [];
}

export function freezeOpenTrade(input: {
  pair: string;
  date: string;
  direction: Direction;
  riskPct: number;
  currentEquity: number;
  accountSize: number;
  stopPct?: number | null;
  note?: string;
  entryPrice: number;
  stopPrice: number;
  takeProfit: number;
  feeOpen: number;
  feeClose: number;
  market?: Market;
  /** Forex stores units (lots × 100 000). Crypto lets the calculator decide. */
  volume?: number | null;
}): Trade {
  const equityAtEntry = round2(input.currentEquity);
  const accountSize = round2(input.accountSize);
  const calc = calcPosition({
    direction: input.direction,
    accountSize,
    riskPct: input.riskPct,
    entry: input.entryPrice,
    stop: input.stopPrice,
    take: input.takeProfit,
    feeOpen: input.feeOpen,
    feeClose: input.feeClose,
  });
  const riskUsd = calc.riskUsd || suggestedRisk(accountSize, input.riskPct);
  return {
    id: newId(),
    pair: input.pair.trim(),
    date: input.date,
    direction: input.direction,
    riskPct: input.riskPct,
    rr: calc.rr,
    outcome: null,
    status: "open",
    note: input.note ?? "",
    equityAtEntry,
    riskUsd,
    remainingRiskUsd: riskUsd,
    atBreakeven: false,
    realizations: [],
    stopPct: input.stopPct ?? null,
    accountSize,
    entryPrice: input.entryPrice,
    stopPrice: input.stopPrice,
    takeProfit: input.takeProfit,
    feeOpen: input.feeOpen,
    feeClose: input.feeClose,
    volume: input.volume ?? calc.volume,
    market: input.market === "forex" ? "forex" : "crypto",
  };
}

export function normalizeTrade(
  raw: Partial<Trade> & { depositUsd?: number; pnlUsd?: number | null },
): Trade {
  const riskUsd = raw.riskUsd ?? 0;
  const status = raw.status === "closed" ? "closed" : "open";
  let realizations = raw.realizations ?? [];
  if (!realizations.length && raw.pnlUsd != null) {
    realizations = [
      {
        id: newId(),
        date: raw.date ?? "",
        amount: raw.pnlUsd,
        note: "",
        kind: "close",
      },
    ];
  }
  const atBreakeven = raw.atBreakeven ?? false;
  const remaining =
    status === "closed" || atBreakeven ? 0 : (raw.remainingRiskUsd ?? riskUsd);
  return {
    id: raw.id ?? newId(),
    pair: raw.pair ?? "",
    date: raw.date ?? "",
    direction: raw.direction === "Short" ? "Short" : "Long",
    riskPct: raw.riskPct ?? 1,
    rr: raw.rr ?? null,
    outcome: raw.outcome ?? null,
    status,
    note: raw.note ?? "",
    equityAtEntry: raw.equityAtEntry ?? 0,
    riskUsd,
    remainingRiskUsd: remaining,
    atBreakeven,
    realizations,
    stopPct: raw.stopPct ?? null,
    accountSize: raw.accountSize ?? raw.equityAtEntry ?? null,
    entryPrice: raw.entryPrice ?? null,
    stopPrice: raw.stopPrice ?? null,
    takeProfit: raw.takeProfit ?? null,
    feeOpen: raw.feeOpen ?? 0.02,
    feeClose: raw.feeClose ?? 0.02,
    volume: raw.volume ?? null,
    market: raw.market === "forex" ? "forex" : "crypto",
  };
}
