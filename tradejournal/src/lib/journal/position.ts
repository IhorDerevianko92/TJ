import { round2, suggestedRisk } from "./engine";
import type { Direction } from "./types";

export type PositionInput = {
  direction: Direction;
  accountSize: number;
  riskPct: number;
  entry: number;
  stop: number;
  take: number;
  feeOpen: number;
  feeClose: number;
};

export type PositionResult = {
  riskUsd: number;
  volume: number | null;
  notional: number | null;
  rr: number | null;
  stopDistance: number | null;
  validStop: boolean;
  validTake: boolean;
};

function round8(n: number) {
  return Math.round(n * 1e8) / 1e8;
}

/** Как у биржи / Sancho: 3,660… → 3,66 ед. */
export function roundQty(n: number) {
  const a = Math.abs(n);
  if (a >= 1) return Math.round(n * 100) / 100;
  if (a >= 0.01) return Math.round(n * 1e4) / 1e4;
  if (a >= 0.0001) return Math.round(n * 1e6) / 1e6;
  return round8(n);
}

export function calcPosition(input: PositionInput): PositionResult {
  const riskUsd = suggestedRisk(input.accountSize, input.riskPct);
  const { entry, stop, take, direction, feeOpen, feeClose } = input;
  const long = direction === "Long";

  if (!(entry > 0) || !(stop > 0)) {
    return {
      riskUsd,
      volume: null,
      notional: null,
      rr: null,
      stopDistance: null,
      validStop: false,
      validTake: false,
    };
  }

  const stopDist = long ? entry - stop : stop - entry;
  const validStop = stopDist > 0;
  const takeDist = take > 0 ? (long ? take - entry : entry - take) : 0;
  const validTake = take > 0 && takeDist > 0;
  const rr = validStop && validTake ? round2(takeDist / stopDist) : null;

  if (!validStop || riskUsd <= 0) {
    return {
      riskUsd,
      volume: null,
      notional: null,
      rr,
      stopDistance: stopDist,
      validStop,
      validTake,
    };
  }

  const lossPerUnit =
    stopDist + entry * (feeOpen / 100) + stop * (feeClose / 100);
  const rawVolume = lossPerUnit > 0 ? riskUsd / lossPerUnit : null;
  const volume = rawVolume != null ? roundQty(rawVolume) : null;
  const notional = volume != null ? round2(volume * entry) : null;

  return {
    riskUsd,
    volume,
    notional,
    rr,
    stopDistance: stopDist,
    validStop,
    validTake,
  };
}

function pairCode(pair: string) {
  return pair.toUpperCase().replace(/[^A-Z]/g, "");
}

/** 0,0001 for EUR/USD, 0,01 for USD/JPY. */
export function pipSize(pair: string) {
  const quote = pairCode(pair).slice(3, 6);
  return quote === "JPY" ? 0.01 : 0.0001;
}

/**
 * Dollars per pip for one standard lot.
 * Quote in USD → $10. USD/XXX uses the entry price. Other crosses fall back to $10.
 */
export function pipValuePerLot(pair: string, entry: number) {
  const code = pairCode(pair);
  const base = code.slice(0, 3);
  const quote = code.slice(3, 6);
  if (quote === "USD" || !quote) return 10;
  if (base === "USD" && quote === "JPY" && entry > 0) return round2(1000 / entry);
  if (base === "USD" && entry > 0) return round2(10 / entry);
  return 10;
}

export type ForexInput = {
  direction: Direction;
  accountSize: number;
  riskPct: number;
  pair: string;
  entry: number;
  stopPips: number;
  takePips: number;
};

export type ForexResult = {
  riskUsd: number;
  lots: number | null;
  units: number | null;
  notional: number | null;
  rr: number | null;
  pip: number;
  pipValue: number;
  stopPrice: number | null;
  takePrice: number;
  validStop: boolean;
  validTake: boolean;
};

/** Sancho forex: 4 000 × 1% and 1 pip on EUR/USD → 4 lots, 400 000 units, $40. */
export function calcForex(input: ForexInput): ForexResult {
  const riskUsd = suggestedRisk(input.accountSize, input.riskPct);
  const pip = pipSize(input.pair);
  const pipValue = pipValuePerLot(input.pair, input.entry);
  const validStop = input.stopPips > 0 && pipValue > 0;
  const validTake = input.takePips > 0;
  const lots =
    validStop && riskUsd > 0 ? round2(riskUsd / (input.stopPips * pipValue)) : null;
  const units = lots != null ? Math.round(lots * 100000) : null;
  const long = input.direction === "Long";
  const stopPrice =
    input.entry > 0 && validStop
      ? round8(long ? input.entry - input.stopPips * pip : input.entry + input.stopPips * pip)
      : null;
  const takePrice =
    input.entry > 0 && validTake
      ? round8(long ? input.entry + input.takePips * pip : input.entry - input.takePips * pip)
      : 0;
  const rr = validStop && validTake ? round2(input.takePips / input.stopPips) : null;
  const notional = units != null && input.entry > 0 ? round2(units * input.entry) : null;
  return {
    riskUsd,
    lots,
    units,
    notional,
    rr,
    pip,
    pipValue,
    stopPrice,
    takePrice,
    validStop,
    validTake,
  };
}
