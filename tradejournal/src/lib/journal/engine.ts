import type {
  CashMove,
  ComputedRow,
  CurvePoint,
  JournalStats,
  Outcome,
  Trade,
} from "./types";

export function round2(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

export function suggestedRisk(equity: number, riskPct: number) {
  return round2((equity * riskPct) / 100);
}

export function realizedPnlOf(trade: Trade): number {
  if (trade.realizations.length) {
    return round2(trade.realizations.reduce((s, r) => s + r.amount, 0));
  }
  return 0;
}

function inferOutcome(pnl: number, atBreakeven: boolean): Outcome | null {
  if (pnl > 0) return "win";
  if (pnl < 0) return "loss";
  if (atBreakeven) return "be";
  return "be";
}

export function computeJournal(
  startingEquity: number,
  trades: Trade[],
  cashMoves: CashMove[] = [],
): JournalStats {
  let equity = startingEquity;
  const rows: ComputedRow[] = [];
  const curve: CurvePoint[] = [{ name: "Старт", equity: round2(startingEquity) }];
  const cashQueue = [...cashMoves].sort((a, b) =>
    a.date === b.date ? 0 : a.date < b.date ? -1 : 1,
  );
  let cashIdx = 0;

  const applyCashUpTo = (date: string) => {
    while (cashIdx < cashQueue.length && cashQueue[cashIdx].date <= date) {
      const c = cashQueue[cashIdx];
      equity = round2(equity + c.amount);
      curve.push({
        name: `${c.date} · ${c.amount >= 0 ? "Пополнение" : "Вывод"}`,
        equity,
      });
      cashIdx += 1;
    }
  };

  for (const t of trades) {
    applyCashUpTo(t.date);
    const pnl = realizedPnlOf(t);
    equity = round2(equity + pnl);
    const resultPct = t.equityAtEntry > 0 ? (pnl / t.equityAtEntry) * 100 : 0;
    const rMultiple =
      t.riskUsd > 0 && pnl !== 0
        ? pnl / t.riskUsd
        : pnl === 0 && t.status === "closed"
          ? 0
          : t.rr;
    const positionUsd =
      t.volume != null && t.entryPrice != null
        ? round2(t.volume * t.entryPrice)
        : t.stopPct && t.stopPct > 0
          ? round2(t.riskUsd / (t.stopPct / 100))
          : null;

    const lastReal = t.realizations.length
      ? t.realizations[t.realizations.length - 1]?.date
      : null;
    const closedAt =
      t.status === "closed" ? lastReal || t.date : lastReal;

    rows.push({
      ...t,
      realizedPnl: pnl,
      resultPct: round2(resultPct),
      rMultiple,
      equityAfter: equity,
      positionUsd,
      closedAt,
    });
    if (Number.isFinite(equity) && (pnl !== 0 || t.status === "closed")) {
      curve.push({ name: `${t.date} · ${t.pair}`, equity });
    }
  }
  applyCashUpTo("9999-12-31");

  const closed = rows.filter((r) => r.status === "closed");
  const wins = closed.filter(
    (r) => (r.outcome ?? inferOutcome(r.realizedPnl, r.atBreakeven)) === "win",
  ).length;
  const losses = closed.filter(
    (r) => (r.outcome ?? inferOutcome(r.realizedPnl, false)) === "loss",
  ).length;
  const be = closed.filter(
    (r) => (r.outcome ?? inferOutcome(r.realizedPnl, r.atBreakeven)) === "be",
  ).length;
  const decided = wins + losses;
  const openRows = rows.filter((r) => r.status === "open");
  const openRisk = round2(openRows.reduce((s, r) => s + r.remainingRiskUsd, 0));
  const currentEquity = round2(equity);
  const deposits = round2(
    cashMoves.filter((c) => c.amount > 0).reduce((s, c) => s + c.amount, 0),
  );
  const withdrawals = round2(
    cashMoves.filter((c) => c.amount < 0).reduce((s, c) => s + c.amount, 0),
  );
  const sumR = round2(closed.reduce((s, r) => s + (r.rMultiple ?? 0), 0));
  const available = round2(currentEquity - openRisk);

  return {
    startingEquity,
    currentEquity,
    openRisk,
    available,
    nextRisk: suggestedRisk(available, 1),
    deposits,
    withdrawals,
    tradeCount: trades.length,
    winrate: decided > 0 ? wins / decided : null,
    sumR,
    wins,
    losses,
    be,
    longs: trades.filter((t) => t.direction === "Long").length,
    shorts: trades.filter((t) => t.direction === "Short").length,
    openCount: openRows.length,
    riskOnCount: openRows.filter((r) => r.remainingRiskUsd > 0).length,
    rows,
    curve,
  };
}

export function outcomeFromMark(mark: string | null | undefined): Outcome | null {
  if (mark === "✓" || mark === "win") return "win";
  if (mark === "✗" || mark === "loss") return "loss";
  if (mark === "б/о" || mark === "be") return "be";
  return null;
}

export function newId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `t_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
