import { newId, round2 } from "./engine";
import { normalizeFill } from "./portfolio";
import { normalizeTransfer } from "./books";
import { DEFAULT_STARTING_EQUITY, normalizeTrade } from "./seed";
import type {
  BookId,
  CashMove,
  Direction,
  JournalPayload,
  Outcome,
  Realization,
  Trade,
  TradeStatus,
  Transfer,
} from "./types";

const DASH = "-";

function cell(v: string | number | null | undefined): string {
  if (v == null || v === "") return DASH;
  return String(v).replace(/\t/g, " ").replace(/\r?\n/g, " ");
}

function num(v: string | undefined): number | null {
  if (v == null || v === "" || v === DASH) return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function text(v: string | undefined): string {
  if (v == null || v === DASH) return "";
  return v;
}

export function journalToTxt(data: JournalPayload): string {
  const lines: string[] = [
    "ЖУРНАЛ	v1",
    `# Журнал сделок. Строки с # пропускаются.`,
    `# СДЕЛКА: id, пара, дата, направление, статус, риск%, риск$, остаток риска, бу, rr, итог, счёт, вход, стоп, тейк, комис.вход, комис.выход, объём, заметка, капитал_входа`,
    `# ТЕЙК: id_сделки, дата, сумма, вид (partial|close), заметка`,
    `# КАССА: id, дата, сумма, заметка`,
    `# СПОТ: id, монета, дата, buy|sell, сумма$, цена, кол-во, заметка, счёт`,
    `# ПЕРЕВОД: id, дата, откуда, куда, сумма, заметка`,
    `СТАРТ	${round2(data.startingEquity)}`,
    "",
  ];

  for (const t of data.trades) {
    lines.push(
      [
        "СДЕЛКА",
        cell(t.id),
        cell(t.pair),
        cell(t.date),
        cell(t.direction),
        cell(t.status),
        cell(t.riskPct),
        cell(t.riskUsd),
        cell(t.remainingRiskUsd),
        t.atBreakeven ? "1" : "0",
        cell(t.rr),
        cell(t.outcome),
        cell(t.accountSize),
        cell(t.entryPrice),
        cell(t.stopPrice),
        cell(t.takeProfit),
        cell(t.feeOpen),
        cell(t.feeClose),
        cell(t.volume),
        cell(t.note),
        cell(t.equityAtEntry),
        cell(t.market === "forex" ? "forex" : "crypto"),
      ].join("\t"),
    );
    for (const r of t.realizations) {
      lines.push(
        ["ТЕЙК", cell(t.id), cell(r.date), cell(r.amount), cell(r.kind), cell(r.note)].join(
          "\t",
        ),
      );
    }
  }

  if (data.cashMoves.length) lines.push("");
  for (const c of data.cashMoves) {
    lines.push(["КАССА", cell(c.id), cell(c.date), cell(c.amount), cell(c.note)].join("\t"));
  }

  if (data.spots?.length) {
    lines.push("");
    for (const s of data.spots) {
      lines.push(
        [
          "СПОТ",
          cell(s.id),
          cell(s.coin),
          cell(s.date),
          cell(s.side),
          cell(s.usd),
          cell(s.price),
          cell(s.qty),
          cell(s.note),
          cell(s.wallet ?? "journal"),
        ].join("\t"),
      );
    }
  }

  if (data.transfers?.length) {
    lines.push("");
    for (const t of data.transfers) {
      lines.push(
        ["ПЕРЕВОД", cell(t.id), cell(t.date), cell(t.from), cell(t.to), cell(t.amount), cell(t.note)].join(
          "\t",
        ),
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

function parseDirection(v: string): Direction {
  return /short/i.test(v) ? "Short" : "Long";
}

function parseStatus(v: string): TradeStatus {
  const s = v.trim().toLowerCase();
  if (s === "closed" || s === "закрыта" || s === "закрыт") return "closed";
  return "open";
}

function parseOutcome(v: string): Outcome | null {
  const s = v.trim().toLowerCase();
  if (s === "win" || s === "✓" || s === "плюс") return "win";
  if (s === "loss" || s === "✗" || s === "минус") return "loss";
  if (s === "be" || s === "б/о" || s === "бу") return "be";
  return null;
}

function splitCols(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if (line.includes(";")) return line.split(";").map((c) => c.trim());
  return line.split("\t").map((c) => c.trim());
}

export function txtToJournal(rawInput: string): JournalPayload {
  const raw = rawInput.replace(/^\uFEFF/, "");
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new Error("Файл пустой.");
  }

  if (trimmed.startsWith("{")) {
    const parsed = JSON.parse(trimmed) as Partial<JournalPayload>;
    return {
      startingEquity: Number(parsed.startingEquity) || DEFAULT_STARTING_EQUITY,
      trades: (parsed.trades ?? []).map(normalizeTrade),
      cashMoves: parsed.cashMoves ?? [],
      spots: parsed.spots
        ? parsed.spots.map(normalizeFill).filter((f) => f != null)
        : undefined,
      transfers: parsed.transfers
        ? parsed.transfers.flatMap((row) => {
            const next = normalizeTransfer(row);
            return next ? [next] : [];
          })
        : undefined,
    };
  }

  const hasDealWord = /^(СДЕЛКА|TRADE)[\t ]/m.test(trimmed);
  const hasDealTab = /^(СДЕЛКА|TRADE)\t/m.test(trimmed);
  if (hasDealWord && !hasDealTab && !trimmed.includes("\t")) {
    throw new Error(
      "В файле пропали табы — так бывает, если открыть его в Excel. Скачай TXT заново и загрузи как есть, не открывая.",
    );
  }

  const trades = new Map<string, Trade>();
  const order: string[] = [];
  const cashMoves: CashMove[] = [];
  const spots: NonNullable<JournalPayload["spots"]> = [];
  const transfers: Transfer[] = [];
  let sawSpot = false;
  let sawTransfer = false;
  let startingEquity = DEFAULT_STARTING_EQUITY;

  for (const line of raw.split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const cols = splitCols(s);
    const kind = cols[0]?.toUpperCase();

    if (kind === "ЖУРНАЛ" || kind === "JOURNAL") continue;

    if (kind === "СТАРТ" || kind === "START") {
      startingEquity = num(cols[1]) ?? startingEquity;
      continue;
    }

    if (kind === "СДЕЛКА" || kind === "TRADE") {
      const id = text(cols[1]) || newId();
      const accountSize = num(cols[12]);
      const trade = normalizeTrade({
        id,
        pair: text(cols[2]),
        date: text(cols[3]),
        direction: parseDirection(text(cols[4])),
        status: parseStatus(text(cols[5])),
        riskPct: num(cols[6]) ?? 1,
        riskUsd: num(cols[7]) ?? 0,
        remainingRiskUsd: num(cols[8]) ?? undefined,
        atBreakeven: cols[9] === "1" || cols[9] === "true",
        rr: num(cols[10]),
        outcome: parseOutcome(text(cols[11])),
        accountSize,
        entryPrice: num(cols[13]),
        stopPrice: num(cols[14]),
        takeProfit: num(cols[15]),
        feeOpen: num(cols[16]) ?? 0.02,
        feeClose: num(cols[17]) ?? 0.02,
        volume: num(cols[18]),
        note: text(cols[19]),
        equityAtEntry: num(cols[20]) ?? accountSize ?? 0,
        market: text(cols[21]) === "forex" ? "forex" : "crypto",
        realizations: [],
      });
      trades.set(id, trade);
      order.push(id);
      continue;
    }

    if (kind === "ТЕЙК" || kind === "REALIZATION") {
      const tradeId = text(cols[1]);
      const trade = trades.get(tradeId);
      if (!trade) continue;
      const r: Realization = {
        id: newId(),
        date: text(cols[2]),
        amount: round2(num(cols[3]) ?? 0),
        kind: cols[4] === "close" ? "close" : "partial",
        note: text(cols[5]),
      };
      trade.realizations = [...trade.realizations, r];
      continue;
    }

    if (kind === "КАССА" || kind === "CASH") {
      cashMoves.push({
        id: text(cols[1]) || newId(),
        date: text(cols[2]),
        amount: round2(num(cols[3]) ?? 0),
        note: text(cols[4]),
      });
      continue;
    }

    if (kind === "СПОТ" || kind === "SPOT") {
      sawSpot = true;
      const fill = normalizeFill({
        id: text(cols[1]) || newId(),
        coin: text(cols[2]),
        date: text(cols[3]),
        side: text(cols[4]) === "sell" ? "sell" : "buy",
        usd: num(cols[5]) ?? 0,
        price: num(cols[6]) ?? 0,
        qty: num(cols[7]) ?? 0,
        note: text(cols[8]),
        wallet: text(cols[9]) === "portfolio" ? "portfolio" : "journal",
      });
      if (fill) spots.push(fill);
    }

    if (kind === "ПЕРЕВОД" || kind === "TRANSFER") {
      sawTransfer = true;
      const row = normalizeTransfer({
        id: text(cols[1]) || newId(),
        date: text(cols[2]),
        from: text(cols[3]) as BookId,
        to: text(cols[4]) as BookId,
        amount: num(cols[5]) ?? 0,
        note: text(cols[6]),
      });
      if (row) transfers.push(row);
    }
  }

  if (!order.length && !cashMoves.length && !sawSpot) {
    throw new Error("В файле нет сделок. Нужен TXT журнала (кнопка «Выгрузить»), не Excel.");
  }

  return {
    startingEquity,
    trades: order.map((id) => trades.get(id)!).filter(Boolean),
    cashMoves,
    ...(sawSpot ? { spots } : {}),
    ...(sawTransfer ? { transfers } : {}),
  };
}

export function backupFilename(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `zhurnal-sdelok-${y}-${m}-${day}.txt`;
}
